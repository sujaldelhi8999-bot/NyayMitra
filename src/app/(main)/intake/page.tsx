"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { aiClassifyCase, type AiClientError } from "@/lib/aiClient";
import { getOutputModeForCase, caseConfigs, getCaseConfig, outputModeLabel, resolveOutputMode } from "@/lib/caseConfig";
import { normalizeCaseStatus } from "@/lib/caseStatus";
import { type Language, translate, useLanguage } from "@/lib/i18n";
import type { CaseData, AiClassification, UploadedFile } from "@/types/case";
import { generateComplaintDraft } from "@/lib/draftTemplates";
import { OTHER_PROOF_OPTION, OTHER_RELIEF_OPTION } from "@/lib/constants";

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

  const [errors, setErrors] = useState<string[]>([]);
  const [followUpAnswers, setFollowUpAnswers] = useState<Record<string, string>>({});
  const [selectedCategory, setSelectedCategory] = useState(uploadCategories[0]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [isEditingSavedCase, setIsEditingSavedCase] = useState(false);
  const [mode, setMode] = useState<"full" | "guided">("full");
  const [wizardStep, setWizardStep] = useState(0);
  const [draftFound, setDraftFound] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  const [voiceMessage, setVoiceMessage] = useState("");
  const [otherClassifying, setOtherClassifying] = useState(false);
  const [caseTypeSearch, setCaseTypeSearch] = useState("");
  const [customProofInput, setCustomProofInput] = useState("");
  const [customReliefInput, setCustomReliefInput] = useState("");
  const [wizardExpanded, setWizardExpanded] = useState<Set<number>>(new Set([0]));

  const [aiState, setAiState] = useState<{
    analysis: CaseData["aiAnalysis"];
    followupQuestions: string[];
    advisorChats?: AdvisorChat[];
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
  }

  function isAiError(result: unknown): result is AiClientError {
    return Boolean(result && typeof result === "object" && "error" in result);
  }

  function showAiError(result: AiClientError, fallbackMessage = "AI could not respond. Rule-based mode is still available.") {
    const message = result.error || fallbackMessage;
    setAiMessage(message);
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

    // Save to dashboard
    const draft = formData.complaintDraft || generateComplaintDraft({ ...formData, followUpAnswers });
    const now = new Date().toISOString();
    const caseToSave = {
      ...formData,
      followUpAnswers,
      customProofs: formData.customProofs || [],
      customReliefs: formData.customReliefs || [],
      complaintDraft: draft,
      caseId: formData.caseId || `CASE-${Date.now()}`,
      createdAt: formData.createdAt || now,
      updatedAt: now,
      status: normalizeCaseStatus(formData.status),
      language,
      outputMode: getOutputModeForCase(formData),
    };
    try {
      const savedCases = JSON.parse(localStorage.getItem("nyaymitra_saved_cases") || "[]") as CaseData[];
      const withoutDuplicate = savedCases.filter((item) => item.caseId !== caseToSave.caseId);
      localStorage.setItem("nyaymitra_case_data", JSON.stringify(caseToSave));
      localStorage.setItem("nyaymitra_saved_cases", JSON.stringify([caseToSave, ...withoutDuplicate]));
    } catch {}

    router.push("/preview");
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
            
            <div className="mt-6 space-y-3 md:hidden">
              {wizardSteps.map((step, index) => {
                const isExpanded = wizardExpanded.has(index);
                const isCurrent = index === wizardStep;
                const isCompleted = index < wizardStep;
                return (
                  <article key={index} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setWizardExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(index)) next.delete(index);
                        else next.add(index);
                        return next;
                      })}
                      className="w-full flex items-center justify-between gap-4 p-4 text-left focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
                      aria-expanded={isExpanded}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${isCurrent ? "bg-teal-600 text-white" : isCompleted ? "bg-teal-500 text-white" : "bg-slate-200 text-slate-600"}`}>
                          {isCompleted ? (
                            <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          ) : (
                            index + 1
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className={`font-semibold truncate ${isCurrent ? "text-teal-700" : "text-slate-900"}`}>{step.title}</p>
                          <p className="text-xs text-slate-500 truncate">{step.instruction}</p>
                        </div>
                      </div>
                      <svg className={`size-5 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50 p-4 animate-in slide-in-from-top-2 duration-150">
                        {index === 0 && <><Input label={t("fullName")} name="fullName" value={formData.fullName} onChange={handleInputChange} className="min-h-[48px]" /><Input label={t("contact")} name="contact" value={formData.contact} onChange={handleInputChange} className="min-h-[48px]" /><Input label={t("stateOrUT")} name="stateOrUT" value={formData.stateOrUT || ""} onChange={handleInputChange} className="min-h-[48px]" /><div><CaseTypeSelector selected={formData.caseType} search={caseTypeSearch} onSearch={setCaseTypeSearch} onSelect={selectCaseType} /></div></>}
                        {index === 1 && <><Input label={t("incidentDate")} type="date" name="incidentDate" value={formData.incidentDate} onChange={handleInputChange} max={todayISO} className="min-h-[48px]" /><Input label={t("amountLost")} type="number" name="amountLost" value={formData.amountLost} onChange={handleInputChange} className="min-h-[48px]" /></>}
                        {index === 2 && <label className="block"><span className="mb-2 block font-semibold">{t("story")}</span><textarea name="story" value={formData.story} onChange={handleInputChange} rows={6} className="w-full rounded-lg border p-3 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100 min-h-[120px]" /></label>}

                        {index === 3 && <Input label={t("oppositeParty")} name="oppositeParty" value={formData.oppositeParty} onChange={handleInputChange} className="min-h-[48px]" />}
                        {index === 4 && <div><h3 className="mb-3 font-black">{t("proofAvailable")}</h3><div className="grid gap-3">{proofOptions.map((proof) => <label key={proof} className="flex items-center gap-3 rounded-lg border bg-slate-50 p-3 min-h-[48px]"><input type="checkbox" value={proof} checked={formData.proofs.includes(proof)} onChange={(e) => handleCheckboxChange(e, "proofs")} />{proof}</label>)}</div><CustomItemsEditor type="proof" enabled={formData.proofs.includes(OTHER_PROOF_OPTION)} value={customProofInput} items={formData.customProofs || []} onChange={setCustomProofInput} onAdd={addCustomProof} onRemove={removeCustomProof} /></div>}
                        {index === 5 && <div><h3 className="mb-3 font-black">{t("reliefWanted")}</h3><div className="grid gap-3">{reliefOptions.map((item) => <label key={item} className="flex items-center gap-3 rounded-lg border bg-slate-50 p-3 min-h-[48px]"><input type="checkbox" value={item} checked={formData.relief.includes(item)} onChange={(e) => handleCheckboxChange(e, "relief")} />{item}</label>)}</div><CustomItemsEditor type="relief" enabled={formData.relief.includes(OTHER_RELIEF_OPTION)} value={customReliefInput} items={formData.customReliefs || []} onChange={setCustomReliefInput} onAdd={addCustomRelief} onRemove={removeCustomRelief} /></div>}
                        {index === 6 && <div className="rounded-lg bg-slate-50 p-5"><p><b>{t("fullName")}:</b> {formData.fullName || "-"}</p><p><b>{t("amountLost")}:</b> ₹{formData.amountLost || "-"}</p><p><b>{t("proofAvailable")}:</b> {formData.proofs.filter((item) => item !== OTHER_PROOF_OPTION).length} standard + {(formData.customProofs || []).length} custom</p><p><b>{t("reliefWanted")}:</b> {[...formData.relief.filter((item) => item !== OTHER_RELIEF_OPTION), ...(formData.customReliefs || [])].join(", ") || "-"}</p></div>}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            <div className="hidden md:block">
              <p className="mt-5 text-sm font-black uppercase tracking-[0.2em] text-teal-700">Step {wizardStep + 1} of {wizardSteps.length}: {wizardSteps[wizardStep].title}</p>
              <h2 className="mt-2 text-3xl font-black">{wizardSteps[wizardStep].title}</h2>
              <p className="mt-2 font-semibold leading-7 text-slate-600">{wizardSteps[wizardStep].instruction}</p>
              <button type="button" onClick={readStepAloud} className="mt-4 rounded-lg bg-slate-950 px-5 py-3 font-bold text-white">{t("readAloud")}</button>
              {voiceMessage && <p className="mt-3 rounded-lg bg-amber-100 p-3 text-sm font-bold text-amber-900" aria-live="polite">{voiceMessage}</p>}

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                {wizardStep === 0 && <><Input label={t("fullName")} name="fullName" value={formData.fullName} onChange={handleInputChange} className="min-h-[48px]" /><Input label={t("contact")} name="contact" value={formData.contact} onChange={handleInputChange} className="min-h-[48px]" /><Input label={t("stateOrUT")} name="stateOrUT" value={formData.stateOrUT || ""} onChange={handleInputChange} className="min-h-[48px]" /><div className="md:col-span-2"><CaseTypeSelector selected={formData.caseType} search={caseTypeSearch} onSearch={setCaseTypeSearch} onSelect={selectCaseType} /></div></>}
                {wizardStep === 1 && <><Input label={t("incidentDate")} type="date" name="incidentDate" value={formData.incidentDate} onChange={handleInputChange} max={todayISO} className="min-h-[48px]" /><Input label={t("amountLost")} type="number" name="amountLost" value={formData.amountLost} onChange={handleInputChange} className="min-h-[48px]" /></>}
                {wizardStep === 2 && <label className="block md:col-span-2"><span className="mb-2 block font-semibold">{t("story")}</span><textarea name="story" value={formData.story} onChange={handleInputChange} rows={6} className="w-full rounded-lg border p-3 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100 min-h-[120px]" /></label>}

                {wizardStep === 3 && <Input label={t("oppositeParty")} name="oppositeParty" value={formData.oppositeParty} onChange={handleInputChange} className="min-h-[48px]" />}
                {wizardStep === 4 && <div className="md:col-span-2"><h3 className="mb-3 font-black">{t("proofAvailable")}</h3><div className="grid gap-3 md:grid-cols-2">{proofOptions.map((proof) => <label key={proof} className="flex items-center gap-3 rounded-lg border bg-slate-50 p-3 min-h-[48px]"><input type="checkbox" value={proof} checked={formData.proofs.includes(proof)} onChange={(e) => handleCheckboxChange(e, "proofs")} />{proof}</label>)}</div><CustomItemsEditor type="proof" enabled={formData.proofs.includes(OTHER_PROOF_OPTION)} value={customProofInput} items={formData.customProofs || []} onChange={setCustomProofInput} onAdd={addCustomProof} onRemove={removeCustomProof} /></div>}
                {wizardStep === 5 && <div className="md:col-span-2"><h3 className="mb-3 font-black">{t("reliefWanted")}</h3><div className="grid gap-3 md:grid-cols-2">{reliefOptions.map((item) => <label key={item} className="flex items-center gap-3 rounded-lg border bg-slate-50 p-3 min-h-[48px]"><input type="checkbox" value={item} checked={formData.relief.includes(item)} onChange={(e) => handleCheckboxChange(e, "relief")} />{item}</label>)}</div><CustomItemsEditor type="relief" enabled={formData.relief.includes(OTHER_RELIEF_OPTION)} value={customReliefInput} items={formData.customReliefs || []} onChange={setCustomReliefInput} onAdd={addCustomRelief} onRemove={removeCustomRelief} /></div>}
                {wizardStep === 6 && <div className="md:col-span-2 rounded-lg bg-slate-50 p-5"><p><b>{t("fullName")}:</b> {formData.fullName || "-"}</p><p><b>{t("amountLost")}:</b> ₹{formData.amountLost || "-"}</p><p><b>{t("proofAvailable")}:</b> {formData.proofs.filter((item) => item !== OTHER_PROOF_OPTION).length} standard + {(formData.customProofs || []).length} custom</p><p><b>{t("reliefWanted")}:</b> {[...formData.relief.filter((item) => item !== OTHER_RELIEF_OPTION), ...(formData.customReliefs || [])].join(", ") || "-"}</p></div>}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" onClick={() => setWizardStep((step) => Math.max(0, step - 1))} className="rounded-lg bg-slate-100 px-5 py-3.5 font-bold text-slate-700 min-h-[48px]">{t("previous")}</button>
                <button type="button" onClick={() => setWizardStep((step) => Math.min(wizardSteps.length - 1, step + 1))} className="rounded-lg bg-slate-950 px-5 py-3.5 font-bold text-white min-h-[48px]">{t("next")}</button>
                <button type="button" onClick={saveProgress} className="rounded-lg bg-teal-100 px-5 py-3.5 font-bold text-teal-900 min-h-[48px]">{t("saveProgress")}</button>
                {wizardStep === wizardSteps.length - 1 && <button type="button" onClick={handleGenerate} className="rounded-lg bg-teal-600 px-5 py-3.5 font-black text-white min-h-[48px]">{t("generateSummary")}</button>}
              </div>
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
              className="w-full rounded-lg border p-3 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100 min-h-[120px]"
                placeholder={t("storyPlaceholder")}
              />
            </div>



          {formData.caseType === "Other / Not Sure" && (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5 text-slate-950">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-700">{t("otherNotSureFlow")}</p>
              <h2 className="mt-2 text-2xl font-black">{t("explainLegalProblem")}</h2>
              <div className="mt-5 grid gap-4">
                <label className="block"><span className="font-bold">{t("whatHappened")}</span><textarea value={formData.story} onChange={(event) => setCaseData((current) => ({ ...current, story: event.target.value }))} rows={4} className="mt-2 w-full rounded-lg border border-amber-200 bg-white p-3 outline-none focus:border-amber-500 min-h-[120px]" /></label>
                <Input label={t("whoIsInvolved")} name="oppositeParty" value={formData.oppositeParty} onChange={handleInputChange} className="min-h-[48px]" />
                <Input label={t("whenDidItHappen")} type="date" name="incidentDate" value={formData.incidentDate} onChange={handleInputChange} className="min-h-[48px]" />
                <label className="block"><span className="font-bold">{t("urgentDangerOrDeadline")}</span><textarea onChange={(event) => setCaseData((current) => ({ ...current, story: `${current.story}\nUrgency/deadline: ${event.target.value}` }))} rows={2} className="mt-2 w-full rounded-lg border border-amber-200 bg-white p-3 outline-none focus:border-amber-500 min-h-[80px]" /></label>
                <label className="block"><span className="font-bold">{t("whatDocumentsOrProof")}</span><textarea onChange={(event) => setCaseData((current) => ({ ...current, story: `${current.story}\nDocuments/proof: ${event.target.value}` }))} rows={2} className="mt-2 w-full rounded-lg border border-amber-200 bg-white p-3 outline-none focus:border-amber-500 min-h-[80px]" /></label>
                <label className="block"><span className="font-bold">{t("whatOutcomeDoYouWant")}</span><textarea onChange={(event) => setCaseData((current) => ({ ...current, story: `${current.story}\nOutcome wanted: ${event.target.value}` }))} rows={2} className="mt-2 w-full rounded-lg border border-amber-200 bg-white p-3 outline-none focus:border-amber-500 min-h-[80px]" /></label>
                <label className="block"><span className="font-bold">{t("hasAnythingBeenFiled")}</span><textarea onChange={(event) => setCaseData((current) => ({ ...current, story: `${current.story}\nAlready filed: ${event.target.value}` }))} rows={2} className="mt-2 w-full rounded-lg border border-amber-200 bg-white p-3 outline-none focus:border-amber-500 min-h-[80px]" /></label>
              </div>
              <button type="button" onClick={handleOtherClassification} className="mt-5 rounded-lg bg-amber-500 px-6 py-3.5 font-black text-slate-950 hover:bg-amber-400 min-h-[48px]">{otherClassifying ? t("aiAnalyzingCase") : t("aiUnderstanding")}</button>
              {formData.aiAnalysis?.classification && <div className="mt-5 rounded-lg bg-white p-4"><h3 className="text-xl font-black">{t("aiClassificationReady")}</h3><div className="mt-3 grid gap-3 md:grid-cols-2"><p><b>{t("probableCaseType")}</b> {formData.aiAnalysis.classification.caseType}</p><p><b>{t("confidence")}</b> {formData.aiAnalysis.classification.confidence}%</p><p><b>{t("outputMode")}</b> {outputModeLabel(formData.aiAnalysis.classification.outputMode)}</p><p><b>{t("riskLevel")}</b> {formData.aiAnalysis.classification.riskLevel}</p><p className="md:col-span-2"><b>{t("riskReason")}</b> {formData.aiAnalysis.classification.riskReason}</p><p className="md:col-span-2"><b>{t("shortSummary")}</b> {formData.aiAnalysis.classification.shortSummary}</p><p className="md:col-span-2"><b>{t("suggestedProofs")}</b> {formData.aiAnalysis.classification.suggestedProofs?.join(", ") || "Not provided"}</p><p className="md:col-span-2"><b>{t("suggestedReliefs")}</b> {formData.aiAnalysis.classification.suggestedReliefs?.join(", ") || "Not provided"}</p><p className="md:col-span-2"><b>{t("missingDetails")}</b> {formData.aiAnalysis.classification.missingDetails?.join(", ") || "Not provided"}</p><p className="md:col-span-2"><b>{t("nextSteps")}</b> {formData.aiAnalysis.classification.nextSteps?.join(", ") || "Not provided"}</p><p><b>{t("lawyerReviewRecommended")}</b> {formData.aiAnalysis.classification.lawyerReviewRecommended ? "Yes" : "No"}</p></div><div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={useSuggestedCaseType} className="rounded-lg bg-teal-600 px-5 py-3.5 font-bold text-white min-h-[48px]">{t("useAISuggestedCaseType")}</button><button type="button" className="rounded-lg bg-slate-100 px-5 py-3.5 font-bold text-slate-700 min-h-[48px]">{t("keepAsOtherNotSure")}</button></div></div>}
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
              <CardTable
                columns={[
                  { key: "annexure", header: t("annexureNo"), render: (row) => row.annexure },
                  { key: "fileName", header: t("fileName"), render: (row) => <span className="font-semibold">{row.fileName}</span> },
                  { key: "category", header: t("category"), render: (row) => row.category },
                  { key: "type", header: t("type"), render: (row) => row.type },
                  { key: "size", header: t("size"), render: (row) => row.size },
                  { key: "uploadedAt", header: t("uploadedAt"), render: (row) => row.uploadedAt },
                  { key: "remove", header: t("remove"), render: (row) => <button type="button" onClick={() => handleRemoveEvidenceFile(row.id)} className="rounded-lg bg-red-50 px-3 py-1.5 font-bold text-red-700 min-h-[48px] min-w-[48px]">{t("removeBtn")}</button> },
                ]}
                data={formData.uploadedFiles.map((file, index) => ({
                  annexure: `A${index + 1}`,
                  fileName: file.fileName,
                  category: file.evidenceCategory,
                  type: file.fileType,
                  size: formatFileSize(file.fileSize),
                  uploadedAt: new Date(file.uploadedAt).toLocaleString(),
                  id: file.id,
                }))}
                keyExtractor={(row) => row.id}
                emptyMessage={t("kitNoUploadedAnnexureFiles")}
              />
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
      </section>
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

function Input({ label, name, value, onChange, type = "text", max, className = "" }: { label: string; name: string; value: string; onChange: (event: React.ChangeEvent<HTMLInputElement>) => void; type?: string; max?: string; className?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block font-semibold">{label}</span>
      <input name={name} type={type} value={value} onChange={onChange} max={max} className={`w-full rounded-lg border p-3 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100 min-h-[48px] ${className}`} />
    </label>
  );
}

