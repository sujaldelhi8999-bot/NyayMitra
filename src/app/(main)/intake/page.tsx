"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { aiAskAdvisor, aiClassifyCase, aiExtractFacts, aiGenerateDraft, aiGenerateFollowups, aiReviewCase, type AiClientError } from "@/lib/aiClient";
import { caseConfigs, getCaseConfig, highRiskCaseTypes, outputModeLabel, resolveOutputMode, type OutputMode } from "@/lib/caseConfig";
import { getInitialLanguage, type Language, translate } from "@/lib/i18n";
import { buildOfficialActionSuggestions } from "@/lib/officialPortals";
import type { OfficialPortal } from "@/data/officialPortals";

type FormData = {
  fullName: string;
  contact: string;
  caseType: string;
  stateOrUT?: string;
  story: string;
  incidentDate: string;
  amountLost: string;
  oppositeParty: string;
  proofs: string[];
  relief: string[];
  customProofs?: string[];
  customReliefs?: string[];
  followUpAnswers?: Record<string, string>;
  uploadedFiles: UploadedFile[];
  complaintDraft?: string;
  caseId?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  language?: Language;
  outputMode?: string;
  aiAnalysis?: {
    classification?: AiClassification;
    extraction?: AiExtraction;
    followupQuestions?: string[];
    review?: AiReview;
    generatedDraft?: string;
    lastAnalyzedAt?: string;
  };
  advisorChats?: AdvisorChat[];
};

type VerifiedSource = { title: string; sourceName: string; sourceUrl: string };
type AdvisorChat = { id: string; question: string; answer: string; nextSteps: string[]; missingInfo: string[]; riskNote: string; lawyerReviewRecommended: boolean; createdAt: string; verifiedSourcesUsed?: VerifiedSource[] };
type AdvisorAnswer = Omit<AdvisorChat, "id" | "question" | "createdAt">;

type AiClassification = { caseType: string; confidence: number; outputMode: OutputMode; riskLevel: "Low Risk" | "Medium Risk" | "High Risk"; riskReason: string; shortSummary: string; suggestedProofs: string[]; suggestedReliefs: string[]; missingDetails: string[]; nextSteps: string[]; lawyerReviewRecommended: boolean };
type AiExtraction = { caseSummary: string; timeline: { date: string; event: string }[]; parties: string[]; evidenceMentioned: string[]; missingDetails: string[] };
type AiReview = { qualityScore: number; strengths: string[]; weaknesses: string[]; missingProof: string[]; suggestions: string[]; verifiedSourcesUsed?: VerifiedSource[] };

type UploadedFile = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  evidenceCategory: string;
  uploadedAt: string;
};

const uploadCategories = Array.from(new Set(caseConfigs.flatMap((config) => config.proofs).concat("Other supporting proof")));

const storyKeywords = ["whatsapp", "upi", "payment", "paid", "blocked", "message", "scam", "fraud", "transaction", "bank", "job", "refund"];
const propertyKeywords = ["property", "land", "grandfather", "ancestral", "sale deed", "revenue", "mutation", "tax", "possession", "court", "case", "khasra", "survey", "plot", "family"];
const consumerKeywords = ["order", "invoice", "refund", "replacement", "damaged", "defective", "delivery", "seller", "platform", "customer support", "product"];
const rtiKeywords = ["department", "application", "receipt", "acknowledgement", "delay", "certificate", "government", "follow-up", "rti", "service"];

const OTHER_PROOF_OPTION = "Other proof / document";
const OTHER_RELIEF_OPTION = "Other relief / outcome";
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
  const [formData, setFormData] = useState<FormData>({
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

  const [submittedCase, setSubmittedCase] = useState<FormData | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [followUpAnswers, setFollowUpAnswers] = useState<Record<string, string>>({});
  const [updateMessage, setUpdateMessage] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(uploadCategories[0]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [editableDraft, setEditableDraft] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [isEditingSavedCase, setIsEditingSavedCase] = useState(false);
  const [language, setLanguage] = useState<Language>("en");
  const [mode, setMode] = useState<"full" | "guided">("full");
  const [wizardStep, setWizardStep] = useState(0);
  const [draftFound, setDraftFound] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  const [voiceMessage, setVoiceMessage] = useState("");
  const [aiLoading, setAiLoading] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [lastAiMode, setLastAiMode] = useState("");
  const [lastAiError, setLastAiError] = useState("");
  const [lastAiDebug, setLastAiDebug] = useState<unknown>(null);
  const [extraFollowUpQuestions, setExtraFollowUpQuestions] = useState<string[]>([]);
  const [advisorQuestion, setAdvisorQuestion] = useState("");
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorMessage, setAdvisorMessage] = useState("");
  const [otherClassifying, setOtherClassifying] = useState(false);
  const [caseTypeSearch, setCaseTypeSearch] = useState("");
  const [customProofInput, setCustomProofInput] = useState("");
  const [customReliefInput, setCustomReliefInput] = useState("");
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const currentCaseConfig = getCaseConfig(formData.caseType);
  const suggestedProofs = formData.aiAnalysis?.classification?.suggestedProofs || [];
  const suggestedReliefs = formData.aiAnalysis?.classification?.suggestedReliefs || [];
  const proofKeys = ["proofWhatsApp", "proofUPI", "proofBankSMS", "proofPhone", "proofEmail", "proofPolice"] as const;
  const reliefKeys = ["reliefRefund", "reliefPolice", "reliefCyber", "reliefBank", "reliefLegalAid"] as const;
  const defaultProofOpts = proofKeys.map((k) => t(k));
  const defaultReliefOpts = reliefKeys.map((k) => t(k));
  const proofOptions = Array.from(new Set([...(currentCaseConfig.proofs || defaultProofOpts), ...(formData.caseType === "Other / Not Sure" ? suggestedProofs : []), OTHER_PROOF_OPTION]));
  const reliefOptions = Array.from(new Set([...(currentCaseConfig.relief || defaultReliefOpts), ...(formData.caseType === "Other / Not Sure" ? suggestedReliefs : []), OTHER_RELIEF_OPTION]));
  const evidenceMeaningKeysLocal: Record<string, string> = {
    "proofWhatsApp": "evidenceMeaningWhatsApp",
    "proofUPI": "evidenceMeaningUPI",
    "proofBankSMS": "evidenceMeaningBankSMS",
    "proofPhone": "evidenceMeaningPhone",
    "proofEmail": "evidenceMeaningEmail",
    "proofPolice": "evidenceMeaningPolice",
    "Property papers": "May help identify title/ownership history, subject to legal verification.",
    "Mutation/tax records": "May help show revenue/tax entries, but these need legal review.",
    "Photos": "May help show possession, boundary, condition, or dispute context.",
    "Notices": "May help show prior legal communication or dispute history.",
    "Messages / emails": "May help show admissions, threats, negotiations, or timeline.",
    "Witness details": "May help identify people who know the property history or possession facts.",
    "Timeline notes": "Helps legal aid/lawyer understand events in order.",
    [OTHER_PROOF_OPTION]: "evidenceMeaningOther",
  };
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

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    localStorage.setItem("nyaymitra_language", nextLanguage);
  }

  useEffect(() => {
    window.setTimeout(() => {
      setLanguage(getInitialLanguage());
      if (searchParams.get("edit") !== "true") return;

      const saved = localStorage.getItem("nyaymitra_edit_case");
      if (!saved) return;

      const parsed = JSON.parse(saved) as FormData;
      const nextCase = { ...parsed, uploadedFiles: parsed.uploadedFiles || [], followUpAnswers: parsed.followUpAnswers || {}, customProofs: parsed.customProofs || [], customReliefs: parsed.customReliefs || [] };
      setFormData(nextCase);
      setFollowUpAnswers(nextCase.followUpAnswers || {});
      setEditableDraft(nextCase.complaintDraft || "");
      setSubmittedCase(nextCase);
      setIsEditingSavedCase(true);
    }, 0);
  }, [searchParams]);

  useEffect(() => {
    window.setTimeout(() => {
      if (searchParams.get("edit") === "true") return;
      setDraftFound(Boolean(localStorage.getItem("nyaymitra_intake_draft")));
    }, 0);
  }, [searchParams]);

  function handleInputChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleCheckboxChange(
    e: React.ChangeEvent<HTMLInputElement>,
    field: "proofs" | "relief"
  ) {
    const { value, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [field]: checked
        ? [...prev[field], value]
        : prev[field].filter((item) => item !== value),
    }));
  }

  function selectCaseType(caseType: string) {
    setFormData((prev) => ({
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
    setLastAiError("");
  }

  function addCustomProof() {
    const values = splitCustomItems(customProofInput);
    if (!values.length) return;
    setFormData((prev) => ({ ...prev, customProofs: Array.from(new Set([...(prev.customProofs || []), ...values])) }));
    setCustomProofInput("");
  }

  function removeCustomProof(value: string) {
    setFormData((prev) => ({ ...prev, customProofs: (prev.customProofs || []).filter((item) => item !== value) }));
  }

  function addCustomRelief() {
    const values = splitCustomItems(customReliefInput);
    if (!values.length) return;
    setFormData((prev) => ({ ...prev, customReliefs: Array.from(new Set([...(prev.customReliefs || []), ...values])) }));
    setCustomReliefInput("");
  }

  function removeCustomRelief(value: string) {
    setFormData((prev) => ({ ...prev, customReliefs: (prev.customReliefs || []).filter((item) => item !== value) }));
  }

  function splitCustomItems(value: string) {
    return value.split(/[\n,;]+/).map((item) => item.trim().replace(/^[-*•]\s*/, "")).filter(Boolean);
  }

  function calculateRiskLevel(amount: string) {
    const value = Number(amount);

    if (value > 50000) return "High Risk";
    if (value > 10000) return "Medium Risk";
    return "Low Risk";
  }

  function getCaseOutputMode(caseData: FormData) {
    return resolveOutputMode(caseData.caseType, caseData.story, caseData.aiAnalysis?.classification?.caseType, caseData.aiAnalysis?.classification?.outputMode);
  }

  function getCaseRiskLabel(caseData: FormData) {
    if (getCaseOutputMode(caseData) === "urgent-legal-aid-route") return "High Risk / Legal Review Required";
    return calculateRiskLevel(caseData.amountLost);
  }

  function formatFileSize(size: number) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function countCaseUsefulKeywords(caseData: FormData) {
    const lowerStory = caseData.story.toLowerCase();
    const keywords = caseData.caseType === "Property / Land Dispute" ? propertyKeywords : caseData.caseType === "Consumer Complaint" ? consumerKeywords : caseData.caseType === "RTI / Government Service Delay" ? rtiKeywords : storyKeywords;
    return keywords.filter((keyword) => lowerStory.includes(keyword)).length;
  }

  function hasTooManyRandomSymbols(story: string) {
    if (!story.trim()) return false;
    const symbolMatches = story.match(/[^a-zA-Z0-9\s.,₹@/-]/g) || [];
    return symbolMatches.length / story.length > 0.15;
  }

  function getStoryQualityWarning(caseData: FormData) {
    if (caseData.story.trim().length >= 80 && countCaseUsefulKeywords(caseData) < 3) {
      if (caseData.caseType === "Property / Land Dispute") return "Your story is long but may not clearly explain the property history. Please describe the property location, relationship to original owner, documents, dispute timeline, and urgent sale/possession issues.";
      if (caseData.caseType === "Consumer Complaint") return "Your story is long but may not clearly explain the consumer issue. Please describe order ID, seller/platform, purchase/delivery dates, defect or service issue, complaint history, and refund/replacement request.";
      if (caseData.caseType === "RTI / Government Service Delay") return "Your story is long but may not clearly explain the government-service delay. Please describe department name, application number, application date, delay period, acknowledgement, and what action/information is needed.";
      return "Your story is long but may not clearly explain the incident. Please describe who contacted you, how payment happened, amount lost, and what happened after payment.";
    }

    return "";
  }

  function detectAmountMismatch(caseData: FormData) {
    const fieldAmount = Number(caseData.amountLost);
    const matches = Array.from(caseData.story.matchAll(/(?:₹|rs\.?|inr)?\s*([0-9][0-9,]*(?:\.\d+)?)/gi));
    const storyAmounts = matches.map((match) => Number(match[1].replace(/,/g, ""))).filter((amount) => amount > 0);
    const differentAmount = storyAmounts.find((amount) => fieldAmount > 0 && amount !== fieldAmount);

    if (!differentAmount) return "";

    return `Amount mismatch detected: the amount field says ₹${caseData.amountLost}, but the story mentions ₹${differentAmount}. Please verify before generating PDF.`;
  }

  function getVerifiedSources(caseData: FormData) {
    const sources = [
      ...(caseData.aiAnalysis?.review?.verifiedSourcesUsed || []),
      ...(caseData.advisorChats || []).flatMap((chat) => chat.verifiedSourcesUsed || []),
    ];
    return Array.from(new Map(sources.map((source) => [source.sourceUrl + source.title, source])).values());
  }

  function hasLawHallucinationRisk(text: string, sources: VerifiedSource[]) {
    return /\b(Section|IPC|BNS|BNSS|BSA|Act)\b/i.test(text) && sources.length === 0;
  }

  function generateComplaintDraft(caseData: FormData) {
    const today = new Date().toISOString().split("T")[0];
    const standardProofs = caseData.proofs.filter((proof) => proof !== OTHER_PROOF_OPTION);
    const proofList = standardProofs.length ? standardProofs.map((proof, index) => `${index + 1}. ${proof}`).join("\n") : "1. Evidence to be added";
    const customProofList = caseData.customProofs?.length ? `\n\nCustom proofs:\n${caseData.customProofs.map((proof, index) => `${index + 1}. ${proof}`).join("\n")}` : "";
    const annexures = caseData.uploadedFiles.length ? caseData.uploadedFiles.map((file, index) => `A${index + 1} - ${file.fileName} - ${file.evidenceCategory}`).join("\n") : "No uploaded annexures added yet.";
    const followUps = Object.entries(caseData.followUpAnswers || {}).filter(([, answer]) => answer.trim()).map(([question, answer]) => `- ${question}\n  ${answer}`).join("\n") || "No additional follow-up answers provided.";
    const combinedReliefs = [...caseData.relief.filter((item) => item !== OTHER_RELIEF_OPTION), ...(caseData.customReliefs || [])];
    const reliefList = combinedReliefs.length ? combinedReliefs.map((relief, index) => `${index + 1}. ${relief}`).join("\n") : "1. Relief to be confirmed";

    const outputMode = resolveOutputMode(caseData.caseType, caseData.story, caseData.aiAnalysis?.classification?.caseType, caseData.aiAnalysis?.classification?.outputMode);
    if (outputMode === "urgent-legal-aid-route") {
      return `Legal Aid Consultation Note

This is not a final complaint or defence strategy. This matter should be reviewed urgently by legal aid or a licensed advocate.

Name: ${caseData.fullName}
Contact: ${caseData.contact}
Case type: ${caseData.caseType}
Incident date: ${caseData.incidentDate}

Short facts:
${caseData.story}

Timeline:
- Incident/date known: ${caseData.incidentDate || "Not provided"}
- Opposite party/person/authority: ${caseData.oppositeParty || "Not provided"}
- Reported amount/value: Rs. ${caseData.amountLost || "0"}

Safety concern:
This case is routed as urgent/high-risk based on the case type or facts shared. If there is immediate danger, contact emergency services first.

Documents / proof to organize:
Standard proofs:
${proofList}${customProofList}

Custom document safety note:
Custom documents are user-provided and should be verified before filing or relying on them.

Uploaded annexures:
${annexures}

Questions for legal aid/lawyer:
1. What urgent protection, court, or procedural steps are available based on verified documents?
2. Which documents should be carried for review?
3. What deadlines or risks should be checked immediately?

Urgent next steps:
1. Contact legal aid/lawyer as soon as possible.
2. Keep original documents, messages, photos, and acknowledgements safe.
3. If there is immediate danger, call 112 or contact local emergency services.

Safety note:
Lawyer/legal-aid review is required. NyayMitra can help organize documents but does not provide legal advice, defence strategy, or guarantee any result.

Date: ${today}`;
    }

    if (outputMode === "limited-guidance-kit") {
      return `Draft Representation for Review

This is a preparation draft for legal-aid/lawyer or authority review. It is not legal advice and does not guarantee any result.

User details:
Name: ${caseData.fullName}
Contact: ${caseData.contact}
Case type: ${caseData.caseType}

Facts summary:
${caseData.story}

Timeline:
- Incident date: ${caseData.incidentDate}
- Opposite party: ${caseData.oppositeParty || "Not provided"}
- Reported amount/value: Rs. ${caseData.amountLost || "0"}

Evidence list:
Standard proofs:
${proofList}${customProofList}

Custom document safety note:
Custom documents are user-provided and should be verified before filing or relying on them.

Uploaded annexures:
${annexures}

Relief / outcome requested:
${reliefList}

Questions for legal aid/lawyer:
1. Which authority or forum is appropriate based on the documents?
2. What deadline, notice, or limitation issue should be checked?
3. What proof is missing before any filing or representation?
4. What safe next step should be taken without escalating risk?

Review warning:
Please verify this draft with legal aid/lawyer or official sources before using it.

Date: ${today}`;
    }

    return `To,
The Cyber Crime Cell / Police Station / Concerned Authority

Subject:
Complaint / application regarding ${caseData.caseType}

Respected Sir/Madam,

I, ${caseData.fullName}, wish to submit this complaint/application regarding ${caseData.caseType}.

On ${caseData.incidentDate}, I was contacted by ${caseData.oppositeParty || "the opposite party / suspected person"}. Based on my statement, the incident happened as follows:

${caseData.story}

An amount of ₹${caseData.amountLost} was lost/transferred in connection with the above incident.

Evidence available:
Standard proofs:
${proofList}${customProofList}

Custom document safety note:
Custom documents are user-provided and should be verified before filing or relying on them.

Uploaded annexures:
${annexures}

Additional details from follow-up:
${followUps}

Relief requested:
${reliefList}

I request the concerned authority to kindly record my complaint, examine the transaction details, take appropriate action as per law, and guide me regarding the next steps.

I understand that this is a draft complaint prepared for case organization and should be verified with legal aid/lawyer or concerned authority before filing.

Declaration:
The information stated above is true to the best of my knowledge.

Name: ${caseData.fullName}
Contact: ${caseData.contact}
Date: ${today}`;
  }

  function analyzeDraftQuality(draftText: string) {
    const lowerDraft = draftText.toLowerCase();
    const hasSubject = lowerDraft.includes("subject:");
    const hasIncidentDate = Boolean(submittedCase?.incidentDate && draftText.includes(submittedCase.incidentDate));
    const hasAmount = Boolean(submittedCase?.amountLost && draftText.includes(submittedCase.amountLost));
    const hasEvidence = lowerDraft.includes("evidence") || lowerDraft.includes("annexure");
    const hasRelief = lowerDraft.includes("relief requested") || lowerDraft.includes("relief");
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
    const nextDraft = generateComplaintDraft(submittedCase);
    setEditableDraft(nextDraft);
    setSubmittedCase({ ...submittedCase, complaintDraft: nextDraft });
    setDraftMessage("");
  }

  function handleResetDraft() {
    setEditableDraft("");
    setDraftMessage("");
    if (submittedCase) setSubmittedCase({ ...submittedCase, complaintDraft: "" });
  }

  function handleDraftChange(value: string) {
    setEditableDraft(value);
    if (submittedCase) setSubmittedCase({ ...submittedCase, complaintDraft: value });
  }

  async function handleCopyDraft() {
    if (!editableDraft) return;
    await navigator.clipboard.writeText(editableDraft);
    setDraftMessage("Draft copied to clipboard.");
  }

  function handleAddEvidenceFile() {
    if (!selectedFile) {
      setFileError("Please choose a file before adding evidence.");
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

    setFormData((current) => ({
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
    setFormData((current) => ({
      ...current,
      uploadedFiles: current.uploadedFiles.filter((file) => file.id !== fileId),
    }));
  }

  function generateFollowUpQuestions(caseData: FormData) {
    if (caseData.caseType === "Property / Land Dispute") {
      return Array.from(new Set([
        "What is the property location and basic property identifier, if known?",
        "What is your relationship to the original owner?",
        "Do you have sale deed/title papers or old land records?",
        "Do you have revenue/mutation/tax records?",
        "Is there any ongoing or old court case? If yes, do you know case number/court name?",
        "Is there any urgent sale, transfer, eviction, or possession issue?",
        "What exact help do you want from legal aid/lawyer?",
        ...(caseData.aiAnalysis?.followupQuestions || []),
        ...extraFollowUpQuestions,
      ]));
    }

    if (caseData.caseType === "Consumer Complaint") {
      return Array.from(new Set([
        "What is the order ID or invoice number?",
        "Who is the seller/platform/service provider?",
        "What was the date of purchase and delivery/service?",
        "What exactly was defective, damaged, delayed, or not provided?",
        "Have you requested refund, replacement, or written response already?",
        "Do you have complaint emails, chats, support tickets, invoice, photos, or delivery proof?",
        ...(caseData.aiAnalysis?.followupQuestions || []),
        ...extraFollowUpQuestions,
      ]));
    }

    if (caseData.caseType === "RTI / Government Service Delay" || caseData.caseType === "Government Document / Certificate Issue") {
      return Array.from(new Set([
        "What is the department or public authority name?",
        "What is the application/reference/receipt number?",
        "What was the date of application?",
        "How long has the matter been delayed?",
        "Do you have acknowledgement, receipt, or application copy?",
        "What previous follow-ups or reminders have you sent?",
        "What information, certificate, service, or action do you need now?",
        ...(caseData.aiAnalysis?.followupQuestions || []),
        ...extraFollowUpQuestions,
      ]));
    }

    const questions: string[] = [];
    const oppositeParty = caseData.oppositeParty.toLowerCase();
    const story = caseData.story.toLowerCase();

    if (!oppositeParty.includes("upi") && !oppositeParty.includes("@")) {
      questions.push("Do you know the receiver UPI ID or bank account details?");
    }

    if (!story.includes("utr") && !story.includes("transaction")) {
      questions.push("Do you have the UTR / transaction ID of the payment?");
    }

    if (!caseData.proofs.includes("Police/cyber complaint acknowledgement")) {
      questions.push("Have you already filed a cybercrime portal or police complaint?");
    }

    if (!caseData.proofs.includes("Bank SMS")) {
      questions.push("Do you have a bank SMS, bank statement entry, or debit alert?");
    }

    if (Number(caseData.amountLost) > 10000) {
      questions.push("Have you contacted your bank to request transaction dispute or freeze support?");
    }

    if (caseData.story.trim().length < 80) {
      questions.push("Can you explain the sequence of events in more detail?");
    }

    questions.push("What exact relief do you want: refund, complaint registration, bank action, or legal aid guidance?");

    return Array.from(new Set([...questions, ...(caseData.aiAnalysis?.followupQuestions || []), ...extraFollowUpQuestions]));
  }

  function getNextStepsChecklist(caseData: FormData) {
    if (getCaseOutputMode(caseData) === "urgent-legal-aid-route" && caseData.caseType === "Property / Land Dispute") {
      return [
        "Keep original property papers safe.",
        "Make a date-wise timeline of ownership and dispute.",
        "Collect sale deed/title documents if available.",
        "Collect revenue/mutation/tax records if available.",
        "Note property location and identifiers.",
        "Collect notices/court papers/case number if any.",
        "Do not sign or submit anything without legal review.",
        "Approach legal aid/lawyer with the consultation note.",
      ];
    }
    if (getCaseOutputMode(caseData) === "urgent-legal-aid-route") {
      return ["Keep original documents safe.", "Write a date-wise timeline.", "Collect notices/court/police papers if any.", "Do not sign or submit anything without legal review.", "Approach legal aid/lawyer with the consultation note."];
    }
    if (caseData.caseType === "Consumer Complaint") {
      return ["Keep invoice/order receipt and order ID ready.", "Save product photos/video and delivery proof.", "Save complaint emails/chats/support ticket history.", "Write a clear refund/replacement request for review.", "Use National Consumer Helpline where applicable.", "Verify next steps with legal aid/lawyer for serious disputes."];
    }
    if (caseData.caseType === "RTI / Government Service Delay" || caseData.caseType === "Government Document / Certificate Issue") {
      return ["Keep application acknowledgement and reference number ready.", "Note department/public authority name.", "Prepare a date-wise delay timeline.", "Collect previous reminders or follow-up emails.", "Use RTI Online for Central Government public authorities where applicable.", "Verify State/UT route or department process before submitting."];
    }
    if (caseData.caseType === "Lost Documents / Police Complaint") {
      return ["Keep ID proof copy ready.", "Write document details and approximate loss date/location.", "Check State/UT police lost-report portal where applicable.", "Visit local police station if online route is not available.", "Keep acknowledgement safely after reporting."];
    }
    return ["Save all screenshots", "Note transaction ID / UTR", "Contact bank support", "File cybercrime complaint where applicable", "Prepare draft for review", "Keep ID proof and bank statement ready", "Consult legal aid/lawyer for serious matters"];
  }

  function getMissingProofSuggestions(caseData: FormData, standardMissing: string[]) {
    if (caseData.caseType !== "Property / Land Dispute") return standardMissing;
    return ["Title/sale/property papers", "Revenue/mutation/tax records", "Property location/identifier", "Court papers/case number if any", "Notices/messages", "Possession proof/photos if relevant"].slice(0, 5);
  }

  function safetyOutputMode(caseData: FormData, classification?: AiClassification) {
    return resolveOutputMode(caseData.caseType, caseData.story, classification?.caseType, classification?.outputMode);
  }

  function isHighRiskCase(caseData: FormData) {
    return highRiskCaseTypes.includes(caseData.caseType) || Number(caseData.amountLost) > 50000;
  }

  function fallbackAdvisor(caseData: FormData): AdvisorAnswer {
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
    setLastAiError(message);
    setLastAiDebug(result.debug || null);
    setAiMessage(message);
  }

  async function handleAskAdvisor() {
    if (!submittedCase || !advisorQuestion.trim()) return;
    setAdvisorLoading(true);
    setAdvisorMessage("NyayMitra is thinking...");
    const result = await aiAskAdvisor(submittedCase, advisorQuestion) as AdvisorAnswer | AiClientError;
    const failed = isAiError(result);
    const answer = failed ? fallbackAdvisor(submittedCase) : result;
    const chat: AdvisorChat = { ...answer, id: `CHAT-${Date.now()}`, question: advisorQuestion, createdAt: new Date().toISOString() };
    setSubmittedCase({ ...submittedCase, advisorChats: [...(submittedCase.advisorChats || []), chat] });
    setAdvisorQuestion("");
    setAdvisorLoading(false);
    if (failed) {
      setLastAiError(result.error);
      setLastAiDebug(result.debug || null);
    }
    setAdvisorMessage(failed ? `${result.error} Rule-based fallback was added.` : "AI guidance generated. Please verify important decisions with legal aid/lawyer.");
  }

  async function handleOtherClassification() {
    if (formData.caseType !== "Other / Not Sure") return;
    setOtherClassifying(true);
    setAiMessage("AI is trying to understand your case...");
    const result = await aiClassifyCase(formData) as AiClassification | AiClientError;
    setOtherClassifying(false);
    if (isAiError(result)) {
      showAiError(result, "AI could not classify this right now. Keep it as Other / Not Sure and continue with limited guidance.");
      return;
    }
    const safeClassification = { ...result, outputMode: safetyOutputMode(formData, result) };
    setFormData((current) => ({ ...current, aiAnalysis: { ...(current.aiAnalysis || {}), classification: safeClassification, lastAnalyzedAt: new Date().toISOString() } }));
    setLastAiError("");
    setLastAiDebug(null);
    setAiMessage("AI Case Understanding Result is ready. Review before using the suggested case type.");
  }

  function useSuggestedCaseType() {
    const classification = formData.aiAnalysis?.classification;
    if (!classification) return;
    setFormData((current) => ({ ...current, caseType: classification.caseType, outputMode: safetyOutputMode(current, classification), proofs: Array.from(new Set([...current.proofs, ...classification.suggestedProofs])), relief: Array.from(new Set([...current.relief, ...classification.suggestedReliefs])) }));
  }

  function mergeAiAnalysis(next: Partial<NonNullable<FormData["aiAnalysis"]>>) {
    if (!submittedCase) return;
    const merged = { ...(submittedCase.aiAnalysis || {}), ...next, lastAnalyzedAt: new Date().toISOString() };
    setSubmittedCase({ ...submittedCase, aiAnalysis: merged });
  }

  async function handleAiAnalyzeStory() {
    if (!submittedCase) return;
    setAiLoading("analyze");
    setLastAiMode("classify + extract");
    setLastAiError("");
    setAiMessage("AI is analyzing your case...");
    const [classification, extraction] = await Promise.all([aiClassifyCase(submittedCase), aiExtractFacts(submittedCase)]);
    setAiLoading("");
    const classificationError = isAiError(classification) ? classification : null;
    const extractionError = isAiError(extraction) ? extraction : null;
    if (classificationError && extractionError) {
      showAiError(classificationError);
      return;
    }
    const safeClassification = classification && !classificationError ? { ...(classification as AiClassification), outputMode: safetyOutputMode(submittedCase, classification as AiClassification) } : undefined;
    mergeAiAnalysis({ classification: safeClassification, extraction: extraction && !extractionError ? extraction as AiExtraction : undefined });
    setLastAiError(classificationError?.error || extractionError?.error || "");
    setLastAiDebug(classificationError?.debug || extractionError?.debug || null);
    setAiMessage("AI analysis completed.");
  }

  async function handleAiFollowups() {
    if (!submittedCase) return;
    setAiLoading("followup");
    setLastAiMode("followup");
    setLastAiError("");
    setAiMessage("AI is analyzing your case...");
    const result = await aiGenerateFollowups(submittedCase) as { questions?: string[] } | AiClientError;
    setAiLoading("");
    if (isAiError(result) || !result.questions) {
      showAiError(isAiError(result) ? result : { error: "AI did not return follow-up questions." });
      return;
    }
    const questions = Array.from(new Set([...extraFollowUpQuestions, ...result.questions]));
    setExtraFollowUpQuestions(questions);
    mergeAiAnalysis({ followupQuestions: questions });
    setAiMessage("AI analysis completed.");
  }

  async function handleAiImproveDraft() {
    if (!submittedCase) return;
    setAiLoading("draft");
    setLastAiMode("draft");
    setLastAiError("");
    setAiMessage("AI is analyzing your case...");
    const result = await aiGenerateDraft(submittedCase) as { draftText?: string } | AiClientError;
    setAiLoading("");
    if (isAiError(result) || !result.draftText) {
      showAiError(isAiError(result) ? result : { error: "AI did not return draft text." });
      return;
    }
    setEditableDraft(result.draftText);
    setSubmittedCase({ ...submittedCase, complaintDraft: result.draftText, aiAnalysis: { ...(submittedCase.aiAnalysis || {}), generatedDraft: result.draftText, lastAnalyzedAt: new Date().toISOString() } });
    setAiMessage("AI draft generated. Please review and edit before using.");
  }

  async function handleAiReview() {
    if (!submittedCase) return;
    setAiLoading("review");
    setLastAiMode("review");
    setLastAiError("");
    setAiMessage("AI is analyzing your case...");
    const result = await aiReviewCase(submittedCase) as AiReview | AiClientError;
    setAiLoading("");
    if (isAiError(result)) {
      showAiError(result);
      return;
    }
    mergeAiAnalysis({ review: result });
    setAiMessage("AI analysis completed.");
  }

  function calculateCaseQualityScore(caseData: FormData) {
    let score = 0;
    const suggestions: string[] = [];

    if (caseData.story.trim().length >= 80 && countCaseUsefulKeywords(caseData) >= 3) score += 20;
    else if (caseData.caseType === "Property / Land Dispute") suggestions.push("Add clear relationship/history of the property.");
    else if (caseData.caseType === "Consumer Complaint") suggestions.push("Add clearer order, seller/platform, defect/service issue, complaint history, and refund/replacement details.");
    else if (caseData.caseType === "RTI / Government Service Delay" || caseData.caseType === "Government Document / Certificate Issue") suggestions.push("Add department name, application/reference number, date of application, delay period, acknowledgement, and action needed.");
    else suggestions.push("Add a clearer story with useful details like WhatsApp, UPI, payment, transaction, bank, fraud, blocked, or refund.");

    if (hasTooManyRandomSymbols(caseData.story)) {
      score -= 10;
      suggestions.push("Reduce random symbols and write the story in clear sentences.");
    }

    if (caseData.incidentDate) score += 10;
    else suggestions.push("Add the incident date.");

    if (Number(caseData.amountLost) > 0) score += 10;
    else suggestions.push("Add the amount lost.");

    if (caseData.oppositeParty.trim()) score += 15;
    else suggestions.push(caseData.caseType === "Property / Land Dispute" ? "Add opposite party details." : caseData.caseType === "Consumer Complaint" ? "Add seller/platform/service provider details." : caseData.caseType === "RTI / Government Service Delay" ? "Add department/public authority details." : "Add opposite party details such as UPI ID, phone number, name, or account details.");

    if (caseData.caseType === "Property / Land Dispute") {
      const allProofText = [...caseData.proofs, ...(caseData.customProofs || []), caseData.story].join(" ").toLowerCase();
      if (/(sale deed|title|property papers|old land papers)/i.test(allProofText)) score += 15;
      else suggestions.push("Add sale deed/title documents if available.");
      if (/(revenue|mutation|tax|khasra|survey)/i.test(allProofText)) score += 10;
      else suggestions.push("Add revenue/mutation/tax records if available.");
      if (/(possession|photo|boundary)/i.test(allProofText)) score += 10;
      else suggestions.push("Add possession proof if available.");
      if (/(notice|court|case number|civil case)/i.test(allProofText)) score += 10;
      else suggestions.push("Add any notices/court papers/case number if available.");
      if (!/(location|khasra|survey|plot|village|address)/i.test(allProofText)) suggestions.push("Add property location and survey/khasra/plot details if available.");
      suggestions.push("Add lawyer/legal-aid review because property disputes are high-risk.");
    } else if (caseData.caseType === "Consumer Complaint") {
      const allProofText = [...caseData.proofs, ...(caseData.customProofs || []), caseData.story].join(" ").toLowerCase();
      if (/(invoice|receipt|order)/i.test(allProofText)) score += 15;
      else suggestions.push("Add invoice/order receipt or order ID if available.");
      if (/(photo|video|damaged|defect)/i.test(allProofText)) score += 10;
      else suggestions.push("Add product photos/video if relevant.");
      if (/(delivery|delivered)/i.test(allProofText)) score += 10;
      else suggestions.push("Add delivery proof if available.");
      if (/(chat|email|support|complaint)/i.test(allProofText)) score += 10;
      else suggestions.push("Add complaint emails/chats or support ticket history.");
    } else if (caseData.caseType === "RTI / Government Service Delay" || caseData.caseType === "Government Document / Certificate Issue") {
      const allProofText = [...caseData.proofs, ...(caseData.customProofs || []), caseData.story].join(" ").toLowerCase();
      if (/(application|acknowledgement|receipt|reference)/i.test(allProofText)) score += 15;
      else suggestions.push("Add application acknowledgement or receipt/reference number.");
      if (/(department|authority)/i.test(allProofText)) score += 10;
      else suggestions.push("Add department/public authority name.");
      if (/(follow-up|reminder|email)/i.test(allProofText)) score += 10;
      else suggestions.push("Add previous follow-up emails or reminders if available.");
    } else {

      if (caseData.proofs.includes("UPI transaction screenshot")) score += 15;
      else suggestions.push("Add the UPI transaction screenshot if available.");

      if (caseData.proofs.includes("WhatsApp chat screenshot")) score += 10;
      else suggestions.push("Add WhatsApp/chat screenshots if the scammer contacted you there.");

      if (caseData.proofs.includes("Bank SMS")) score += 10;
      else suggestions.push("Add bank SMS, debit alert, or bank statement entry.");
    }

    if (caseData.relief.length + (caseData.customReliefs || []).length >= 2) score += 10;
    else suggestions.push("Select at least two relief options if they match your situation.");

    if (caseData.uploadedFiles.length >= 1 || (caseData.customProofs || []).length >= 1) score += 10;
    else suggestions.push("Upload at least one proof file so the annexure index is stronger.");

    if (caseData.uploadedFiles.length >= 3 || (caseData.customProofs || []).length >= 3) score += 10;
    else suggestions.push("Upload three or more key proof files if available.");

    score = Math.max(0, Math.min(100, score));

    return { score, label: score >= 70 ? "Strong Preparation" : score >= 40 ? "Moderate Preparation" : "Weak Preparation", suggestions };
  }

  function handleGenerate() {
    const nextErrors: string[] = [];

    if (!formData.fullName.trim()) nextErrors.push("Full name is required.");
    if (!formData.contact.trim()) nextErrors.push("Contact is required.");
    if (!formData.incidentDate) nextErrors.push("Incident date is required.");

    if (formData.story.trim().length < 30) {
      nextErrors.push("Please describe what happened in at least 30 characters so the draft can be useful.");
    }

    if (Number(formData.amountLost) < 0) {
      nextErrors.push("Please enter an amount lost of 0 or more.");
    }

    if (formData.proofs.length === 0) {
      nextErrors.push("Please select at least one proof available.");
    }

    if (formData.proofs.includes(OTHER_PROOF_OPTION) && !(formData.customProofs || []).length) {
      nextErrors.push("Please describe the other proof/document or unselect Other proof.");
    }

    if (formData.relief.length === 0) {
      nextErrors.push("Please select at least one relief wanted.");
    }

    if (formData.relief.includes(OTHER_RELIEF_OPTION) && !(formData.customReliefs || []).length) {
      nextErrors.push("Please describe the other relief/outcome or unselect Other relief.");
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
    if (!submittedCase) return;

    setSubmittedCase({ ...submittedCase, followUpAnswers });
    setUpdateMessage("Preview updated with follow-up answers.");
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
      status: submittedCase.status || "Draft Ready",
      language,
      outputMode: resolveOutputMode(submittedCase.caseType, submittedCase.story, submittedCase.aiAnalysis?.classification?.caseType, submittedCase.aiAnalysis?.classification?.outputMode),
    };
    const savedCases = JSON.parse(localStorage.getItem("nyaymitra_saved_cases") || "[]") as FormData[];
    const withoutDuplicate = savedCases.filter((item) => item.caseId !== caseWithLatestAnswers.caseId);

    localStorage.setItem("nyaymitra_case_data", JSON.stringify(caseWithLatestAnswers));
    localStorage.setItem("nyaymitra_saved_cases", JSON.stringify([caseWithLatestAnswers, ...withoutDuplicate]));
    router.push("/legal-kit");
  }

  function saveProgress() {
    localStorage.setItem("nyaymitra_intake_draft", JSON.stringify({ ...formData, followUpAnswers, complaintDraft: editableDraft, language }));
    setDraftFound(true);
    setProgressMessage("Progress saved locally.");
  }

  function continueDraft() {
    const saved = localStorage.getItem("nyaymitra_intake_draft");
    if (!saved) return;
    const parsed = JSON.parse(saved) as FormData;
    setFormData({ ...parsed, uploadedFiles: parsed.uploadedFiles || [], followUpAnswers: parsed.followUpAnswers || {}, customProofs: parsed.customProofs || [], customReliefs: parsed.customReliefs || [] });
    setFollowUpAnswers(parsed.followUpAnswers || {});
    setEditableDraft(parsed.complaintDraft || "");
    if (parsed.language) changeLanguage(parsed.language);
    setProgressMessage("Saved draft loaded.");
  }

  function clearDraft() {
    localStorage.removeItem("nyaymitra_intake_draft");
    setDraftFound(false);
    setProgressMessage("Saved draft cleared.");
  }

  function startFreshCase() {
    localStorage.removeItem("nyaymitra_case_data");
    localStorage.removeItem("nyaymitra_edit_case");
    localStorage.removeItem("nyaymitra_intake_draft");
    const fresh: FormData = { fullName: "", contact: "", caseType: "Cyber Fraud / UPI Scam", stateOrUT: "", story: "", incidentDate: "", amountLost: "", oppositeParty: "", proofs: [], relief: [], customProofs: [], customReliefs: [], uploadedFiles: [] };
    setFormData(fresh);
    setSubmittedCase(null);
    setFollowUpAnswers({});
    setEditableDraft("");
    setDraftFound(false);
    setIsEditingSavedCase(false);
    setProgressMessage("Started a fresh case. Saved dashboard cases and language were not deleted.");
  }

  function detectCaseTypeMismatch(caseData: FormData) {
    const lower = caseData.story.toLowerCase();
    if (caseData.caseType === "Cyber Fraud / UPI Scam" && /(ancestral|land|property|sale deed|revenue record|mutation|khasra|survey|uncle)/i.test(lower)) {
      return "Your story looks like a Property / Land Dispute, but selected case type is Cyber Fraud / UPI Scam.";
    }
    if (caseData.caseType === "Property / Land Dispute" && /(upi|transaction|bank sms|cyber|scam|fraud|blocked)/i.test(lower)) {
      return "Your story may include payment/cyber details. Verify whether Property / Land Dispute is still the correct case type.";
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
        <div className="mb-8 rounded-3xl border border-teal-400/20 bg-white/5 p-6 shadow-2xl">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              <button type="button" onClick={() => setMode("full")} className={`rounded-full px-4 py-2 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-teal-200 ${mode === "full" ? "bg-teal-400 text-slate-950" : "bg-white/10 text-white"}`}>{t("fullMode")}</button>
              <button type="button" onClick={() => setMode("guided")} className={`rounded-full px-4 py-2 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-teal-200 ${mode === "guided" ? "bg-teal-400 text-slate-950" : "bg-white/10 text-white"}`}>{t("guidedMode")}</button>
              <button type="button" onClick={startFreshCase} className="rounded-full bg-red-50 px-4 py-2 text-sm font-bold text-red-700 focus:outline-none focus:ring-4 focus:ring-red-100">{t("btnStartFresh")}</button>
            </div>
          </div>
          <p className="text-sm font-semibold text-teal-300">
            {isEditingSavedCase ? "Editing Saved Case" : "INTAKE PAGE REAL VERSION"}
          </p>

          <h1 className="mt-2 text-3xl font-bold md:text-5xl">
            Universal Legal Case Preparation
          </h1>

          <p className="mt-4 max-w-3xl text-slate-300">
            Enter any legal problem in simple language. NyayMitra helps classify the issue, organize proof, prepare drafts or consultation notes, and route serious matters to legal aid or lawyer review.
          </p>
          <p className="mt-4 rounded-2xl bg-slate-900 p-4 text-sm font-semibold text-slate-200">
            {t("disclaimer")}
          </p>
          <div className="mt-4 rounded-2xl border border-teal-400/20 bg-slate-900 p-5">
            <h2 className="font-black text-teal-300">{t("labelSafetyNote")}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              {t("labelDisclaimer")}
            </p>
          </div>
        </div>

        {draftFound && !isEditingSavedCase && (
          <div className="mb-6 rounded-3xl border border-teal-200 bg-teal-50 p-5 text-slate-950 shadow-xl" aria-live="polite">
            <h2 className="text-xl font-black">{t("msgDraftLoaded")}</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={continueDraft} className="rounded-full bg-teal-600 px-5 py-3 font-bold text-white">{t("btnContinueDraft")}</button>
              <button type="button" onClick={clearDraft} className="rounded-full bg-white px-5 py-3 font-bold text-slate-700">{t("btnClearDraft")}</button>
            </div>
          </div>
        )}

        {progressMessage && <p className="mb-6 rounded-2xl bg-teal-100 p-4 font-bold text-teal-900" aria-live="polite">{progressMessage}</p>}

        {mode === "guided" && (
          <div className="mb-8 rounded-[2rem] bg-white p-6 text-slate-950 shadow-2xl">
            <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-teal-500" style={{ width: `${((wizardStep + 1) / wizardSteps.length) * 100}%` }} /></div>
            <p className="mt-5 text-sm font-black uppercase tracking-[0.2em] text-teal-700">Step {wizardStep + 1} of {wizardSteps.length}: {wizardSteps[wizardStep].title}</p>
            <h2 className="mt-2 text-3xl font-black">{wizardSteps[wizardStep].title}</h2>
            <p className="mt-2 font-semibold leading-7 text-slate-600">{wizardSteps[wizardStep].instruction}</p>
            <button type="button" onClick={readStepAloud} className="mt-4 rounded-full bg-slate-950 px-5 py-3 font-bold text-white">{t("readAloud")}</button>
            {voiceMessage && <p className="mt-3 rounded-xl bg-amber-100 p-3 text-sm font-bold text-amber-900" aria-live="polite">{voiceMessage}</p>}

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {wizardStep === 0 && <><Input label={t("fullName")} name="fullName" value={formData.fullName} onChange={handleInputChange} /><Input label={t("contact")} name="contact" value={formData.contact} onChange={handleInputChange} /><Input label={t("stateOrUT")} name="stateOrUT" value={formData.stateOrUT || ""} onChange={handleInputChange} /><div className="md:col-span-2"><CaseTypeSelector selected={formData.caseType} search={caseTypeSearch} onSearch={setCaseTypeSearch} onSelect={selectCaseType} /></div></>}
              {wizardStep === 1 && <><Input label={t("incidentDate")} type="date" name="incidentDate" value={formData.incidentDate} onChange={handleInputChange} /><Input label={t("amountLost")} type="number" name="amountLost" value={formData.amountLost} onChange={handleInputChange} /></>}
              {wizardStep === 2 && <label className="block md:col-span-2"><span className="mb-2 block font-semibold">{t("story")}</span><textarea name="story" value={formData.story} onChange={handleInputChange} rows={6} className="w-full rounded-xl border p-3 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" /></label>}
              {wizardStep === 3 && <Input label={t("oppositeParty")} name="oppositeParty" value={formData.oppositeParty} onChange={handleInputChange} />}
              {wizardStep === 4 && <div className="md:col-span-2"><h3 className="mb-3 font-black">{t("proofAvailable")}</h3><div className="grid gap-3 md:grid-cols-2">{proofOptions.map((proof) => <label key={proof} className="flex items-center gap-3 rounded-xl border bg-slate-50 p-3"><input type="checkbox" value={proof} checked={formData.proofs.includes(proof)} onChange={(e) => handleCheckboxChange(e, "proofs")} />{proof}</label>)}</div><CustomItemsEditor type="proof" enabled={formData.proofs.includes(OTHER_PROOF_OPTION)} value={customProofInput} items={formData.customProofs || []} onChange={setCustomProofInput} onAdd={addCustomProof} onRemove={removeCustomProof} /></div>}
              {wizardStep === 5 && <div className="md:col-span-2"><h3 className="mb-3 font-black">{t("reliefWanted")}</h3><div className="grid gap-3 md:grid-cols-2">{reliefOptions.map((item) => <label key={item} className="flex items-center gap-3 rounded-xl border bg-slate-50 p-3"><input type="checkbox" value={item} checked={formData.relief.includes(item)} onChange={(e) => handleCheckboxChange(e, "relief")} />{item}</label>)}</div><CustomItemsEditor type="relief" enabled={formData.relief.includes(OTHER_RELIEF_OPTION)} value={customReliefInput} items={formData.customReliefs || []} onChange={setCustomReliefInput} onAdd={addCustomRelief} onRemove={removeCustomRelief} /></div>}
              {wizardStep === 6 && <div className="md:col-span-2 rounded-2xl bg-slate-50 p-5"><p><b>{t("fullName")}:</b> {formData.fullName || "-"}</p><p><b>{t("amountLost")}:</b> ₹{formData.amountLost || "-"}</p><p><b>{t("proofAvailable")}:</b> {formData.proofs.filter((item) => item !== OTHER_PROOF_OPTION).length} standard + {(formData.customProofs || []).length} custom</p><p><b>{t("reliefWanted")}:</b> {[...formData.relief.filter((item) => item !== OTHER_RELIEF_OPTION), ...(formData.customReliefs || [])].join(", ") || "-"}</p></div>}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={() => setWizardStep((step) => Math.max(0, step - 1))} className="rounded-full bg-slate-100 px-5 py-3 font-bold text-slate-700">{t("previous")}</button>
              <button type="button" onClick={() => setWizardStep((step) => Math.min(wizardSteps.length - 1, step + 1))} className="rounded-full bg-slate-950 px-5 py-3 font-bold text-white">{t("next")}</button>
              <button type="button" onClick={saveProgress} className="rounded-full bg-teal-100 px-5 py-3 font-bold text-teal-900">{t("saveProgress")}</button>
              {wizardStep === wizardSteps.length - 1 && <button type="button" onClick={handleGenerate} className="rounded-full bg-teal-600 px-5 py-3 font-black text-white">{t("generateSummary")}</button>}
            </div>
          </div>
        )}

        {mode === "full" && <div className="rounded-3xl border border-white/10 bg-white p-6 text-slate-900 shadow-2xl">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block font-semibold">Full Name</label>
              <input
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                className="w-full rounded-xl border p-3 outline-none focus:border-teal-500"
                placeholder="Example: Sujal"
              />
            </div>

            <div>
              <label className="mb-2 block font-semibold">Phone / Email</label>
              <input
                name="contact"
                value={formData.contact}
                onChange={handleInputChange}
                className="w-full rounded-xl border p-3 outline-none focus:border-teal-500"
                placeholder="Example: sujal@example.com"
              />
            </div>

            <div className="md:col-span-2"><CaseTypeSelector selected={formData.caseType} search={caseTypeSearch} onSearch={setCaseTypeSearch} onSelect={selectCaseType} /></div>

            <div>
              <label className="mb-2 block font-semibold">Date of Incident</label>
              <input
                type="date"
                name="incidentDate"
                value={formData.incidentDate}
                onChange={handleInputChange}
                className="w-full rounded-xl border p-3 outline-none focus:border-teal-500"
              />
            </div>

            <div>
              <label className="mb-2 block font-semibold">State / UT</label>
              <input
                name="stateOrUT"
                value={formData.stateOrUT || ""}
                onChange={handleInputChange}
                className="w-full rounded-xl border p-3 outline-none focus:border-teal-500"
                placeholder="Example: Delhi, Uttar Pradesh, Maharashtra"
              />
            </div>

            <div>
              <label className="mb-2 block font-semibold">Amount Lost</label>
              <input
                type="number"
                name="amountLost"
                value={formData.amountLost}
                onChange={handleInputChange}
                className="w-full rounded-xl border p-3 outline-none focus:border-teal-500"
                placeholder="Example: 3000"
              />
            </div>

            <div>
              <label className="mb-2 block font-semibold">
                Opposite Party Details
              </label>
              <input
                name="oppositeParty"
                value={formData.oppositeParty}
                onChange={handleInputChange}
                className="w-full rounded-xl border p-3 outline-none focus:border-teal-500"
                placeholder="Phone number, UPI ID, email, name"
              />
            </div>
          </div>

          <div className="mt-5">
            <label className="mb-2 block font-semibold">What happened?</label>
              <textarea
              name="story"
              value={formData.story}
              onChange={handleInputChange}
              rows={5}
              className="w-full rounded-xl border p-3 outline-none focus:border-teal-500"
                placeholder="Example: I received a fake work-from-home job message on WhatsApp. The person asked me to pay a registration fee through UPI. I paid ₹4000 to fakejob@upi. After payment, the person blocked me. I have WhatsApp screenshots, UPI transaction proof, bank SMS, and the phone number."
              />
            </div>

          {formData.caseType === "Other / Not Sure" && (
            <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-slate-950">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-700">Other / Not Sure flow</p>
              <h2 className="mt-2 text-2xl font-black">Explain Your Legal Problem</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="block md:col-span-2"><span className="font-bold">What happened?</span><textarea value={formData.story} onChange={(event) => setFormData((current) => ({ ...current, story: event.target.value }))} rows={4} className="mt-2 w-full rounded-xl border border-amber-200 bg-white p-3 outline-none focus:border-amber-500" /></label>
                <Input label="Who is involved?" name="oppositeParty" value={formData.oppositeParty} onChange={handleInputChange} />
                <Input label="When did it happen?" type="date" name="incidentDate" value={formData.incidentDate} onChange={handleInputChange} />
                <label className="block md:col-span-2"><span className="font-bold">Is there any urgent danger or deadline?</span><textarea onChange={(event) => setFormData((current) => ({ ...current, story: `${current.story}\nUrgency/deadline: ${event.target.value}` }))} rows={2} className="mt-2 w-full rounded-xl border border-amber-200 bg-white p-3 outline-none focus:border-amber-500" /></label>
                <label className="block md:col-span-2"><span className="font-bold">What documents/proof do you have?</span><textarea onChange={(event) => setFormData((current) => ({ ...current, story: `${current.story}\nDocuments/proof: ${event.target.value}` }))} rows={2} className="mt-2 w-full rounded-xl border border-amber-200 bg-white p-3 outline-none focus:border-amber-500" /></label>
                <label className="block"><span className="font-bold">What outcome do you want?</span><textarea onChange={(event) => setFormData((current) => ({ ...current, story: `${current.story}\nOutcome wanted: ${event.target.value}` }))} rows={2} className="mt-2 w-full rounded-xl border border-amber-200 bg-white p-3 outline-none focus:border-amber-500" /></label>
                <label className="block"><span className="font-bold">Has anything already been filed?</span><textarea onChange={(event) => setFormData((current) => ({ ...current, story: `${current.story}\nAlready filed: ${event.target.value}` }))} rows={2} className="mt-2 w-full rounded-xl border border-amber-200 bg-white p-3 outline-none focus:border-amber-500" /></label>
              </div>
              <button type="button" onClick={handleOtherClassification} className="mt-5 rounded-full bg-amber-500 px-6 py-3 font-black text-slate-950 hover:bg-amber-400">{otherClassifying ? "NyayMitra is understanding your case..." : "AI Understand My Case"}</button>
              {formData.aiAnalysis?.classification && <div className="mt-5 rounded-2xl bg-white p-4"><h3 className="text-xl font-black">AI Case Understanding Result</h3><div className="mt-3 grid gap-3 md:grid-cols-2"><p><b>Probable case type:</b> {formData.aiAnalysis.classification.caseType}</p><p><b>Confidence:</b> {formData.aiAnalysis.classification.confidence}%</p><p><b>Output mode:</b> {outputModeLabel(formData.aiAnalysis.classification.outputMode)}</p><p><b>Risk level:</b> {formData.aiAnalysis.classification.riskLevel}</p><p className="md:col-span-2"><b>Risk reason:</b> {formData.aiAnalysis.classification.riskReason}</p><p className="md:col-span-2"><b>Short summary:</b> {formData.aiAnalysis.classification.shortSummary}</p><p className="md:col-span-2"><b>Suggested proofs:</b> {formData.aiAnalysis.classification.suggestedProofs?.join(", ") || "Not provided"}</p><p className="md:col-span-2"><b>Suggested reliefs:</b> {formData.aiAnalysis.classification.suggestedReliefs?.join(", ") || "Not provided"}</p><p className="md:col-span-2"><b>Missing details:</b> {formData.aiAnalysis.classification.missingDetails?.join(", ") || "Not provided"}</p><p className="md:col-span-2"><b>Next steps:</b> {formData.aiAnalysis.classification.nextSteps?.join(", ") || "Not provided"}</p><p><b>Lawyer review recommended:</b> {formData.aiAnalysis.classification.lawyerReviewRecommended ? "Yes" : "No"}</p></div><div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={useSuggestedCaseType} className="rounded-full bg-teal-600 px-5 py-3 font-bold text-white">Use AI Suggested Case Type</button><button type="button" className="rounded-full bg-slate-100 px-5 py-3 font-bold text-slate-700">Keep as Other / Not Sure</button></div></div>}
            </div>
          )}

          <div className="mt-6">
            <h2 className="mb-3 text-lg font-bold">Proof Available</h2>

            <div className="grid gap-3 md:grid-cols-2">
              {proofOptions.map((proof) => (
                <label
                  key={proof}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border bg-slate-50 p-3 hover:bg-teal-50"
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

          <div className="mt-8 rounded-3xl border border-teal-100 bg-gradient-to-br from-slate-950 to-teal-950 p-5 text-white shadow-2xl">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-300">Local annexure builder</p>
            <h2 className="mt-2 text-2xl font-black">Upload Proof Files</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Upload screenshots, bank SMS images, UPI transaction proof, chat records, or complaint acknowledgement. Files are only stored locally in this MVP.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1.2fr_auto] md:items-end">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-100">Evidence category</span>
                <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} className="w-full rounded-xl border border-white/10 bg-white p-3 font-semibold text-slate-950 outline-none focus:border-teal-400">
                  {Array.from(new Set([...uploadCategories, ...(formData.customProofs || [])])).map((category) => <option key={category}>{category}</option>)}
                </select>
              </label>

              <label className="block rounded-2xl border border-dashed border-teal-300/60 bg-white/10 p-4">
                <span className="mb-2 block text-sm font-bold text-slate-100">Choose file</span>
                <input type="file" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} className="w-full text-sm text-slate-200 file:mr-4 file:rounded-full file:border-0 file:bg-teal-400 file:px-4 file:py-2 file:font-bold file:text-slate-950" />
                <span className="mt-2 block text-xs text-slate-300">Only metadata is saved: file name, type, size, category, and time.</span>
              </label>

              <button type="button" onClick={handleAddEvidenceFile} className="rounded-xl bg-teal-400 px-5 py-4 font-black text-slate-950 shadow-lg transition hover:bg-teal-300">
                Add Evidence File
              </button>
            </div>

            {fileError && <p className="mt-4 rounded-xl bg-red-100 p-3 text-sm font-bold text-red-800">{fileError}</p>}

            {formData.uploadedFiles.length > 0 && (
              <div className="mt-6 overflow-x-auto rounded-2xl bg-white text-slate-950">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="p-3">Annexure No.</th>
                      <th className="p-3">File name</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Size</th>
                      <th className="p-3">Uploaded at</th>
                      <th className="p-3">Remove</th>
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
                        <td className="p-3"><button type="button" onClick={() => handleRemoveEvidenceFile(file.id)} className="rounded-full bg-red-50 px-3 py-1 font-bold text-red-700">Remove</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-6">
            <h2 className="mb-3 text-lg font-bold">Relief Wanted</h2>

            <div className="grid gap-3 md:grid-cols-2">
              {reliefOptions.map((item) => (
                <label
                  key={item}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border bg-slate-50 p-3 hover:bg-teal-50"
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
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-lg">
              <h3 className="font-black">Please fix these details</h3>
              <ul className="mt-3 space-y-2 text-sm font-semibold">
                {errors.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            className="mt-8 w-full rounded-xl bg-teal-600 px-6 py-4 font-bold text-white shadow-lg transition hover:bg-teal-700"
          >
            Generate Case Summary
          </button>
        </div>}

        {submittedCase && (
          <section id="preview-section" className="mt-10 space-y-6">
            <CaseQualityCard result={calculateCaseQualityScore(submittedCase)} />
            <OfficialActionLinks caseData={submittedCase} />

            <div className="rounded-3xl border border-teal-400/30 bg-slate-900 p-6 shadow-2xl">
              <p className="text-sm font-semibold text-teal-300">Optional AI layer</p>
              <h2 className="mt-2 text-2xl font-bold">AI Assist</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">Let NyayMitra analyze your story and improve your preparation kit. Rule-based mode still works if AI is unavailable.</p>
              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <button type="button" onClick={handleAiAnalyzeStory} className="rounded-xl bg-teal-500 px-4 py-3 font-bold text-slate-950">{aiLoading === "analyze" ? "Analyzing..." : "AI Analyze Story"}</button>
                <button type="button" onClick={handleAiFollowups} className="rounded-xl bg-white/10 px-4 py-3 font-bold text-white">{aiLoading === "followup" ? "Generating..." : "AI Generate Follow-up Questions"}</button>
                <button type="button" onClick={handleAiImproveDraft} className="rounded-xl bg-white/10 px-4 py-3 font-bold text-white">{aiLoading === "draft" ? "Improving..." : "AI Improve Draft"}</button>
                <button type="button" onClick={handleAiReview} className="rounded-xl bg-white/10 px-4 py-3 font-bold text-white">{aiLoading === "review" ? "Reviewing..." : "AI Review Case Strength"}</button>
              </div>
              {aiMessage && <p className={`mt-4 rounded-xl p-3 text-sm font-bold ${lastAiError ? "bg-red-100 text-red-800" : "bg-teal-100 text-teal-900"}`} aria-live="polite">{aiMessage}</p>}
              {process.env.NODE_ENV === "development" && (
                <div className="mt-4 rounded-xl bg-black/30 p-3 text-xs text-slate-200">
                  <p><b>AI configured:</b> {aiMessage.startsWith("AI is not configured") ? "no" : submittedCase.aiAnalysis ? "yes" : "unknown"}</p>
                  <p><b>Last AI mode clicked:</b> {lastAiMode || "None"}</p>
                  <p><b>Last AI error:</b> {lastAiError || "None"}</p>
                  <p><b>Last AI debug:</b> {lastAiDebug ? JSON.stringify(lastAiDebug).slice(0, 500) : "None"}</p>
                </div>
              )}
              {submittedCase.aiAnalysis && (
                <div className="mt-5 space-y-4">
                  {(submittedCase.aiAnalysis.classification || submittedCase.aiAnalysis.extraction) && (
                    <div className="rounded-2xl bg-white p-5 text-slate-950">
                      <h3 className="text-xl font-black">AI Analysis Result</h3>
                      {submittedCase.aiAnalysis.classification && <div className="mt-3 grid gap-3 md:grid-cols-2"><p><b>AI Classified Case Type:</b> {submittedCase.aiAnalysis.classification.caseType}</p><p><b>AI Confidence:</b> {submittedCase.aiAnalysis.classification.confidence}%</p><p><b>AI Output Mode:</b> {outputModeLabel(submittedCase.aiAnalysis.classification.outputMode)}</p><p><b>AI Risk Level:</b> {submittedCase.aiAnalysis.classification.riskLevel}</p><p><b>AI Risk Reason:</b> {submittedCase.aiAnalysis.classification.riskReason}</p><p><b>Lawyer Review:</b> {submittedCase.aiAnalysis.classification.lawyerReviewRecommended ? "Recommended" : "Not specifically flagged"}</p><p className="md:col-span-2"><b>AI Short Summary:</b> {submittedCase.aiAnalysis.classification.shortSummary}</p></div>}
                      {submittedCase.aiAnalysis.extraction && <div className="mt-4 grid gap-4 md:grid-cols-3"><AiBox title="AI Extracted Timeline" items={submittedCase.aiAnalysis.extraction.timeline.map((item) => `${item.date}: ${item.event}`)} /><AiBox title="AI Parties" items={submittedCase.aiAnalysis.extraction.parties} /><AiBox title="AI Missing Details" items={submittedCase.aiAnalysis.extraction.missingDetails} /></div>}
                    </div>
                  )}
                  {submittedCase.aiAnalysis.followupQuestions && <AiBox title="AI Suggested Follow-up Questions" items={submittedCase.aiAnalysis.followupQuestions} />}
                  {submittedCase.aiAnalysis.review && <div className="rounded-2xl bg-white p-5 text-slate-950"><h3 className="text-xl font-black">AI Case Review</h3><p className="mt-2"><b>Quality score:</b> {submittedCase.aiAnalysis.review.qualityScore}</p><div className="mt-4 grid gap-4 md:grid-cols-2"><AiBox title="Strengths" items={submittedCase.aiAnalysis.review.strengths} /><AiBox title="Weaknesses" items={submittedCase.aiAnalysis.review.weaknesses} /><AiBox title="Missing proof" items={submittedCase.aiAnalysis.review.missingProof} /><AiBox title="Suggestions" items={submittedCase.aiAnalysis.review.suggestions} /></div></div>}
                  {getVerifiedSources(submittedCase).length > 0 && <AiBox title="Verified Sources Used" items={getVerifiedSources(submittedCase).map((source) => `${source.title} - ${source.sourceName}`)} />}
                  {hasLawHallucinationRisk(JSON.stringify(submittedCase.aiAnalysis), getVerifiedSources(submittedCase)) && <p className="rounded-xl bg-red-100 p-3 text-sm font-bold text-red-800">AI mentioned legal terms without verified source mapping. Please verify with legal aid/lawyer before relying on it.</p>}
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-white p-6 text-slate-950 shadow-2xl">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">Safe preparation guidance</p>
              <h2 className="mt-2 text-3xl font-black">AI Legal Guidance Mode</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Ask NyayMitra for preparation guidance, possible routes, risks, and next steps. This is not legal advice.</p>
              <p className="mt-3 rounded-2xl bg-slate-950 p-4 text-sm font-semibold text-white">NyayMitra can explain preparation options and next steps, but it is not a substitute for a licensed advocate. Please verify important decisions with legal aid or a lawyer.</p>
              <textarea value={advisorQuestion} onChange={(event) => setAdvisorQuestion(event.target.value)} rows={3} className="mt-5 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" placeholder="Ask a question about your case preparation... Example: What proof is missing? How should I explain this to the authority?" />
              <button type="button" onClick={handleAskAdvisor} className="mt-4 rounded-full bg-teal-600 px-6 py-3 font-black text-white hover:bg-teal-700">{advisorLoading ? "NyayMitra is thinking..." : "Ask NyayMitra"}</button>
              {advisorMessage && <p className="mt-3 rounded-xl bg-teal-100 p-3 text-sm font-bold text-teal-900" aria-live="polite">{advisorMessage}</p>}
              {(submittedCase.advisorChats || []).length > 0 && <div className="mt-5 space-y-4">{submittedCase.advisorChats?.map((chat) => <AdvisorChatCard key={chat.id} chat={chat} />)}</div>}
            </div>

            {detectAmountMismatch(submittedCase) && (
              <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-900 shadow-2xl">
                <h2 className="text-xl font-black">Amount Mismatch Warning</h2>
                <p className="mt-2 font-semibold leading-7">{detectAmountMismatch(submittedCase)}</p>
              </div>
            )}

            {storyWarning && (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-2xl">
                <h2 className="text-xl font-black">Story Quality Warning</h2>
                <p className="mt-2 font-semibold leading-7">{storyWarning}</p>
              </div>
            )}

            {caseTypeMismatch && (
              <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-900 shadow-2xl">
                <h2 className="text-xl font-black">Case Type Mismatch Warning</h2>
                <p className="mt-2 font-semibold leading-7">{caseTypeMismatch}</p>
                {submittedCase.caseType === "Cyber Fraud / UPI Scam" && <div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={() => { const next = { ...submittedCase, caseType: "Property / Land Dispute", proofs: [], relief: [], customProofs: [], customReliefs: [], uploadedFiles: [], aiAnalysis: undefined, complaintDraft: "" }; setSubmittedCase(next); setFormData(next); setEditableDraft(""); }} className="rounded-full bg-red-600 px-5 py-3 font-bold text-white">Switch to Property / Land Dispute</button><button type="button" className="rounded-full bg-white px-5 py-3 font-bold text-red-700">Keep Cyber Fraud / UPI Scam</button></div>}
              </div>
            )}

            <div className="rounded-3xl border border-teal-400/30 bg-white/10 p-6 shadow-2xl">
              <p className="mb-2 text-sm font-semibold text-teal-300">
                Legal Action Kit Preview
              </p>

              <h2 className="text-3xl font-bold">Case Snapshot</h2>

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

              <div className="mt-5 rounded-2xl bg-slate-900 p-4 text-sm text-slate-300">
                <b>User story:</b> {submittedCase.story}
              </div>
            </div>

            <div className="rounded-3xl border border-teal-400/30 bg-slate-900 p-6 shadow-2xl">
              <p className="text-sm font-semibold text-teal-300">Rule-based preparation assistant</p>
              <h2 className="mt-2 text-2xl font-bold">Smart Follow-up Questions</h2>
              <div className="mt-5 space-y-4">
                {generateFollowUpQuestions(submittedCase).map((question) => (
                  <label key={question} className="block rounded-2xl border border-white/10 bg-white/5 p-4">
                    <span className="font-semibold text-slate-100">{question}</span>
                    <textarea
                      value={followUpAnswers[question] || ""}
                      onChange={(event) => setFollowUpAnswers((current) => ({ ...current, [question]: event.target.value }))}
                      rows={3}
                      className="mt-3 w-full rounded-xl border border-white/10 bg-white p-3 text-slate-950 outline-none focus:border-teal-400"
                      placeholder="Type your answer here..."
                    />
                  </label>
                ))}
              </div>
              <button type="button" onClick={handleUpdatePreviewWithAnswers} className="mt-5 w-full rounded-xl bg-teal-500 px-6 py-4 font-bold text-slate-950 shadow-lg transition hover:bg-teal-400">
                Update Preview with Answers
              </button>
              {updateMessage && <p className="mt-3 rounded-xl bg-teal-100 p-3 text-sm font-bold text-teal-900">{updateMessage}</p>}
            </div>

            {submittedCase.followUpAnswers && Object.values(submittedCase.followUpAnswers).some(Boolean) && (
              <div className="rounded-3xl bg-white p-6 text-slate-900 shadow-2xl">
                <h2 className="text-2xl font-bold">Follow-up Answers Added</h2>
                <div className="mt-4 space-y-3">
                  {Object.entries(submittedCase.followUpAnswers).filter(([, answer]) => answer.trim()).map(([question, answer]) => (
                    <div key={question} className="rounded-2xl bg-slate-50 p-4">
                      <p className="font-black text-teal-700">{question}</p>
                      <p className="mt-2 text-slate-700">{answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-3xl bg-white p-6 text-slate-900 shadow-2xl">
              <h2 className="text-2xl font-bold">Timeline Builder</h2>

              <div className="mt-5 grid gap-4 md:grid-cols-5">
                <div className="rounded-2xl bg-slate-100 p-4">
                  <p className="font-bold">1. Incident</p>
                  <p className="text-sm">{submittedCase.incidentDate}</p>
                </div>

                <div className="rounded-2xl bg-slate-100 p-4">
                  <p className="font-bold">2. Loss</p>
                  <p className="text-sm">₹{submittedCase.amountLost}</p>
                </div>

                <div className="rounded-2xl bg-slate-100 p-4">
                  <p className="font-bold">3. Evidence</p>
                  <p className="text-sm">
                    {submittedCase.proofs.filter((item) => item !== OTHER_PROOF_OPTION).length} standard + {(submittedCase.customProofs || []).length} custom proof item(s)
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-100 p-4">
                  <p className="font-bold">4. Complaint</p>
                  <p className="text-sm">
                    {submittedCase.proofs.includes(
                      "Police/cyber complaint acknowledgement"
                    )
                      ? "Already initiated"
                      : "Not filed yet"}
                  </p>
                </div>

                <div className="rounded-2xl bg-teal-100 p-4">
                  <p className="font-bold">5. Next Step</p>
                  <p className="text-sm">{submittedOutputMode === "urgent-legal-aid-route" ? "Prepare consultation note" : "Prepare draft for review"}</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 text-slate-900 shadow-2xl">
              <h2 className="text-2xl font-bold">Evidence Table</h2>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[880px] border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="p-3">Annexure No.</th>
                      <th className="p-3">Evidence</th>
                      <th className="p-3">Available?</th>
                      <th className="p-3">Uploaded File Name</th>
                      <th className="p-3">What it helps prove</th>
                      <th className="p-3">Suggested action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {[...proofOptions.filter((proof) => proof !== OTHER_PROOF_OPTION), ...(submittedCase.customProofs || [])].map((proof) => {
                      const custom = (submittedCase.customProofs || []).includes(proof);
                      const available = submittedCase.proofs.includes(proof);
                      const uploadedFile = submittedCase.uploadedFiles.find((file) => file.evidenceCategory === proof);

                      return (
                        <tr key={proof} className="border-b">
                          <td className="p-3 font-black">{uploadedFile ? `A${submittedCase.uploadedFiles.findIndex((file) => file.id === uploadedFile.id) + 1}` : "-"}</td>
                          <td className="p-3 font-semibold">{proof}</td>
                          <td className="p-3">
                            {custom || available ? "Yes" : "Missing"}
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

            <div className="rounded-3xl bg-white p-6 text-slate-900 shadow-2xl">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">Rule-based draft generator</p>
                  <h2 className="mt-2 text-3xl font-black text-slate-950">{submittedOutputMode === "urgent-legal-aid-route" ? "Editable Legal Aid Consultation Note" : "Editable Draft Complaint"}</h2>
                  <p className="mt-2 text-sm font-semibold text-slate-600">Generated locally from your case details. Review and edit before using.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button type="button" onClick={handleGenerateDraftComplaint} className="rounded-full bg-teal-600 px-5 py-3 font-bold text-white hover:bg-teal-700">{submittedOutputMode === "urgent-legal-aid-route" ? "Generate Legal Aid Consultation Note" : "Generate Draft Complaint"}</button>
                  <button type="button" onClick={handleResetDraft} className="rounded-full bg-slate-100 px-5 py-3 font-bold text-slate-700 hover:bg-slate-200">Reset Draft</button>
                  <button type="button" onClick={handleCopyDraft} className="rounded-full bg-slate-950 px-5 py-3 font-bold text-white hover:bg-slate-800">Copy Draft</button>
                </div>
              </div>

              <textarea
                value={editableDraft}
                onChange={(event) => handleDraftChange(event.target.value)}
                rows={18}
                className="mt-6 w-full rounded-2xl border border-slate-200 bg-slate-50 p-5 font-mono text-sm leading-7 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
                placeholder={submittedOutputMode === "urgent-legal-aid-route" ? "Click Generate Legal Aid Consultation Note to create an editable note." : "Click Generate Draft Complaint to create an editable complaint draft."}
              />

              {editableDraft && <DraftQualityCard result={analyzeDraftQuality(editableDraft)} />}
              {draftMessage && <p className="mt-4 rounded-xl bg-teal-100 p-3 text-sm font-bold text-teal-900">{draftMessage}</p>}
            </div>

            <div className="rounded-3xl bg-white p-6 text-slate-900 shadow-2xl">
              <h2 className="text-2xl font-bold">Missing Proof</h2>

              {displayedMissingProofs.length === 0 ? (
                <p className="mt-3 rounded-xl bg-green-100 p-4">
                  Great. No missing proof from the basic checklist.
                </p>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {displayedMissingProofs.map((item) => (
                    <div
                      key={item}
                      className="rounded-xl border border-orange-300 bg-orange-50 p-4"
                    >
                      <b>Missing:</b> {item}. Try to collect this before final
                      PDF.
                    </div>
                  ))}
                </div>
              )}
              {(submittedCase.customProofs || []).length > 0 && <p className="mt-4 rounded-xl bg-teal-50 p-4 text-sm font-bold text-teal-900">Additional custom proofs added by user. These should be reviewed before filing.</p>}
            </div>

            <div className="rounded-3xl border border-teal-400/30 bg-white/10 p-6 shadow-2xl">
              <h2 className="text-2xl font-bold">Risk & Safety Router</h2>

              <p className="mt-3 text-xl font-bold text-teal-300">
                {getCaseRiskLabel(submittedCase)}
              </p>

              <p className="mt-3 text-slate-200">
                {submittedOutputMode === "urgent-legal-aid-route"
                  ? "Urgent legal-aid/lawyer review is recommended. NyayMitra will prepare a consultation note and document organizer only."
                  : "This case can be prepared with evidence, timeline, and a draft for review. For serious matters, contact legal aid or a lawyer."}
              </p>

              <p className="mt-4 rounded-xl bg-slate-900 p-4 text-sm text-slate-300">
                NyayMitra does not provide legal advice and does not
                guarantee any result. It helps with draft preparation, evidence
                organization, and legal-aid routing. NyayMitra is a legal self-help preparation tool, not a lawyer. Please verify with legal aid/lawyer before filing.
              </p>
            </div>

            <div className="rounded-3xl bg-white p-6 text-slate-900 shadow-2xl">
              <h2 className="text-2xl font-bold">Next Steps Checklist</h2>

              <ul className="mt-4 space-y-2">
                {getNextStepsChecklist(submittedCase).map((step) => <li key={step}>✅ {step}</li>)}
              </ul>

              <button
                type="button"
                onClick={handleGeneratePdf}
                className="mt-6 w-full rounded-xl bg-teal-600 px-6 py-4 font-bold text-white shadow-lg transition hover:bg-teal-700"
              >
                Generate Legal Action Kit PDF
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
    <div className="rounded-3xl bg-white p-6 text-slate-900 shadow-2xl">
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
      <div className={`mt-5 rounded-2xl p-4 ${strong ? "bg-teal-50 text-teal-900" : "bg-amber-50 text-amber-900"}`}>
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
    <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
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
    <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
      <h3 className="font-black text-teal-700">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.filter(Boolean).map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function AdvisorChatCard({ chat }: { chat: AdvisorChat }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <p className="font-black text-slate-950">Q: {chat.question}</p>
      <p className="mt-3 leading-7 text-slate-700">{chat.answer}</p>
      {chat.lawyerReviewRecommended && <p className="mt-3 rounded-xl bg-red-100 p-3 text-sm font-black text-red-800">Legal-aid/lawyer review strongly recommended.</p>}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <AiBox title="Next steps" items={chat.nextSteps} />
        <AiBox title="Missing info" items={chat.missingInfo.length ? chat.missingInfo : ["No specific missing info listed."]} />
      </div>
      <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">{chat.riskNote}</p>
    </div>
  );
}

function OfficialActionLinks({ caseData }: { caseData: FormData }) {
  const suggestions = buildOfficialActionSuggestions(caseData);

  return (
    <div className="rounded-[2rem] border border-teal-300/30 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-6 shadow-2xl">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-300">Official action link</p>
      <h2 className="mt-2 text-3xl font-black text-white">Official Action Links</h2>
      <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-300">Based on your case type, these official portals may help you report, track, or seek support.</p>
      {suggestions.showEmergency && <p className="mt-4 rounded-2xl border border-orange-300/40 bg-orange-500/15 p-4 text-sm font-bold text-orange-100">If there is immediate danger, call 112 or contact local emergency services immediately.</p>}
      <p className="mt-4 rounded-2xl bg-white/10 p-4 text-sm font-semibold text-slate-200">{suggestions.stateMessage}</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {suggestions.portals.map((portal) => <PortalCard key={portal.id} portal={portal} />)}
      </div>
      <p className="mt-5 rounded-2xl bg-slate-950 p-4 text-sm font-semibold text-slate-200">NyayMitra provides official links for convenience. Portal eligibility, FIR registration, and complaint handling depend on the concerned authority and applicable procedure.</p>
    </div>
  );
}

function PortalCard({ portal }: { portal: OfficialPortal }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white p-5 text-slate-950 shadow-xl">
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-black text-teal-800">Official</span>
        {portal.emergencyOnly && <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-800">Emergency</span>}
        {portal.stateSpecific && <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-black text-yellow-800">State-specific</span>}
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{portal.category}</span>
      </div>
      <h3 className="mt-4 text-xl font-black">{portal.title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{portal.description}</p>
      <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{portal.notes}</p>
      <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-600"><p>Source: {portal.sourceName}</p><p>Last checked: {portal.lastChecked}</p></div>
      <a href={portal.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-teal-700">{portal.actionLabel}</a>
    </article>
  );
}

function CaseTypeSelector({ selected, search, onSearch, onSelect }: { selected: string; search: string; onSearch: (value: string) => void; onSelect: (caseType: string) => void }) {
  const normalizedSearch = search.trim().toLowerCase();
  const matches = caseConfigs.filter((config) => {
    const aliases = caseTypeAliases[config.caseType] || [];
    return config.caseType !== "Other / Not Sure" && (config.caseType.toLowerCase().includes(normalizedSearch) || aliases.some((alias) => alias.includes(normalizedSearch) || normalizedSearch.includes(alias)));
  });
  const visible = normalizedSearch ? matches : caseConfigs.filter((config) => config.caseType !== "Other / Not Sure");

  return (
    <div className="rounded-3xl border border-teal-100 bg-slate-50 p-5">
      <label className="block"><span className="mb-2 block font-black text-teal-800">Case Type</span><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search legal issue type..." className="w-full rounded-xl border border-slate-200 bg-white p-3 font-semibold outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" /></label>
      <p className="mt-3 inline-flex rounded-full bg-teal-100 px-3 py-1 text-xs font-black text-teal-800">Selected: {selected}</p>
      <div className="mt-4 grid max-h-72 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
        {visible.map((config) => <button key={config.caseType} type="button" onClick={() => onSelect(config.caseType)} className={`rounded-2xl border p-3 text-left text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-teal-100 ${selected === config.caseType ? "border-teal-500 bg-teal-600 text-white" : "border-slate-200 bg-white text-slate-800 hover:border-teal-300"}`}>{config.caseType}</button>)}
      </div>
      {normalizedSearch && matches.length === 0 && <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900">No exact match found. You can choose Other / Not Sure and explain your issue.</p>}
      <button type="button" onClick={() => onSelect("Other / Not Sure")} className={`mt-4 w-full rounded-2xl border p-4 text-left font-black focus:outline-none focus:ring-4 focus:ring-teal-100 ${selected === "Other / Not Sure" ? "border-amber-500 bg-amber-500 text-slate-950" : "border-amber-200 bg-amber-50 text-amber-900"}`}>Other / Not Sure</button>
    </div>
  );
}

function CustomItemsEditor({ type, enabled, value, items, onChange, onAdd, onRemove }: { type: "proof" | "relief"; enabled: boolean; value: string; items: string[]; onChange: (value: string) => void; onAdd: () => void; onRemove: (value: string) => void }) {
  if (!enabled && items.length === 0) return null;
  const isProof = type === "proof";
  return (
    <div className="mt-5 rounded-3xl border border-teal-100 bg-teal-50 p-5">
      <label className="block"><span className="mb-2 block font-black text-teal-900">{isProof ? "Describe other proof/document" : "Describe other relief/outcome"}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={isProof ? "Example: old land papers, family documents, sale deed photo, revenue record, notice copy, witness details..." : "Example: stop sale, claim share, refund, apology, document correction, authority action, legal review..."} className="w-full rounded-xl border border-teal-200 bg-white p-3 font-semibold outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" /></label>
      <button type="button" onClick={onAdd} className="mt-3 rounded-full bg-teal-600 px-5 py-3 font-black text-white hover:bg-teal-700">{isProof ? "Add Custom Proof" : "Add Custom Relief"}</button>
      {items.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{items.map((item) => <span key={item} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow"><span>{item}</span><button type="button" onClick={() => onRemove(item)} className="rounded-full bg-red-50 px-2 py-1 text-xs font-black text-red-700">Remove</button></span>)}</div>}
    </div>
  );
}

function Input({ label, name, value, onChange, type = "text" }: { label: string; name: string; value: string; onChange: (event: React.ChangeEvent<HTMLInputElement>) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block font-semibold">{label}</span>
      <input name={name} type={type} value={value} onChange={onChange} className="w-full rounded-xl border p-3 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" />
    </label>
  );
}
