"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { aiAskAdvisor, aiClassifyCase, aiExtractFacts, aiGenerateDraft, aiGenerateFollowups, aiReviewCase, type AiClientError } from "@/lib/aiClient";
import { getOutputModeForCase, caseConfigs, getCaseConfig, highRiskCaseTypes, outputModeLabel, resolveOutputMode } from "@/lib/caseConfig";
import { normalizeCaseStatus } from "@/lib/caseStatus";
import { type Language, translate, useLanguage } from "@/lib/i18n";
import { buildOfficialActionSuggestions } from "@/lib/officialPortals";
import type { CaseData, AiClassification, AiExtraction, AiReview, AdvisorChat, UploadedFile } from "@/types/case";
import { generateComplaintDraft } from "@/lib/draftTemplates";
import { calculateCaseQualityScore } from "@/lib/qualityScore";
import { PortalCard } from "@/components/portal-card";
import { SourceTag } from "@/components/source-tag";
import {
  getMissingProofSuggestions,
  getVerifiedSourceNotes,
  hasLawHallucinationRisk,
  getNextStepsChecklist,
  generateFollowUpQuestions,
  getMergedFollowUpQuestions,
  formatFileSize,
  calculateRiskLevel,
} from "@/lib/caseUtils";
import { OTHER_PROOF_OPTION, OTHER_RELIEF_OPTION, storyKeywords, propertyKeywords, consumerKeywords, rtiKeywords } from "@/lib/constants";

export const dynamic = "force-dynamic";

type AdvisorAnswer = Omit<AdvisorChat, "id" | "question" | "createdAt">;

const uploadCategories = Array.from(new Set(caseConfigs.flatMap((config) => config.proofs).concat("Other supporting proof")));

const caseTypeAliases: Record<string, string[]> = {
  "Cyber Fraud / UPI Scam": ["cyber", "upi", "fraud", "scam", "transaction", "bank", "whatsapp"],
  "Consumer Complaint": ["consumer", "refund", "replacement", "seller", "platform", "damaged", "product"],
  "Unpaid Salary / Gig Worker Payment": ["salary", "wage", "gig", "payment", "employer"],
  "Property / Land Dispute": ["property", "land", "ancestral", "sale deed", "revenue", "mutation", "khasra"],
  "Police Complaint / General Complaint": ["police", "complaint", "threat"],
  "Lost Documents / Police Complaint": ["lost", "document", "police", "id"],
  "RTI / Government Service Delay": ["rti", "government", "delay", "certificate", "department"],
  "Divorce / Custody / Family Matter": ["divorce", "custody", "family", "child"],
  "Bail / Arrest / Criminal Defence": ["bail", "arrest", "criminal", "defence", "detention"],
  "Other / Not Sure": ["other", "not sure", "unknown"],
};

export default function IntakePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-950" />}>
      <IntakeContent />
    </Suspense>
  );
}

function IntakeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, setLanguage } = useLanguage();
  const [formData, setCaseData] = useState<CaseData>({
    fullName: "",
    contact: "",
    caseType: "Cyber Fraud / UPI Scam",
    stateOrUT: "",
    story: "",
    incidentDate: "",
    amountLost: "",
    oppositeParty: "",
    proofs: [],
    relief: [],
    customProofs: [],
    customReliefs: [],
    uploadedFiles: [],
  });

  const [submittedCase, setSubmittedCase] = useState<CaseData | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [followUpAnswers, setFollowUpAnswers] = useState<Record<string, string>>({});
  const [updateMessage, setUpdateMessage] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(uploadCategories[0]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [editableDraft, setEditableDraft] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [isEditingSavedCase, setIsEditingSavedCase] = useState(false);
  const [mode, setMode] = useState<"full" | "guided">("full");
  const [wizardStep, setWizardStep] = useState(0);
  const [draftFound, setDraftFound] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  const [voiceMessage, setVoiceMessage] = useState("");
  const [aiLoading, setAiLoading] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [extraFollowUpQuestions, setExtraFollowUpQuestions] = useState<string[]>([]);
  const [advisorQuestion, setAdvisorQuestion] = useState("");
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorMessage, setAdvisorMessage] = useState("");
  const [otherClassifying, setOtherClassifying] = useState(false);
  const [caseTypeSearch, setCaseTypeSearch] = useState("");
  const [customProofInput, setCustomProofInput] = useState("");
  const [customReliefInput, setCustomReliefInput] = useState("");
  const [draftLanguage, setDraftLanguage] = useState<Language>(language);

  // Phase 1: Lifted AI state
  const [aiState, setAiState] = useState<{
    analysis: CaseData["aiAnalysis"];
    followupQuestions: string[];
    advisorChats: AdvisorChat[];
    lastAnalyzedAt: string | undefined;
  }>({
    analysis: undefined,
    followupQuestions: [],
    advisorChats: [],
    lastAnalyzedAt: undefined,
  });
  const todayISO = new Date().toISOString().split("T")[0];
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const currentCaseConfig = getCaseConfig(formData.caseType);
  const suggestedProofs = aiState.analysis?.classification?.suggestedProofs ?? [];
  const suggestedReliefs = aiState.analysis?.classification?.suggestedReliefs ?? [];
  const proofKeys = ["proofWhatsApp", "proofUPI", "proofBankSMS", "proofPhone", "proofEmail", "proofPolice"] as const;
  const reliefKeys = ["reliefRefund", "reliefPolice", "reliefCyber", "reliefBank", "reliefLegalAid"] as const;
  const defaultProofOpts = proofKeys.map((k) => t(k));
  const defaultReliefOpts = reliefKeys.map((k) => t(k));
  const proofOptions = Array.from(new Set([...(currentCaseConfig.proofs || defaultProofOpts), ...(formData.caseType === "Other / Not Sure" ? suggestedProofs : []), OTHER_PROOF_OPTION]));
  const reliefOptions = Array.from(new Set([...(currentCaseConfig.relief || defaultReliefOpts), ...(formData.caseType === "Other / Not Sure" ? suggestedReliefs : []), OTHER_RELIEF_OPTION]));
  const evidenceMeaning: Record<string, string> = {
    [t("proofWhatsApp")]: t("evidenceMeaningWhatsApp"),
    [t("proofUPI")]: t("evidenceMeaningUPI"),
    [t("proofBankSMS")]: t("evidenceMeaningBankSMS"),
    [t("proofPhone")]: t("evidenceMeaningPhone"),
    [t("proofEmail")]: t("evidenceMeaningEmail"),
    [t("proofPolice")]: t("evidenceMeaningPolice"),
    "Property papers": "May help identify title/ownership history, subject to legal verification.",
    "Mutation/tax records": "May help show revenue/tax entries, but these need legal review.",
    "Photos": "May help show possession, boundary, condition, or dispute context.",
    "Notices": "May help show prior legal communication or dispute history.",
    "Messages / emails": "May help show admissions, threats, negotiations, or timeline.",
    "Witness details": "May help identify people who know the property history or possession facts.",
    "Timeline notes": "Helps legal aid/lawyer understand events in order.",
    [OTHER_PROOF_OPTION]: t("evidenceMeaningOther"),
  };

useEffect(() => {
    if (searchParams.get("edit") !== "true") return;

    try {
      const saved = localStorage.getItem("nyaymitra_edit_case");
      if (!saved) return;

      const parsed = JSON.parse(saved) as CaseData;
      const nextCase = { ...parsed, uploadedFiles: parsed.uploadedFiles || [], followUpAnswers: parsed.followUpAnswers || {}, customProofs: parsed.customProofs || [], customReliefs: parsed.customReliefs || [], status: normalizeCaseStatus(parsed.status) };
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount hydration from localStorage
      setCaseData(nextCase);
      setFollowUpAnswers(nextCase.followUpAnswers || {});
      setEditableDraft(nextCase.complaintDraft || "");
      setSubmittedCase(nextCase);
      setIsEditingSavedCase(true);
      // Restore lifted AI state
      if (nextCase.aiAnalysis) {
        setAiState((prev) => ({
          ...prev,
          analysis: nextCase.aiAnalysis,
          lastAnalyzedAt: nextCase.aiAnalysis?.lastAnalyzedAt,
        }));
      }
      if (nextCase.advisorChats?.length) {
        setAiState((prev) => ({ ...prev, advisorChats: nextCase.advisorChats }));
      }
    } catch {}
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("edit") === "true") return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount hydration from localStorage
      setDraftFound(Boolean(localStorage.getItem("nyaymitra_intake_draft")));
    } catch {
      setDraftFound(false);
    }
  }, [searchParams]);

  function handleInputChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;

    setCaseData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleCheckboxChange(
    e: React.ChangeEvent<HTMLInputElement>,
    field: "proofs" | "relief"
  ) {
    const { value, checked } = e.target;

    setCaseData((prev) => ({
      ...prev,
      [field]: checked
        ? [...prev[field], value]
        : prev[field].filter((item) => item !== value),
    }));
  }

  function selectCaseType(caseType: string) {
    setCaseData((prev) => ({
      ...prev,
      caseType,
      amountLost: highRiskCaseTypes.includes(caseType) ? "" : prev.amountLost,
      oppositeParty: "",
      proofs: [],
      relief: [],
      customProofs: [],
      customReliefs: [],
      uploadedFiles: [],
      complaintDraft: "",
      outputMode: undefined,
      aiAnalysis: undefined,
      advisorChats: [],
    }));
    setSubmittedCase(null);
    setFollowUpAnswers({});
    setEditableDraft("");
    setExtraFollowUpQuestions([]);
    setCustomProofInput("");
    setCustomReliefInput("");
    setAiMessage("");
    setAiState({
      analysis: undefined,
      followupQuestions: [],
      advisorChats: [],
      lastAnalyzedAt: undefined,
    });
  }

  function addCustomProof() {
    const values = splitCustomItems(customProofInput);
    if (!values.length) return;
    setCaseData((prev) => ({ ...prev, customProofs: Array.from(new Set([...(prev.customProofs || []), ...values])) }));
    setCustomProofInput("");
  }

  function removeCustomProof(value: string) {
    setCaseData((prev) => ({ ...prev, customProofs: (prev.customProofs || []).filter((item) => item !== value) }));
  }

  function addCustomRelief() {
    const values = splitCustomItems(customReliefInput);
    if (!values.length) return;
    setCaseData((prev) => ({ ...prev, customReliefs: Array.from(new Set([...(prev.customReliefs || []), ...values])) }));
    setCustomReliefInput("");
  }

  function removeCustomRelief(value: string) {
    setCaseData((prev) => ({ ...prev, customReliefs: (prev.customReliefs || []).filter((item) => item !== value) }));
  }

  function splitCustomItems(value: string) {
    return value.split(/[\n,;]+/).map((item) => item.trim().replace(/^[-*•]\s*/, "")).filter(Boolean);
  }

  function getCaseOutputMode(caseData: CaseData) {
    return getOutputModeForCase(caseData);
  }

  function getCaseRiskLabel(caseData: CaseData) {
    if (getCaseOutputMode(caseData) === "urgent-legal-aid-route") return "High Risk / Legal Review Required";
    return calculateRiskLevel(caseData.amountLost);
  }

  function countCaseUsefulKeywords(caseData: CaseData) {
    const lowerStory = caseData.story.toLowerCase();
    const keywords = caseData.caseType === "Property / Land Dispute" ? propertyKeywords : caseData.caseType === "Consumer Complaint" ? consumerKeywords : caseData.caseType === "RTI / Government Service Delay" || caseData.caseType === "Government Document / Certificate Issue" ? rtiKeywords : storyKeywords;
    return keywords.filter((keyword) => lowerStory.includes(keyword)).length;
  }

  function getStoryQualityWarning(caseData: CaseData) {
    if (caseData.story.trim().length >= 80 && countCaseUsefulKeywords(caseData) < 3) {
      if (caseData.caseType === "Property / Land Dispute") return t("warnStoryQualityProperty");
      if (caseData.caseType === "Consumer Complaint") return t("warnStoryQualityConsumer");
      if (caseData.caseType === "RTI / Government Service Delay") return t("warnStoryQualityRti");
      return t("warnStoryQualityGeneric");
    }

    return "";
  }

  function getLocalizedAmountMismatch(caseData: CaseData) {
    const fieldAmount = Number(caseData.amountLost);
    const matches = Array.from(caseData.story.matchAll(/(?:₹|rs\.?|inr)?\s*([0-9][0-9,]*(?:\.\d+)?)/gi));
    const storyAmounts = matches.map((match) => Number(match[1].replace(/,/g, ""))).filter((amount) => amount > 0);
    const differentAmount = storyAmounts.find((amount) => fieldAmount > 0 && amount !== fieldAmount);

    if (!differentAmount) return "";

    return t("warnAmountMismatch").replace("{fieldAmount}", String(caseData.amountLost)).replace("{storyAmount}", String(differentAmount));
  }

function analyzeDraftQuality(draftText: string) {
    const lowerDraft = draftText.toLowerCase();
    const hasSubject = lowerDraft.includes("subject:");
    const hasIncidentDate = Boolean(submittedCase?.incidentDate && draftText.includes(submittedCase.incidentDate));
    const hasAmount = Boolean(submittedCase?.amountLost && Number(submittedCase.amountLost) > 0 && draftText.includes(submittedCase.amountLost));
    const hasEvidence = (lowerDraft.includes("evidence") || lowerDraft.includes("annexure")) && (submittedCase?.proofs.length || 0) > 0;
    const hasRelief = (lowerDraft.includes("relief requested") || lowerDraft.includes("relief")) && (submittedCase?.relief.length || 0) > 0;
    const hasDeclaration = lowerDraft.includes("declaration");
    const suggestions: string[] = [];
    let score = 0;

    if (hasSubject) score += 15;
    else suggestions.push("Add subject.");
    if (hasIncidentDate) score += 15;
    else suggestions.push("Add incident date.");
    if (hasAmount) score += 15;
    else suggestions.push("Mention amount lost.");
    if (hasEvidence) score += 20;
    else suggestions.push("Mention evidence clearly.");
    if (hasRelief) score += 20;
    else suggestions.push("Add relief requested.");
    if (hasDeclaration) score += 15;
    else suggestions.push("Add declaration.");

    return { hasSubject, hasIncidentDate, hasAmount, hasEvidence, hasRelief, hasDeclaration, score, suggestions };
  }

  function handleGenerateDraftComplaint() {
    if (!submittedCase) return;
    const nextDraft = generateComplaintDraft({ ...submittedCase, language: draftLanguage });
    setEditableDraft(nextDraft);
    setSubmittedCase((prev) => prev ? { ...prev, complaintDraft: nextDraft } : null);
    setDraftMessage("");
  }

  function handleResetDraft() {
    setEditableDraft("");
    setDraftMessage("");
    setSubmittedCase((prev) => prev ? { ...prev, complaintDraft: "" } : prev);
  }

  function handleDraftChange(value: string) {
    setEditableDraft(value);
    setSubmittedCase((prev) => prev ? { ...prev, complaintDraft: value } : prev);
  }

  async function handleCopyDraft() {
    if (!editableDraft) return;
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        setDraftMessage("Clipboard is not available in this context.");
        return;
      }
      await navigator.clipboard.writeText(editableDraft);
      setDraftMessage(t("msgDraftCopied"));
    } catch {
      setDraftMessage("Failed to copy. Please copy manually.");
    }
  }

  function handleAddEvidenceFile() {
    if (!selectedFile) {
      setFileError(t("msgPleaseChooseFile"));
      return;
    }

    const nextFile: UploadedFile = {
      id: `${selectedFile.name}-${selectedFile.size}-${selectedFile.lastModified}-${formData.uploadedFiles.length}`,
      fileName: selectedFile.name,
      fileType: selectedFile.type || "Unknown",
      fileSize: selectedFile.size,
      evidenceCategory: selectedCategory,
      uploadedAt: new Date().toISOString(),
    };

    setCaseData((current) => ({
      ...current,
      uploadedFiles: [...current.uploadedFiles, nextFile],
      proofs: proofOptions.includes(selectedCategory) && !current.proofs.includes(selectedCategory)
        ? [...current.proofs, selectedCategory]
        : current.proofs,
    }));
    setSelectedFile(null);
    setFileError("");
  }

  function handleRemoveEvidenceFile(fileId: string) {
    setCaseData((current) => ({
      ...current,
      uploadedFiles: current.uploadedFiles.filter((file) => file.id !== fileId),
    }));
  }

  function safetyOutputMode(caseData: CaseData, classification?: AiClassification) {
    return resolveOutputMode(caseData.caseType, caseData.story, classification?.caseType, classification?.outputMode);
  }  function isHighRiskCase(caseData: CaseData) {
    return highRiskCaseTypes.includes(caseData.caseType) || Number(caseData.amountLost) > 50000;
  }

  function fallbackAdvisor(caseData: CaseData): AdvisorAnswer {
    const highRisk = isHighRiskCase(caseData);
    return {
      answer: highRisk ? "This matter needs urgent legal-aid/lawyer review. NyayMitra can help organize documents but should not be used as legal advice." : "Organize your facts in date order, keep original proof safe, and prepare a clear draft for authority/legal-aid review.",
      nextSteps: ["Organize your facts in date order.", "Keep original proof safe.", "Write down names, phone numbers, emails, transaction IDs, and dates.", "Do not delete chats/SMS/emails.", "For serious or high-value matters, contact legal aid/lawyer."],
      missingInfo: caseData.proofs.length ? [] : ["Select or upload available proof."],
      riskNote: highRisk ? "High-risk matter: urgent legal-aid/lawyer support is recommended." : "This is preparation guidance only, not legal advice.",
      lawyerReviewRecommended: highRisk,
    };
  }

  function isAiError(result: unknown): result is AiClientError {
    return Boolean(result && typeof result === "object" && "error" in result);
  }

  function showAiError(result: AiClientError, fallbackMessage = "AI could not respond. Rule-based mode is still available.") {
    const message = result.error || fallbackMessage;
    setAiMessage(message);
  }

async function handleAskAdvisor() {
    if (!submittedCase || !advisorQuestion.trim()) return;
    setAdvisorLoading(true);
    setAdvisorMessage(t("aiThinkingNyayMitra"));
    const result = await aiAskAdvisor(submittedCase, advisorQuestion) as AdvisorAnswer | AiClientError;
    const failed = isAiError(result);
    const answer = failed ? fallbackAdvisor(submittedCase) : result;
    const chat: AdvisorChat = { ...answer, id: `CHAT-${Date.now()}`, question: advisorQuestion, createdAt: new Date().toISOString() };
    setSubmittedCase((prev) => prev ? { ...prev, advisorChats: [...(prev.advisorChats || []), chat] } : null);
    setAiState((prev) => ({ ...prev, advisorChats: [...(prev.advisorChats || []), chat] }));
    setAdvisorQuestion("");
    setAdvisorMessage(failed ? `${result.error} ${t("aiRuleBasedFallback")}` : t("aiGuidanceGenerated"));
    setAdvisorLoading(false);
  }

  async function handleOtherClassification() {
    if (formData.caseType !== "Other / Not Sure") return;
    setOtherClassifying(true);
    setAiMessage(t("aiTryingToUnderstand"));
    const result = await aiClassifyCase(formData) as AiClassification | AiClientError;
    setOtherClassifying(false);
    if (isAiError(result)) {
      showAiError(result, t("aiCouldNotClassify"));
      return;
    }
    const safeClassification = { ...result, outputMode: safetyOutputMode(formData, result) };
    setCaseData((current) => ({ ...current, aiAnalysis: { ...(current.aiAnalysis || {}), classification: safeClassification, lastAnalyzedAt: new Date().toISOString() } }));
    setAiState((prev) => ({
      ...prev,
      analysis: { ...(prev.analysis || {}), classification: safeClassification, lastAnalyzedAt: new Date().toISOString() },
      lastAnalyzedAt: new Date().toISOString(),
    }));
    setAiMessage(t("aiClassificationReady"));
  }

  function useSuggestedCaseType() {
    const classification = aiState.analysis?.classification;
    if (!classification) return;
    setCaseData((current) => ({ ...current, caseType: classification.caseType, outputMode: safetyOutputMode(current, classification), proofs: Array.from(new Set([...current.proofs, ...classification.suggestedProofs])), relief: Array.from(new Set([...current.relief, ...classification.suggestedReliefs])) }));
  }

  function mergeAiAnalysis(next: Partial<NonNullable<CaseData["aiAnalysis"]>>) {
    setAiState((prev) => {
      const merged = { ...(prev.analysis || {}), ...next, lastAnalyzedAt: new Date().toISOString() };
      return { ...prev, analysis: merged, lastAnalyzedAt: new Date().toISOString() };
    });
    setSubmittedCase((prev) => {
      if (!prev) return null;
      const merged = { ...(prev.aiAnalysis || {}), ...next, lastAnalyzedAt: new Date().toISOString() };
      return { ...prev, aiAnalysis: merged };
    });
  }

  async function handleAiAnalyzeStory() {
    if (!submittedCase) return;
    setAiLoading("analyze");
    setAiMessage(t("aiAnalyzingCase"));
    const [classification, extraction] = await Promise.all([aiClassifyCase(submittedCase), aiExtractFacts(submittedCase)]);
    setAiLoading("");
    const classificationError = isAiError(classification) ? classification : null;
    const extractionError = isAiError(extraction) ? extraction : null;
    if (classificationError && extractionError) {
      showAiError(classificationError);
      return;
    }
    const safeClassification = classification && !classificationError ? { ...(classification as AiClassification), outputMode: safetyOutputMode(submittedCase, classification as AiClassification) } : undefined;
    setAiState((prev) => ({
      ...prev,
      analysis: { ...(prev.analysis || {}), classification: safeClassification, extraction: extraction && !extractionError ? extraction as AiExtraction : undefined, lastAnalyzedAt: new Date().toISOString() },
      lastAnalyzedAt: new Date().toISOString(),
    }));
    // Mirror to submittedCase for backward compatibility
    setSubmittedCase((prev) => prev ? { ...prev, aiAnalysis: { ...(prev.aiAnalysis || {}), classification: safeClassification, extraction: extraction && !extractionError ? extraction as AiExtraction : undefined, lastAnalyzedAt: new Date().toISOString() } } : null);
    
    // Auto-populate: merge AI followups into lifted state
    if (extraction && !extractionError && (extraction as AiExtraction).missingDetails?.length) {
      setAiState((prev) => ({
        ...prev,
        followupQuestions: Array.from(new Set([...(prev.followupQuestions || []), ...(extraction as AiExtraction).missingDetails])),
      }));
    }
    
    setAiMessage(t("aiAnalysisCompleted"));
  }

  async function handleAiFollowups() {
    if (!submittedCase) return;
    setAiLoading("followup");
    setAiMessage(t("aiAnalyzingCase"));
    const result = await aiGenerateFollowups(submittedCase) as { questions?: string[] } | AiClientError;
    setAiLoading("");
    if (isAiError(result) || !result.questions) {
      showAiError(isAiError(result) ? result : { error: "AI did not return follow-up questions." });
      return;
    }
    const questions = Array.from(new Set([...extraFollowUpQuestions, ...result.questions]));
    setExtraFollowUpQuestions(questions);
    setAiState((prev) => ({
      ...prev,
      followupQuestions: questions,
      analysis: { ...(prev.analysis || {}), followupQuestions: questions, lastAnalyzedAt: new Date().toISOString() },
      lastAnalyzedAt: new Date().toISOString(),
    }));
    // Mirror to submittedCase
    setSubmittedCase((prev) => prev ? { ...prev, aiAnalysis: { ...(prev.aiAnalysis || {}), followupQuestions: questions, lastAnalyzedAt: new Date().toISOString() } } : null);
    setAiMessage(t("aiAnalysisCompleted"));
  }

  async function handleAiImproveDraft() {
    if (!submittedCase) return;
    setAiLoading("draft");
    setAiMessage(t("aiAnalyzingCase"));
    const result = await aiGenerateDraft(submittedCase) as { draftText?: string } | AiClientError;
    setAiLoading("");
    if (isAiError(result) || !result.draftText) {
      showAiError(isAiError(result) ? result : { error: "AI did not return draft text." });
      return;
    }
    setEditableDraft(result.draftText);
    setSubmittedCase((prev) => prev ? { ...prev, complaintDraft: result.draftText, aiAnalysis: { ...(prev.aiAnalysis || {}), generatedDraft: result.draftText, lastAnalyzedAt: new Date().toISOString() } } : null);
    setAiState((prev) => ({
      ...prev,
      analysis: { ...(prev.analysis || {}), generatedDraft: result.draftText, lastAnalyzedAt: new Date().toISOString() },
      lastAnalyzedAt: new Date().toISOString(),
    }));
    setAiMessage(t("aiDraftGenerated"));
  }

  async function handleAiReview() {
    if (!submittedCase) return;
    setAiLoading("review");
    setAiMessage(t("aiAnalyzingCase"));
    const result = await aiReviewCase(submittedCase) as AiReview | AiClientError;
    setAiLoading("");
    if (isAiError(result)) {
      showAiError(result);
      return;
    }
    setAiState((prev) => ({
      ...prev,
      analysis: { ...(prev.analysis || {}), review: result, lastAnalyzedAt: new Date().toISOString() },
      lastAnalyzedAt: new Date().toISOString(),
    }));
    // Mirror to submittedCase
    setSubmittedCase((prev) => prev ? { ...prev, aiAnalysis: { ...(prev.aiAnalysis || {}), review: result, lastAnalyzedAt: new Date().toISOString() } } : null);
    setAiMessage(t("aiAnalysisCompleted"));
  }

  function handleGenerate() {
    const nextErrors: string[] = [];

    if (!formData.fullName.trim()) nextErrors.push(t("errorNameRequired"));
    if (!formData.contact.trim()) nextErrors.push(t("errorContactRequired"));
    if (!formData.incidentDate) nextErrors.push(t("errorDateRequired"));

    if (formData.story.trim().length < 30) {
      nextErrors.push(t("errorStoryShort"));
    }

    if (Number(formData.amountLost) < 0) {
      nextErrors.push(t("errorAmountNegative"));
    }

    if (formData.proofs.length === 0) {
      nextErrors.push(t("errorProofRequired"));
    }

    if (formData.proofs.includes(OTHER_PROOF_OPTION) && !(formData.customProofs || []).length) {
      nextErrors.push(t("errorOtherProofRequired"));
    }

    if (formData.relief.length === 0) {
      nextErrors.push(t("errorReliefRequired"));
    }

    if (formData.relief.includes(OTHER_RELIEF_OPTION) && !(formData.customReliefs || []).length) {
      nextErrors.push(t("errorOtherReliefRequired"));
    }

    if (nextErrors.length) {
      setErrors(nextErrors);
      return;
    }

    setErrors([]);
    setUpdateMessage("");
    setDraftMessage("");
    setFollowUpAnswers(formData.followUpAnswers || {});
    setEditableDraft(formData.complaintDraft || "");
    setSubmittedCase({ ...formData, followUpAnswers: formData.followUpAnswers || {}, customProofs: formData.customProofs || [], customReliefs: formData.customReliefs || [] });

    setTimeout(() => {
      document
        .getElementById("preview-section")
        ?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }

  function handleUpdatePreviewWithAnswers() {
    setSubmittedCase((prev) => prev ? { ...prev, followUpAnswers } : null);
    setUpdateMessage(t("msgPreviewUpdated"));
  }

  function handleGeneratePdf() {
    if (!submittedCase) return;

    const draft = submittedCase.complaintDraft || editableDraft || generateComplaintDraft({ ...submittedCase, followUpAnswers });
    const now = new Date().toISOString();
    const caseWithLatestAnswers = {
      ...submittedCase,
      followUpAnswers,
      complaintDraft: draft,
      caseId: submittedCase.caseId || `CASE-${Date.now()}`,
      createdAt: submittedCase.createdAt || now,
      updatedAt: now,
      status: normalizeCaseStatus(submittedCase.status),
      language,
      outputMode: getOutputModeForCase(submittedCase),
    };
    try {
      const savedCases = JSON.parse(localStorage.getItem("nyaymitra_saved_cases") || "[]") as CaseData[];
      const withoutDuplicate = savedCases.filter((item) => item.caseId !== caseWithLatestAnswers.caseId);
      localStorage.setItem("nyaymitra_case_data", JSON.stringify(caseWithLatestAnswers));
      localStorage.setItem("nyaymitra_saved_cases", JSON.stringify([caseWithLatestAnswers, ...withoutDuplicate]));
    } catch {}
    router.push("/legal-kit");
  }

  function saveProgress() {
    try {
      localStorage.setItem("nyaymitra_intake_draft", JSON.stringify({ ...formData, followUpAnswers, complaintDraft: editableDraft, language }));
    } catch {}
    setDraftFound(true);
    setProgressMessage(t("msgProgressSaved"));
  }

  function continueDraft() {
    try {
      const saved = localStorage.getItem("nyaymitra_intake_draft");
      if (!saved) return;
      const parsed = JSON.parse(saved) as CaseData;
      setCaseData({ ...parsed, uploadedFiles: parsed.uploadedFiles || [], followUpAnswers: parsed.followUpAnswers || {}, customProofs: parsed.customProofs || [], customReliefs: parsed.customReliefs || [], status: normalizeCaseStatus(parsed.status) });
      setFollowUpAnswers(parsed.followUpAnswers || {});
      setEditableDraft(parsed.complaintDraft || "");
      if (parsed.language) setLanguage(parsed.language);
      setProgressMessage(t("msgDraftLoaded"));
    } catch {}
  }

  function clearDraft() {
    try {
      localStorage.removeItem("nyaymitra_intake_draft");
    } catch {}
    setDraftFound(false);
    setProgressMessage(t("msgDraftCleared"));
  }

  function startFreshCase() {
    try {
      localStorage.removeItem("nyaymitra_case_data");
      localStorage.removeItem("nyaymitra_edit_case");
      localStorage.removeItem("nyaymitra_intake_draft");
    } catch {}
    const fresh: CaseData = { fullName: "", contact: "", caseType: "Cyber Fraud / UPI Scam", stateOrUT: "", story: "", incidentDate: "", amountLost: "", oppositeParty: "", proofs: [], relief: [], customProofs: [], customReliefs: [], uploadedFiles: [] };
    setCaseData(fresh);
    setSubmittedCase(null);
    setFollowUpAnswers({});
    setEditableDraft("");
    setDraftFound(false);
    setIsEditingSavedCase(false);
    setProgressMessage(t("msgFreshCase"));
    setAiState({
      analysis: undefined,
      followupQuestions: [],
      advisorChats: [],
      lastAnalyzedAt: undefined,
    });
  }

  function detectCaseTypeMismatch(caseData: CaseData) {
    const lower = caseData.story.toLowerCase();
    if (caseData.caseType === "Cyber Fraud / UPI Scam" && /(ancestral|land|property|sale deed|revenue record|mutation|khasra|survey|uncle)/i.test(lower)) {
      return t("warnCaseTypeMismatchCyberToProperty");
    }
    if (caseData.caseType === "Property / Land Dispute" && /(upi|transaction|bank sms|cyber|scam|fraud|blocked)/i.test(lower)) {
      return t("warnCaseTypeMismatchPropertyToCyber");
    }
    return "";
  }

  const wizardSteps = [
    { title: t("wizardStepBasic"), instruction: t("wizardStepBasicDesc") },
    { title: t("wizardStepIncident"), instruction: t("wizardStepIncidentDesc") },
    { title: t("wizardStepStory"), instruction: t("wizardStepStoryDesc") },
    { title: t("wizardStepOpposite"), instruction: t("wizardStepOppositeDesc") },
    { title: t("wizardStepProofs"), instruction: t("wizardStepProofsDesc") },
    { title: t("wizardStepRelief"), instruction: t("wizardStepReliefDesc") },
    { title: t("wizardStepReview"), instruction: t("wizardStepReviewDesc") },
  ];

  function readStepAloud() {
    if (!("speechSynthesis" in window)) {
      setVoiceMessage(t("msgVoiceUnsupported"));
      return;
    }

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(wizardSteps[wizardStep].instruction));
    setVoiceMessage("");
  }

  const missingProofs = submittedCase
    ? proofOptions.filter((proof) => proof !== OTHER_PROOF_OPTION && !submittedCase.proofs.includes(proof))
    : [];
  const displayedMissingProofs = submittedCase ? getMissingProofSuggestions(submittedCase, missingProofs) : [];

  const storyWarning = submittedCase ? getStoryQualityWarning(submittedCase) : "";
  const caseTypeMismatch = submittedCase ? detectCaseTypeMismatch(submittedCase) : "";
  const submittedOutputMode = submittedCase ? getCaseOutputMode(submittedCase) : "full-preparation-kit";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 rounded-lg border border-teal-400/20 bg-white/5 p-6 shadow-2xl">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              <button type="button" onClick={() => setMode("full")} className={`rounded-lg px-4 py-2 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-teal-200 ${mode === "full" ? "bg-teal-400 text-slate-950" : "bg-white/10 text-white"}`}>{t("fullMode")}</button>
              <button type="button" onClick={() => setMode("guided")} className={`rounded-lg px-4 py-2 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-teal-200 ${mode === "guided" ? "bg-teal-400 text-slate-950" : "bg-white/10 text-white"}`}>{t("guidedMode")}</button>
              <button type="button" onClick={startFreshCase} className="rounded-lg bg-red-50 px-4 py-2 text-sm font-bold text-red-700 focus:outline-none focus:ring-4 focus:ring-red-100">{t("btnStartFresh")}</button>
            </div>
          </div>
          <p className="text-sm font-semibold text-teal-300">
            {isEditingSavedCase ? "Editing Saved Case" : t("intakePageLabel")}
          </p>

          <h1 className="mt-2 text-3xl font-bold md:text-5xl">
            Universal Legal Case Preparation
          </h1>

          <p className="mt-4 max-w-3xl text-slate-300">
            {t("intakePageDesc")}
          </p>
          <p className="mt-4 rounded-lg bg-slate-900 p-4 text-sm font-semibold text-slate-200">
            {t("disclaimer")}
          </p>
          <div className="mt-4 rounded-lg border border-teal-400/20 bg-slate-900 p-5">
            <h2 className="font-black text-teal-300">{t("labelSafetyNote")}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              {t("labelDisclaimer")}
            </p>
          </div>
        </div>

        {draftFound && !isEditingSavedCase && (
          <div className="mb-6 rounded-lg border border-teal-200 bg-teal-50 p-5 text-slate-950 shadow-xl" aria-live="polite">
            <h2 className="text-xl font-black">{t("msgDraftLoaded")}</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={continueDraft} className="rounded-lg bg-teal-600 px-5 py-3 font-bold text-white">{t("btnContinueDraft")}</button>
              <button type="button" onClick={clearDraft} className="rounded-lg bg-white px-5 py-3 font-bold text-slate-700">{t("btnClearDraft")}</button>
            </div>
          </div>
        )}

        {progressMessage && <p className="mb-6 rounded-lg bg-teal-100 p-4 font-bold text-teal-900" aria-live="polite">{progressMessage}</p>}

        {mode === "guided" && (
          <div className="mb-8 rounded-lg bg-white p-6 text-slate-950 shadow-2xl">
            <div className="h-3 overflow-hidden rounded-lg bg-slate-100"><div className="h-full bg-teal-500" style={{ width: `${((wizardStep + 1) / wizardSteps.length) * 100}%` }} /></div>
            <p className="mt-5 text-sm font-black uppercase tracking-[0.2em] text-teal-700">Step {wizardStep + 1} of {wizardSteps.length}: {wizardSteps[wizardStep].title}</p>
            <h2 className="mt-2 text-3xl font-black">{wizardSteps[wizardStep].title}</h2>
            <p className="mt-2 font-semibold leading-7 text-slate-600">{wizardSteps[wizardStep].instruction}</p>
            <button type="button" onClick={readStepAloud} className="mt-4 rounded-lg bg-slate-950 px-5 py-3 font-bold text-white">{t("readAloud")}</button>
            {voiceMessage && <p className="mt-3 rounded-lg bg-amber-100 p-3 text-sm font-bold text-amber-900" aria-live="polite">{voiceMessage}</p>}

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {wizardStep === 0 && <><Input label={t("fullName")} name="fullName" value={formData.fullName} onChange={handleInputChange} /><Input label={t("contact")} name="contact" value={formData.contact} onChange={handleInputChange} /><Input label={t("stateOrUT")} name="stateOrUT" value={formData.stateOrUT || ""} onChange={handleInputChange} /><div className="md:col-span-2"><CaseTypeSelector selected={formData.caseType} search={caseTypeSearch} onSearch={setCaseTypeSearch} onSelect={selectCaseType} /></div></>}
              {wizardStep === 1 && <><Input label={t("incidentDate")} type="date" name="incidentDate" value={formData.incidentDate} onChange={handleInputChange} max={todayISO} /><Input label={t("amountLost")} type="number" name="amountLost" value={formData.amountLost} onChange={handleInputChange} /></>}
              {wizardStep === 2 && <label className="block md:col-span-2"><span className="mb-2 block font-semibold">{t("story")}</span><textarea name="story" value={formData.story} onChange={handleInputChange} rows={6} className="w-full rounded-lg border p-3 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" /></label>}
              {wizardStep === 2 && formData.story.trim().length >= 30 && (
                <div className="mt-4 md:col-span-2 sticky top-4 z-10">
                  <button
                    type="button"
                    onClick={handleAiAnalyzeStory}
                    className="w-full md:w-auto rounded-lg bg-teal-500 px-4 py-3 font-bold text-slate-950 shadow-lg transition hover:bg-teal-400"
                    disabled={aiLoading === "analyze"}
                  >
                    {aiLoading === "analyze" ? t("aiAnalyzingCase") : t("aiAnalyze")}
                  </button>
                  {aiMessage && <p className={`mt-2 text-sm font-bold ${aiMessage.startsWith("AI could not") || aiMessage.startsWith("OpenRouter") || aiMessage.includes("error") || aiMessage.includes("Error") ? "text-red-600" : "text-teal-700"}`} aria-live="polite">{aiMessage}</p>}
                </div>
              )}
              {wizardStep === 3 && <Input label={t("oppositeParty")} name="oppositeParty" value={formData.oppositeParty} onChange={handleInputChange} />}
              {wizardStep === 4 && <div className="md:col-span-2"><h3 className="mb-3 font-black">{t("proofAvailable")}</h3><div className="grid gap-3 md:grid-cols-2">{proofOptions.map((proof) => <label key={proof} className="flex items-center gap-3 rounded-lg border bg-slate-50 p-3"><input type="checkbox" value={proof} checked={formData.proofs.includes(proof)} onChange={(e) => handleCheckboxChange(e, "proofs")} />{proof}</label>)}</div><CustomItemsEditor type="proof" enabled={formData.proofs.includes(OTHER_PROOF_OPTION)} value={customProofInput} items={formData.customProofs || []} onChange={setCustomProofInput} onAdd={addCustomProof} onRemove={removeCustomProof} /></div>}
              {wizardStep === 5 && <div className="md:col-span-2"><h3 className="mb-3 font-black">{t("reliefWanted")}</h3><div className="grid gap-3 md:grid-cols-2">{reliefOptions.map((item) => <label key={item} className="flex items-center gap-3 rounded-lg border bg-slate-50 p-3"><input type="checkbox" value={item} checked={formData.relief.includes(item)} onChange={(e) => handleCheckboxChange(e, "relief")} />{item}</label>)}</div><CustomItemsEditor type="relief" enabled={formData.relief.includes(OTHER_RELIEF_OPTION)} value={customReliefInput} items={formData.customReliefs || []} onChange={setCustomReliefInput} onAdd={addCustomRelief} onRemove={removeCustomRelief} /></div>}
              {wizardStep === 6 && <div className="md:col-span-2 rounded-lg bg-slate-50 p-5"><p><b>{t("fullName")}:</b> {formData.fullName || "-"}</p><p><b>{t("amountLost")}:</b> ₹{formData.amountLost || "-"}</p><p><b>{t("proofAvailable")}:</b> {formData.proofs.filter((item) => item !== OTHER_PROOF_OPTION).length} standard + {(formData.customProofs || []).length} custom</p><p><b>{t("reliefWanted")}:</b> {[...formData.relief.filter((item) => item !== OTHER_RELIEF_OPTION), ...(formData.customReliefs || [])].join(", ") || "-"}</p></div>}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={() => setWizardStep((step) => Math.max(0, step - 1))} className="rounded-lg bg-slate-100 px-5 py-3 font-bold text-slate-700">{t("previous")}</button>
              <button type="button" onClick={() => setWizardStep((step) => Math.min(wizardSteps.length - 1, step + 1))} className="rounded-lg bg-slate-950 px-5 py-3 font-bold text-white">{t("next")}</button>
              <button type="button" onClick={saveProgress} className="rounded-lg bg-teal-100 px-5 py-3 font-bold text-teal-900">{t("saveProgress")}</button>
              {wizardStep === wizardSteps.length - 1 && <button type="button" onClick={handleGenerate} className="rounded-lg bg-teal-600 px-5 py-3 font-black text-white">{t("generateSummary")}</button>}
            </div>
          </div>
        )}

        {mode === "full" && <div className="rounded-lg border border-white/10 bg-white p-6 text-slate-900 shadow-2xl">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block font-semibold">{t("fullName")}</label>
              <input
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                className="w-full rounded-lg border p-3 outline-none focus:border-teal-500"
                placeholder={t("fullNamePlaceholder")}
              />
            </div>

            <div>
              <label className="mb-2 block font-semibold">{t("contact")}</label>
              <input
                name="contact"
                value={formData.contact}
                onChange={handleInputChange}
                className="w-full rounded-lg border p-3 outline-none focus:border-teal-500"
                placeholder={t("contactPlaceholder")}
              />
            </div>

            <div className="md:col-span-2"><CaseTypeSelector selected={formData.caseType} search={caseTypeSearch} onSearch={setCaseTypeSearch} onSelect={selectCaseType} /></div>

            <div>
              <label className="mb-2 block font-semibold">{t("incidentDate")}</label>
              <input
                type="date"
                name="incidentDate"
                value={formData.incidentDate}
                onChange={handleInputChange}
                max={todayISO}
                className="w-full rounded-lg border p-3 outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="mb-2 block font-semibold">{t("stateOrUT")}</label>
              <input
                name="stateOrUT"
                value={formData.stateOrUT || ""}
                onChange={handleInputChange}
                className="w-full rounded-lg border p-3 outline-none focus:border-teal-500"
                placeholder={t("stateUTPlaceholder")}
              />
            </div>

            <div>
              <label className="mb-2 block font-semibold">{t("amountLost")}</label>
              <input
                type="number"
                name="amountLost"
                value={formData.amountLost}
                onChange={handleInputChange}
                className="w-full rounded-lg border p-3 outline-none focus:border-teal-500"
                placeholder={t("amountLostPlaceholder")}
              />
            </div>

            <div>
              <label className="mb-2 block font-semibold">
                {t("oppositeParty")}
              </label>
              <input
                name="oppositeParty"
                value={formData.oppositeParty}
                onChange={handleInputChange}
                className="w-full rounded-lg border p-3 outline-none focus:border-teal-500"
                placeholder={t("oppositePartyPlaceholder")}
              />
            </div>
          </div>

          <div className="mt-5">
            <label className="mb-2 block font-semibold">{t("story")}</label>
              <textarea
              name="story"
              value={formData.story}
              onChange={handleInputChange}
              rows={5}
              className="w-full rounded-lg border p-3 outline-none focus:border-teal-500"
                placeholder={t("storyPlaceholder")}
              />
            </div>

            {/* AI Analyze button - sticky after story */}
            {formData.story.trim().length >= 30 && (
              <div className="mt-4 sticky top-4 z-10">
                <button
                  type="button"
                  onClick={handleAiAnalyzeStory}
                  className="w-full md:w-auto rounded-lg bg-teal-500 px-4 py-3 font-bold text-slate-950 shadow-lg transition hover:bg-teal-400"
                  disabled={aiLoading === "analyze"}
                >
                  {aiLoading === "analyze" ? t("aiAnalyzingCase") : t("aiAnalyze")}
                </button>
                {aiMessage && <p className={`mt-2 text-sm font-bold ${aiMessage.startsWith("AI could not") || aiMessage.startsWith("OpenRouter") || aiMessage.includes("error") || aiMessage.includes("Error") ? "text-red-600" : "text-teal-700"}`} aria-live="polite">{aiMessage}</p>}
              </div>
            )}

          {formData.caseType === "Other / Not Sure" && (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5 text-slate-950">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-700">{t("otherNotSureFlow")}</p>
              <h2 className="mt-2 text-2xl font-black">{t("explainLegalProblem")}</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="block md:col-span-2"><span className="font-bold">{t("whatHappened")}</span><textarea value={formData.story} onChange={(event) => setCaseData((current) => ({ ...current, story: event.target.value }))} rows={4} className="mt-2 w-full rounded-lg border border-amber-200 bg-white p-3 outline-none focus:border-amber-500" /></label>
                <Input label={t("whoIsInvolved")} name="oppositeParty" value={formData.oppositeParty} onChange={handleInputChange} />
                <Input label={t("whenDidItHappen")} type="date" name="incidentDate" value={formData.incidentDate} onChange={handleInputChange} />
                <label className="block md:col-span-2"><span className="font-bold">{t("urgentDangerOrDeadline")}</span><textarea onChange={(event) => setCaseData((current) => ({ ...current, story: `${current.story}\nUrgency/deadline: ${event.target.value}` }))} rows={2} className="mt-2 w-full rounded-lg border border-amber-200 bg-white p-3 outline-none focus:border-amber-500" /></label>
                <label className="block md:col-span-2"><span className="font-bold">{t("whatDocumentsOrProof")}</span><textarea onChange={(event) => setCaseData((current) => ({ ...current, story: `${current.story}\nDocuments/proof: ${event.target.value}` }))} rows={2} className="mt-2 w-full rounded-lg border border-amber-200 bg-white p-3 outline-none focus:border-amber-500" /></label>
                <label className="block"><span className="font-bold">{t("whatOutcomeDoYouWant")}</span><textarea onChange={(event) => setCaseData((current) => ({ ...current, story: `${current.story}\nOutcome wanted: ${event.target.value}` }))} rows={2} className="mt-2 w-full rounded-lg border border-amber-200 bg-white p-3 outline-none focus:border-amber-500" /></label>
                <label className="block"><span className="font-bold">{t("hasAnythingBeenFiled")}</span><textarea onChange={(event) => setCaseData((current) => ({ ...current, story: `${current.story}\nAlready filed: ${event.target.value}` }))} rows={2} className="mt-2 w-full rounded-lg border border-amber-200 bg-white p-3 outline-none focus:border-amber-500" /></label>
              </div>
              <button type="button" onClick={handleOtherClassification} className="mt-5 rounded-lg bg-amber-500 px-6 py-3 font-black text-slate-950 hover:bg-amber-400">{otherClassifying ? t("aiAnalyzingCase") : t("aiUnderstanding")}</button>
              {formData.aiAnalysis?.classification && <div className="mt-5 rounded-lg bg-white p-4"><h3 className="text-xl font-black">{t("aiClassificationReady")}</h3><div className="mt-3 grid gap-3 md:grid-cols-2"><p><b>{t("probableCaseType")}</b> {formData.aiAnalysis.classification.caseType}</p><p><b>{t("confidence")}</b> {formData.aiAnalysis.classification.confidence}%</p><p><b>{t("outputMode")}</b> {outputModeLabel(formData.aiAnalysis.classification.outputMode)}</p><p><b>{t("riskLevel")}</b> {formData.aiAnalysis.classification.riskLevel}</p><p className="md:col-span-2"><b>{t("riskReason")}</b> {formData.aiAnalysis.classification.riskReason}</p><p className="md:col-span-2"><b>{t("shortSummary")}</b> {formData.aiAnalysis.classification.shortSummary}</p><p className="md:col-span-2"><b>{t("suggestedProofs")}</b> {formData.aiAnalysis.classification.suggestedProofs?.join(", ") || "Not provided"}</p><p className="md:col-span-2"><b>{t("suggestedReliefs")}</b> {formData.aiAnalysis.classification.suggestedReliefs?.join(", ") || "Not provided"}</p><p className="md:col-span-2"><b>{t("missingDetails")}</b> {formData.aiAnalysis.classification.missingDetails?.join(", ") || "Not provided"}</p><p className="md:col-span-2"><b>{t("nextSteps")}</b> {formData.aiAnalysis.classification.nextSteps?.join(", ") || "Not provided"}</p><p><b>{t("lawyerReviewRecommended")}</b> {formData.aiAnalysis.classification.lawyerReviewRecommended ? "Yes" : "No"}</p></div><div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={useSuggestedCaseType} className="rounded-lg bg-teal-600 px-5 py-3 font-bold text-white">{t("useAISuggestedCaseType")}</button><button type="button" className="rounded-lg bg-slate-100 px-5 py-3 font-bold text-slate-700">{t("keepAsOtherNotSure")}</button></div></div>}
            </div>
          )}

          <div className="mt-6">
            <h2 className="mb-3 text-lg font-bold">{t("proofAvailable")}</h2>

            <div className="grid gap-3 md:grid-cols-2">
              {proofOptions.map((proof) => (
                <label
                  key={proof}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border bg-slate-50 p-3 hover:bg-teal-50"
                >
                  <input
                    type="checkbox"
                    value={proof}
                    checked={formData.proofs.includes(proof)}
                    onChange={(e) => handleCheckboxChange(e, "proofs")}
                  />
                  <span>{proof}</span>
                </label>
              ))}
            </div>
            <CustomItemsEditor type="proof" enabled={formData.proofs.includes(OTHER_PROOF_OPTION)} value={customProofInput} items={formData.customProofs || []} onChange={setCustomProofInput} onAdd={addCustomProof} onRemove={removeCustomProof} />
          </div>

          <div className="mt-8 rounded-lg border border-teal-100 bg-gradient-to-br from-slate-950 to-teal-950 p-5 text-white shadow-2xl">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-300">{t("localAnnexureBuilder")}</p>
            <h2 className="mt-2 text-2xl font-black">{t("uploadProofFiles")}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {t("uploadProofFilesDesc")}
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1.2fr_auto] md:items-end">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-100">{t("evidenceCategory")}</span>
                <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className="w-full rounded-lg border border-white/10 bg-white p-3 font-semibold text-slate-950 outline-none focus:border-teal-400">
                  {Array.from(new Set([...uploadCategories, ...(formData.customProofs || [])])).map((category) => <option key={category}>{category}</option>)}
                </select>
              </label>

              <label className="block rounded-lg border border-dashed border-teal-300/60 bg-white/10 p-4">
                <span className="mb-2 block text-sm font-bold text-slate-100">{t("chooseFile")}</span>
                <input type="file" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} className="w-full text-sm text-slate-200 file:mr-4 file:rounded-full file:border-0 file:bg-teal-400 file:px-4 file:py-2 file:font-bold file:text-slate-950" />
                <span className="mt-2 block text-xs text-slate-300">{t("fileMetadataNote")}</span>
              </label>

              <button type="button" onClick={handleAddEvidenceFile} className="rounded-lg bg-teal-400 px-5 py-4 font-black text-slate-950 shadow-lg transition hover:bg-teal-300">
                {t("addEvidenceFile")}
              </button>
            </div>

            {fileError && <p className="mt-4 rounded-lg bg-red-100 p-3 text-sm font-bold text-red-800">{fileError}</p>}

            {formData.uploadedFiles.length > 0 && (
              <div className="mt-6 overflow-x-auto rounded-lg bg-white text-slate-950">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="p-3">{t("annexureNo")}</th>
                      <th className="p-3">{t("fileName")}</th>
                      <th className="p-3">{t("category")}</th>
                      <th className="p-3">{t("type")}</th>
                      <th className="p-3">{t("size")}</th>
                      <th className="p-3">{t("uploadedAt")}</th>
                      <th className="p-3">{t("remove")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.uploadedFiles.map((file, index) => (
                      <tr key={file.id} className="border-t">
                        <td className="p-3 font-black">A{index + 1}</td>
                        <td className="p-3 font-semibold">{file.fileName}</td>
                        <td className="p-3">{file.evidenceCategory}</td>
                        <td className="p-3">{file.fileType}</td>
                        <td className="p-3">{formatFileSize(file.fileSize)}</td>
                        <td className="p-3">{new Date(file.uploadedAt).toLocaleString()}</td>
                        <td className="p-3"><button type="button" onClick={() => handleRemoveEvidenceFile(file.id)} className="rounded-lg bg-red-50 px-3 py-1 font-bold text-red-700">{t("removeBtn")}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-6">
            <h2 className="mb-3 text-lg font-bold">{t("reliefWanted")}</h2>

            <div className="grid gap-3 md:grid-cols-2">
              {reliefOptions.map((item) => (
                <label
                  key={item}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border bg-slate-50 p-3 hover:bg-teal-50"
                >
                  <input
                    type="checkbox"
                    value={item}
                    checked={formData.relief.includes(item)}
                    onChange={(e) => handleCheckboxChange(e, "relief")}
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
            <CustomItemsEditor type="relief" enabled={formData.relief.includes(OTHER_RELIEF_OPTION)} value={customReliefInput} items={formData.customReliefs || []} onChange={setCustomReliefInput} onAdd={addCustomRelief} onRemove={removeCustomRelief} />
          </div>

          {errors.length > 0 && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-5 text-red-800 shadow-lg">
              <h3 className="font-black">{t("pleaseFixDetails")}</h3>
              <ul className="mt-3 space-y-2 text-sm font-semibold">
                {errors.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            className="mt-8 w-full rounded-lg bg-teal-600 px-6 py-4 font-bold text-white shadow-lg transition hover:bg-teal-700"
          >
            {t("generateCaseSummary")}
          </button>
        </div>}

        {submittedCase && (
          <section id="preview-section" className="mt-10 space-y-6">
            <CaseQualityCard result={calculateCaseQualityScore(submittedCase)} />
            <OfficialActionLinks caseData={submittedCase} />

            <div className="rounded-lg border border-teal-400/30 bg-slate-900 p-6 shadow-2xl">
              <p className="text-sm font-semibold text-teal-300">Optional AI layer</p>
              <h2 className="mt-2 text-2xl font-bold">AI Assist</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">Let NyayMitra analyze your story and improve your preparation kit. Rule-based mode still works if AI is unavailable.</p>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <button type="button" onClick={handleAiFollowups} className="rounded-lg bg-white/10 px-4 py-3 font-bold text-white">{aiLoading === "followup" ? t("aiAnalyzingCase") : t("aiFollowups")}</button>
                <button type="button" onClick={handleAiImproveDraft} className="rounded-lg bg-white/10 px-4 py-3 font-bold text-white">{aiLoading === "draft" ? t("aiAnalyzingCase") : t("aiImproveDraft")}</button>
                <button type="button" onClick={handleAiReview} className="rounded-lg bg-white/10 px-4 py-3 font-bold text-white">{aiLoading === "review" ? t("aiAnalyzingCase") : t("aiReview")}</button>
              </div>
              {submittedCase.aiAnalysis && (
                <div className="mt-5 space-y-4">
                  {(submittedCase.aiAnalysis.classification || submittedCase.aiAnalysis.extraction) && (
                    <div className="rounded-lg bg-white p-5 text-slate-950">
                      <h3 className="text-xl font-black">AI Analysis Result</h3>
                      {submittedCase.aiAnalysis.classification && <div className="mt-3 grid gap-3 md:grid-cols-2"><p><b>AI Classified Case Type:</b> {submittedCase.aiAnalysis.classification.caseType}</p><p><b>AI Confidence:</b> {submittedCase.aiAnalysis.classification.confidence}%</p><p><b>AI Output Mode:</b> {outputModeLabel(submittedCase.aiAnalysis.classification.outputMode)}</p><p><b>AI Risk Level:</b> {submittedCase.aiAnalysis.classification.riskLevel}</p><p><b>AI Risk Reason:</b> {submittedCase.aiAnalysis.classification.riskReason}</p><p><b>Lawyer Review:</b> {submittedCase.aiAnalysis.classification.lawyerReviewRecommended ? "Recommended" : "Not specifically flagged"}</p><p className="md:col-span-2"><b>AI Short Summary:</b> {submittedCase.aiAnalysis.classification.shortSummary}</p></div>}
                      {submittedCase.aiAnalysis.extraction && <div className="mt-4 grid gap-4 md:grid-cols-3"><AiBox title="AI Extracted Timeline" items={submittedCase.aiAnalysis.extraction.timeline.map((item) => `${item.date}: ${item.event}`)} /><AiBox title="AI Parties" items={submittedCase.aiAnalysis.extraction.parties} /><AiBox title="AI Missing Details" items={submittedCase.aiAnalysis.extraction.missingDetails} /></div>}
                    </div>
                  )}
                  {submittedCase.aiAnalysis.followupQuestions && <AiBox title="AI Suggested Follow-up Questions" items={submittedCase.aiAnalysis.followupQuestions} />}
                  {submittedCase.aiAnalysis.review && <div className="rounded-lg bg-white p-5 text-slate-950"><h3 className="text-xl font-black">AI Case Review</h3><p className="mt-2"><b>Quality score:</b> {submittedCase.aiAnalysis.review.qualityScore}</p><div className="mt-4 grid gap-4 md:grid-cols-2"><AiBox title="Strengths" items={submittedCase.aiAnalysis.review.strengths} /><AiBox title="Weaknesses" items={submittedCase.aiAnalysis.review.weaknesses} /><AiBox title="Missing proof" items={submittedCase.aiAnalysis.review.missingProof} /><AiBox title="Suggestions" items={submittedCase.aiAnalysis.review.suggestions} /></div></div>}
                  {getVerifiedSourceNotes(submittedCase).length > 0 && <AiBox title="Verified Sources Used" items={getVerifiedSourceNotes(submittedCase).map((source) => `${source.title} - ${source.sourceName}`)} />}
                  {hasLawHallucinationRisk(submittedCase.aiAnalysis, getVerifiedSourceNotes(submittedCase)) && <p className="rounded-lg bg-red-100 p-3 text-sm font-bold text-red-800">{t("kitAiHallucinationRisk")}</p>}
                </div>
              )}
            </div>

            <div className="rounded-lg bg-white p-6 text-slate-950 shadow-2xl">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">Safe preparation guidance</p>
              <h2 className="mt-2 text-3xl font-black">{t("sectionAdvisor")}</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Ask NyayMitra for preparation guidance, possible routes, risks, and next steps. This is not legal advice.</p>
              <p className="mt-3 rounded-lg bg-slate-950 p-4 text-sm font-semibold text-white">NyayMitra can explain preparation options and next steps, but it is not a substitute for a licensed advocate. Please verify important decisions with legal aid or a lawyer.</p>
              <textarea value={advisorQuestion} onChange={(event) => setAdvisorQuestion(event.target.value)} rows={3} className="mt-5 w-full rounded-lg border border-slate-200 bg-slate-50 p-4 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" placeholder="Ask a question about your case preparation... Example: What proof is missing? How should I explain this to the authority?" />
              <button type="button" onClick={handleAskAdvisor} className="mt-4 rounded-lg bg-teal-600 px-6 py-3 font-black text-white hover:bg-teal-700">{advisorLoading ? t("aiThinkingNyayMitra") : t("aiAskAdvisor")}</button>
              {advisorMessage && <p className="mt-3 rounded-lg bg-teal-100 p-3 text-sm font-bold text-teal-900" aria-live="polite">{advisorMessage}</p>}
              {(submittedCase.advisorChats || []).length > 0 && <div className="mt-5 space-y-4">{submittedCase.advisorChats?.map((chat) => <AdvisorChatCard key={chat.id} chat={chat} />)}</div>}
            </div>

            {getLocalizedAmountMismatch(submittedCase) && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-900 shadow-2xl">
                <h2 className="text-xl font-black">{t("labelAmountMismatch")}</h2>
                <p className="mt-2 font-semibold leading-7">{getLocalizedAmountMismatch(submittedCase)}</p>
              </div>
            )}

            {storyWarning && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-2xl">
                <h2 className="text-xl font-black">{t("labelStoryQuality")}</h2>
                <p className="mt-2 font-semibold leading-7">{storyWarning}</p>
              </div>
            )}

            {caseTypeMismatch && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-900 shadow-2xl">
                <h2 className="text-xl font-black">{t("labelCaseTypeMismatch")}</h2>
                <p className="mt-2 font-semibold leading-7">{caseTypeMismatch}</p>
                {submittedCase.caseType === "Cyber Fraud / UPI Scam" && <div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={() => { const next = { ...submittedCase, caseType: "Property / Land Dispute", proofs: [], relief: [], customProofs: [], customReliefs: [], uploadedFiles: [], aiAnalysis: undefined, complaintDraft: "" }; setSubmittedCase(next); setCaseData(next); setEditableDraft(""); }} className="rounded-lg bg-red-600 px-5 py-3 font-bold text-white">Switch to Property / Land Dispute</button></div>}
              </div>
            )}

            <div className="rounded-lg border border-teal-400/30 bg-white/10 p-6 shadow-2xl">
              <p className="mb-2 text-sm font-semibold text-teal-300">
                {t("preview")}
              </p>

              <h2 className="text-3xl font-bold">{t("caseSnapshot")}</h2>

              <p className="mt-4 text-slate-200">
                {Number(submittedCase.amountLost) > 0 ? <>Based on the information provided, this appears to be a <b>{submittedCase.caseType}</b> preparation matter where <b>{submittedCase.fullName}</b> reports a value/loss of <b>₹{submittedCase.amountLost}</b> on <b>{submittedCase.incidentDate}</b>. </> : <>Based on the information provided, this appears to be a <b>{submittedCase.caseType}</b> matter where <b>{submittedCase.fullName}</b> wants help organizing documents and preparing for legal-aid/lawyer review. </>}Opposite party details:{" "}
                <b>{submittedCase.oppositeParty || "Not provided"}</b>. The user wants help with:{" "}
                <b>
                  {[...submittedCase.relief.filter((item) => item !== OTHER_RELIEF_OPTION), ...(submittedCase.customReliefs || [])].length > 0
                    ? [...submittedCase.relief.filter((item) => item !== OTHER_RELIEF_OPTION), ...(submittedCase.customReliefs || [])].join(", ")
                    : "Not selected"}
                </b>
                .
              </p>

              <div className="mt-5 rounded-lg bg-slate-900 p-4 text-sm text-slate-300">
                <b>{t("kitLabelUserStory")}:</b> {submittedCase.story}
              </div>
            </div>

            <div className="rounded-lg border border-teal-400/30 bg-slate-900 p-6 shadow-2xl">
              <p className="text-sm font-semibold text-teal-300">Rule-based preparation assistant</p>
              <h2 className="mt-2 text-2xl font-bold">{t("followUps")}</h2>
              <div className="mt-5 space-y-4">
                {getMergedFollowUpQuestions(submittedCase).map(({ question, source }) => (
                  <label key={question} className="block rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-slate-100">{question}</span>
                      <SourceTag source={source} />
                    </div>
                    <textarea
                      value={followUpAnswers[question] || ""}
                      onChange={(event) => setFollowUpAnswers((current) => ({ ...current, [question]: event.target.value }))}
                      rows={3}
                      className="mt-3 w-full rounded-lg border border-white/10 bg-white p-3 text-slate-950 outline-none focus:border-teal-400"
                      placeholder="Type your answer here..."
                    />
                  </label>
                ))}
              </div>
              <button type="button" onClick={handleUpdatePreviewWithAnswers} className="mt-5 w-full rounded-lg bg-teal-500 px-6 py-4 font-bold text-slate-950 shadow-lg transition hover:bg-teal-400">
                {t("btnUpdatePreview")}
              </button>
              {updateMessage && <p className="mt-3 rounded-lg bg-teal-100 p-3 text-sm font-bold text-teal-900">{updateMessage}</p>}
            </div>

            {submittedCase.followUpAnswers && Object.values(submittedCase.followUpAnswers).some(Boolean) && (
              <div className="rounded-lg bg-white p-6 text-slate-900 shadow-2xl">
                <h2 className="text-2xl font-bold">Follow-up Answers Added</h2>
                <div className="mt-4 space-y-3">
                  {Object.entries(submittedCase.followUpAnswers).filter(([, answer]) => answer.trim()).map(([question, answer]) => (
                    <div key={question} className="rounded-lg bg-slate-50 p-4">
                      <p className="font-black text-teal-700">{question}</p>
                      <p className="mt-2 text-slate-700">{answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg bg-white p-6 text-slate-900 shadow-2xl">
              <h2 className="text-2xl font-bold">{t("timeline")}</h2>

              <div className="mt-5 grid gap-4 md:grid-cols-5">
                <div className="rounded-lg bg-slate-100 p-4">
                  <p className="font-bold">1. Incident</p>
                  <p className="text-sm">{submittedCase.incidentDate}</p>
                </div>

                <div className="rounded-lg bg-slate-100 p-4">
                  <p className="font-bold">2. Loss</p>
                  <p className="text-sm">₹{submittedCase.amountLost}</p>
                </div>

                <div className="rounded-lg bg-slate-100 p-4">
                  <p className="font-bold">3. Evidence</p>
                  <p className="text-sm">
                    {submittedCase.proofs.filter((item) => item !== OTHER_PROOF_OPTION).length} standard + {(submittedCase.customProofs || []).length} custom proof item(s)
                  </p>
                </div>

                <div className="rounded-lg bg-slate-100 p-4">
                  <p className="font-bold">4. Complaint</p>
                  <p className="text-sm">
                    {submittedCase.proofs.includes(
                      "Police/cyber complaint acknowledgement"
                    )
                      ? "Already initiated"
                      : "Not filed yet"}
                  </p>
                </div>

                <div className="rounded-lg bg-teal-100 p-4">
                  <p className="font-bold">5. Next Step</p>
                  <p className="text-sm">{submittedOutputMode === "urgent-legal-aid-route" ? "Prepare consultation note" : "Prepare draft for review"}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-6 text-slate-900 shadow-2xl">
              <h2 className="text-2xl font-bold">{t("evidenceTable")}</h2>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[880px] border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="p-3">{t("kitLabelAnnexureNo")}</th>
                      <th className="p-3">{t("kitLabelEvidence")}</th>
                      <th className="p-3">Available?</th>
                      <th className="p-3">Uploaded File Name</th>
                      <th className="p-3">{t("kitLabelProves")}</th>
                      <th className="p-3">Suggested action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {[...proofOptions.filter((proof) => proof !== OTHER_PROOF_OPTION), ...(submittedCase.customProofs || [])].map((proof) => {
                      const custom = (submittedCase.customProofs || []).includes(proof);
                      const available = submittedCase.proofs.includes(proof);
                      const uploadedFile = submittedCase.uploadedFiles.find((file) => file.evidenceCategory === proof);
                      // Determine if proof is from AI suggestion or rule-based
                      const isAiSuggested = submittedCase.aiAnalysis?.classification?.suggestedProofs?.includes(proof) || false;
                      const source = isAiSuggested ? 'ai' : 'rule';

                      return (
                        <tr key={proof} className="border-b">
                          <td className="p-3 font-black">{uploadedFile ? `A${submittedCase.uploadedFiles.findIndex((file) => file.id === uploadedFile.id) + 1}` : "-"}</td>
                          <td className="p-3 font-semibold flex items-center gap-2">{proof} <SourceTag source={source} /></td>
                          <td className="p-3">
                            {custom || available ? "Yes" : t("kitLabelMissing")}
                          </td>
                          <td className="p-3">
                            {uploadedFile?.fileName || (custom ? "Custom proof added, file not uploaded yet." : available ? "Marked available, file not uploaded yet." : "No file / not marked.")}
                          </td>
                          <td className="p-3">{custom ? "User-provided supporting proof. Meaning should be verified during legal-aid/lawyer review." : evidenceMeaning[proof] || "Supports the facts, timeline, identity, communication, authority history, or requested relief. Verify relevance before relying on it."}</td>
                          <td className="p-3">
                            {custom
                              ? "Keep original copy safe and mention it in consultation/draft."
                              : available
                              ? "Attach this in the final PDF."
                              : "Try to collect this before final PDF."}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-lg bg-white p-6 text-slate-900 shadow-2xl">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">Rule-based draft generator</p>
                  <h2 className="mt-2 text-3xl font-black text-slate-950">{submittedOutputMode === "urgent-legal-aid-route" ? t("sectionDraftLegalAid") : t("editableDraft")}</h2>
                  <p className="mt-2 text-sm font-semibold text-slate-600">Generated locally from your case details. Review and edit before using.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-700">{t("draftLanguageLabel")}:</span>
                    <select value={draftLanguage} onChange={(e) => setDraftLanguage(e.target.value as Language)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-teal-500">
                      <option value="en">{t("draftLangEnglish")}</option>
                      <option value="hi">{t("draftLangHindi")}</option>
                      <option value="hinglish">{t("draftLangHinglish")}</option>
                    </select>
                  </label>
                  <button type="button" onClick={handleGenerateDraftComplaint} className="rounded-lg bg-teal-600 px-5 py-3 font-bold text-white hover:bg-teal-700">{submittedOutputMode === "urgent-legal-aid-route" ? t("btnGenerateLegalAid") : t("btnGenerateDraft")}</button>
                  <button type="button" onClick={handleResetDraft} className="rounded-lg bg-slate-100 px-5 py-3 font-bold text-slate-700 hover:bg-slate-200">{t("btnResetDraft")}</button>
                  <button type="button" onClick={handleCopyDraft} className="rounded-lg bg-slate-950 px-5 py-3 font-bold text-white hover:bg-slate-800">{t("btnCopyDraft")}</button>
                </div>
              </div>

              <textarea
                value={editableDraft}
                onChange={(event) => handleDraftChange(event.target.value)}
                rows={18}
                className="mt-6 w-full rounded-lg border border-slate-200 bg-slate-50 p-5 font-mono text-sm leading-7 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                placeholder={submittedOutputMode === "urgent-legal-aid-route" ? t("msgNoLegalAidDraft") : t("msgNoDraft")}
              />

              {editableDraft && <DraftQualityCard result={analyzeDraftQuality(editableDraft)} />}
              {draftMessage && <p className="mt-4 rounded-lg bg-teal-100 p-3 text-sm font-bold text-teal-900">{draftMessage}</p>}
            </div>

            <div className="rounded-lg bg-white p-6 text-slate-900 shadow-2xl">
              <h2 className="text-2xl font-bold">{t("missingProof")}</h2>

              {displayedMissingProofs.length === 0 ? (
                <p className="mt-3 rounded-lg bg-green-100 p-4">
                  {t("labelNoMissing")}
                </p>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {displayedMissingProofs.map((item) => (
                    <div
                      key={item}
                      className="rounded-lg border border-orange-300 bg-orange-50 p-4 flex items-center gap-2"
                    >
                      <SourceTag source="rule" />
                      <b>{t("labelMissingProofs")}</b> {item}. Try to collect this before final
                      PDF.
                    </div>
                  ))}
                </div>
              )}
              {(submittedCase.customProofs || []).length > 0 && <p className="mt-4 rounded-lg bg-teal-50 p-4 text-sm font-bold text-teal-900">{t("labelCustomProofsNote")}</p>}
            </div>

            <div className="rounded-lg border border-teal-400/30 bg-white/10 p-6 shadow-2xl">
              <h2 className="text-2xl font-bold">{t("riskRouter")}</h2>

              <p className="mt-3 text-xl font-bold text-teal-300">
                {getCaseRiskLabel(submittedCase)}
              </p>

              <p className="mt-3 text-slate-200">
                {submittedOutputMode === "urgent-legal-aid-route"
                  ? "Urgent legal-aid/lawyer review is recommended. NyayMitra will prepare a consultation note and document organizer only."
                  : "This case can be prepared with evidence, timeline, and a draft for review. For serious matters, contact legal aid or a lawyer."}
              </p>

              <p className="mt-4 rounded-lg bg-slate-900 p-4 text-sm text-slate-300">NyayMitra is a legal self-help tool, not a lawyer. Verify with legal aid/lawyer before filing.</p>
            </div>

            <div className="rounded-lg bg-white p-6 text-slate-900 shadow-2xl">
              <h2 className="text-2xl font-bold">{t("sectionNextSteps")}</h2>

              <ul className="mt-4 space-y-2">
                {getNextStepsChecklist(submittedCase).map((step) => <li key={step}>✅ {step}</li>)}
              </ul>

              <button
                type="button"
                onClick={handleGeneratePdf}
                className="mt-6 w-full rounded-lg bg-teal-600 px-6 py-4 font-bold text-white shadow-lg transition hover:bg-teal-700"
              >
                {t("generatePdf")}
              </button>
            </div>
          </section>
        )}
      </section>
    </div>
  );
}

function CaseQualityCard({ result }: { result: { score: number; label: string; suggestions: string[] } }) {
  const strong = result.score >= 70;
  const moderate = result.score >= 40 && result.score < 70;
  const color = strong ? "bg-teal-500" : moderate ? "bg-amber-500" : "bg-orange-500";

  return (
    <div className="rounded-lg bg-white p-6 text-slate-900 shadow-2xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">Case Quality Score</p>
          <h2 className="mt-2 text-3xl font-black">{result.score}/100</h2>
          <p className="mt-1 font-bold text-slate-600">{result.label}</p>
        </div>
        <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100 md:w-72">
          <div className={`h-full ${color}`} style={{ width: `${result.score}%` }} />
        </div>
      </div>
      <div className={`mt-5 rounded-lg p-4 ${strong ? "bg-teal-50 text-teal-900" : "bg-amber-50 text-amber-900"}`}>
        {strong ? (
          <p className="font-semibold">Good preparation. Still verify with legal aid/lawyer before filing.</p>
        ) : (
          <ul className="space-y-2 text-sm font-semibold">
            {result.suggestions.map((item) => <li key={item}>{item}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}

function DraftQualityCard({ result }: { result: { score: number; suggestions: string[] } }) {
  const strong = result.score >= 70;

  return (
    <div className="mt-5 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">Draft Completeness Score</p>
          <h3 className="mt-1 text-2xl font-black text-slate-950">{result.score}/100</h3>
        </div>
        <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100 md:w-80">
          <div className={`h-full ${strong ? "bg-teal-500" : "bg-amber-500"}`} style={{ width: `${result.score}%` }} />
        </div>
      </div>
      {result.suggestions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {result.suggestions.map((suggestion) => <span key={suggestion} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">{suggestion}</span>)}
        </div>
      )}
    </div>
  );
}

function AiBox({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
      <h3 className="font-black text-teal-700">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.filter(Boolean).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
      </ul>
    </div>
  );
}

function AdvisorChatCard({ chat }: { chat: AdvisorChat }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-center gap-2 mb-2">
        <p className="font-black text-slate-950">Q: {chat.question}</p>
        <SourceTag source="ai" />
      </div>
      <p className="mt-3 leading-7 text-slate-700">{chat.answer}</p>
      {chat.lawyerReviewRecommended && <p className="mt-3 rounded-lg bg-red-100 p-3 text-sm font-black text-red-800">Legal-aid/lawyer review strongly recommended.</p>}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <AiBox title="Next steps" items={chat.nextSteps} />
        <AiBox title="Missing info" items={chat.missingInfo.length ? chat.missingInfo : ["No specific missing info listed."]} />
      </div>
      <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-900">{chat.riskNote}</p>
    </div>
  );
}

function OfficialActionLinks({ caseData }: { caseData: CaseData }) {
  const suggestions = buildOfficialActionSuggestions(caseData);

  return (
    <div className="rounded-lg border border-teal-300/30 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-6 shadow-2xl">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-300">Official action link</p>
      <h2 className="mt-2 text-3xl font-black text-white">Official Action Links</h2>
      <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-300">Based on your case type, these official portals may help you report, track, or seek support.</p>
      {suggestions.showEmergency && <p className="mt-4 rounded-lg border border-orange-300/40 bg-orange-500/15 p-4 text-sm font-bold text-orange-100">If there is immediate danger, call 112 or contact local emergency services immediately.</p>}
      <p className="mt-4 rounded-lg bg-white/10 p-4 text-sm font-semibold text-slate-200">{suggestions.stateMessage}</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {suggestions.portals.map((portal) => <PortalCard key={portal.id} portal={portal} />)}
      </div>
      <p className="mt-5 rounded-lg bg-slate-950 p-4 text-sm font-semibold text-slate-200">NyayMitra provides official links for convenience. Portal eligibility, FIR registration, and complaint handling depend on the concerned authority and applicable procedure.</p>
    </div>
  );
}

function CaseTypeSelector({ selected, search, onSearch, onSelect }: { selected: string; search: string; onSearch: (value: string) => void; onSelect: (caseType: string) => void }) {
  const { language } = useLanguage();
  const t = (key: string) => translate(language, key as keyof typeof import("@/lib/i18n").translations.en);
  const normalizedSearch = search.trim().toLowerCase();
  const matches = caseConfigs.filter((config) => {
    const aliases = caseTypeAliases[config.caseType] || [];
    return config.caseType !== "Other / Not Sure" && (config.caseType.toLowerCase().includes(normalizedSearch) || aliases.some((alias) => alias.includes(normalizedSearch) || normalizedSearch.includes(alias)));
  });
  const visible = normalizedSearch ? matches : caseConfigs.filter((config) => config.caseType !== "Other / Not Sure");

  const getDisplayCaseType = (config: typeof caseConfigs[0]) => {
    if (language === "hi") return config.caseTypeHi;
    if (language === "hinglish") return config.caseTypeHinglish;
    return config.caseType;
  };

  const fallbackConfig = {
    caseType: selected,
    caseTypeHi: selected,
    caseTypeHinglish: selected,
    proofs: [],
    relief: [],
    outputMode: "limited-guidance-kit" as const,
    riskMessage: "",
  };

  return (
    <div className="rounded-lg border border-teal-100 bg-slate-50 p-5">
      <label className="block"><span className="mb-2 block font-black text-teal-800">{t("caseType")}</span><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={t("filterSearchPlaceholder")} className="w-full rounded-lg border border-slate-200 bg-white p-3 font-semibold outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" /></label>
      <p className="mt-3 inline-flex rounded-full bg-teal-100 px-3 py-1 text-xs font-black text-teal-800">{t("filterSelected")}: {getDisplayCaseType(caseConfigs.find(c => c.caseType === selected) || fallbackConfig)}</p>
      <div className="mt-4 grid max-h-72 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
        {visible.map((config) => <button key={config.caseType} type="button" onClick={() => onSelect(config.caseType)} className={`rounded-lg border p-3 text-left text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-teal-100 ${selected === config.caseType ? "border-teal-500 bg-teal-600 text-white" : "border-slate-200 bg-white text-slate-800 hover:border-teal-300"}`}>{getDisplayCaseType(config)}</button>)}
      </div>
      {normalizedSearch && matches.length === 0 && <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm font-bold text-amber-900">{t("filterNoMatch")}</p>}
      <button type="button" onClick={() => onSelect("Other / Not Sure")} className={`mt-4 w-full rounded-lg border p-4 text-left font-black focus:outline-none focus:ring-4 focus:ring-teal-100 ${selected === "Other / Not Sure" ? "border-amber-500 bg-amber-500 text-slate-950" : "border-amber-200 bg-amber-50 text-amber-900"}`}>{t("filterOther")}</button>
    </div>
  );
}

function CustomItemsEditor({ type, enabled, value, items, onChange, onAdd, onRemove }: { type: "proof" | "relief"; enabled: boolean; value: string; items: string[]; onChange: (value: string) => void; onAdd: () => void; onRemove: (value: string) => void }) {
  if (!enabled && items.length === 0) return null;
  const isProof = type === "proof";
  return (
    <div className="mt-5 rounded-lg border border-teal-100 bg-teal-50 p-5">
      <label className="block"><span className="mb-2 block font-black text-teal-900">{isProof ? "Describe other proof/document" : "Describe other relief/outcome"}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={isProof ? "Example: old land papers, family documents, sale deed photo, revenue record, notice copy, witness details..." : "Example: stop sale, claim share, refund, apology, document correction, authority action, legal review..."} className="w-full rounded-lg border border-teal-200 bg-white p-3 font-semibold outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" /></label>
      <button type="button" onClick={onAdd} className="mt-3 rounded-lg bg-teal-600 px-5 py-3 font-black text-white hover:bg-teal-700">{isProof ? "Add Custom Proof" : "Add Custom Relief"}</button>
      {items.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{items.map((item) => <span key={item} className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow"><span>{item}</span><button type="button" onClick={() => onRemove(item)} className="rounded-lg bg-red-50 px-2 py-1 text-xs font-black text-red-700">Remove</button></span>)}</div>}
    </div>
  );
}

function Input({ label, name, value, onChange, type = "text", max }: { label: string; name: string; value: string; onChange: (event: React.ChangeEvent<HTMLInputElement>) => void; type?: string; max?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block font-semibold">{label}</span>
      <input name={name} type={type} value={value} onChange={onChange} max={max} className="w-full rounded-lg border p-3 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" />
    </label>
  );
}
