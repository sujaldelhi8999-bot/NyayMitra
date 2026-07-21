"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  aiAskAdvisor,
  aiGenerateFollowups,
  aiGenerateDraft,
  aiReviewCase,
  type AiClientError,
} from "@/lib/aiClient";
import {
  getOutputModeForCase,
  outputModeLabel,
} from "@/lib/caseConfig";
import { normalizeCaseStatus } from "@/lib/caseStatus";
import { type Language, translate, useLanguage } from "@/lib/i18n";
import { buildOfficialActionSuggestions } from "@/lib/officialPortals";
import type {
  CaseData,
  AiReview,
  AdvisorChat,
} from "@/types/case";
import { generateComplaintDraft } from "@/lib/draftTemplates";
import { generateLegalKitPdf } from "@/lib/generatePdf";
import { calculateCaseQualityScore } from "@/lib/qualityScore";
import { TouchSelect } from "@/components/touch-select";
import { PortalCard } from "@/components/portal-card";
import { SourceTag } from "@/components/source-tag";
import { CardTable } from "@/components/card-table";
import {
  getMissingProofSuggestions,
  getVerifiedSourceNotes,
  hasLawHallucinationRisk,
  getNextStepsChecklist,
  getMergedFollowUpQuestions,
  calculateRiskLevel,
} from "@/lib/caseUtils";
import {
  OTHER_PROOF_OPTION,
  OTHER_RELIEF_OPTION,
  storyKeywords,
  propertyKeywords,
  consumerKeywords,
  rtiKeywords,
} from "@/lib/constants";

export default function PreviewPage() {
  return <PreviewContent />;
}

function PreviewContent() {
  const router = useRouter();
  const { language: contextLanguage } = useLanguage();
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [language, setLanguage] = useState<Language>("en");
  const [editableDraft, setEditableDraft] = useState("");
  const [draftLanguage, setDraftLanguage] = useState<Language>("en");
  const [draftMessage, setDraftMessage] = useState("");
  const [followUpAnswers, setFollowUpAnswers] = useState<Record<string, string>>({});
  const [updateMessage, setUpdateMessage] = useState("");
  const [aiLoading, setAiLoading] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [extraFollowUpQuestions, setExtraFollowUpQuestions] = useState<string[]>([]);
  const [pdfLanguage, setPdfLanguage] = useState<Language>("en");
  const [downloadError, setDownloadError] = useState("");
  const [advisorQuestion, setAdvisorQuestion] = useState("");
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorMessage, setAdvisorMessage] = useState("");
  const [, setAiState] = useState<{
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

  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  const downloadLangOptions = [
    { value: "en", label: "English" },
    { value: "hi", label: "हिन्दी" },
  ];

  const exportOptions = [
    { value: "json", label: t("exportJson") },
    { value: "pdf", label: t("downloadPdf") },
  ];

  useEffect(() => {
    let cancelled = false;
    window.setTimeout(() => {
      if (cancelled) return;
      try {
        const saved = localStorage.getItem("nyaymitra_case_data");
        if (saved) {
          const parsed = JSON.parse(saved) as CaseData;
          const normalized = {
            ...parsed,
            uploadedFiles: parsed.uploadedFiles || [],
            customProofs: parsed.customProofs || [],
            customReliefs: parsed.customReliefs || [],
            followUpAnswers: parsed.followUpAnswers || {},
            status: normalizeCaseStatus(parsed.status),
          };
          setCaseData(normalized);
          setLanguage(parsed.language || contextLanguage);
          setDraftLanguage(parsed.language || contextLanguage);
          setEditableDraft(parsed.complaintDraft || "");
          setFollowUpAnswers(parsed.followUpAnswers || {});

        }
      } catch {}
      setLoaded(true);
    }, 0);
    return () => { cancelled = true; };
  }, [contextLanguage]);

  if (!loaded) return null;

  if (!caseData) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
        <div className="mx-auto max-w-3xl rounded-lg bg-white p-8 text-center text-slate-950 shadow-2xl">
          <h1 className="text-3xl font-black">{t("kitNoData")}</h1>
          <Link href="/dashboard" className="mt-6 inline-flex rounded-lg bg-teal-600 px-6 py-3 font-bold text-white">{t("backDashboard")}</Link>
        </div>
      </main>
    );
  }

  const outputMode = getOutputModeForCase(caseData);
  const quality = calculateCaseQualityScore(caseData);
  const proofOptions = Array.from(new Set([...(caseData.proofs || []), OTHER_PROOF_OPTION]));
  const missingProofs = proofOptions.filter((proof) => proof !== OTHER_PROOF_OPTION && !caseData.proofs.includes(proof));
  const displayedMissingProofs = getMissingProofSuggestions(caseData, missingProofs);
  const storyWarning = getStoryQualityWarning(caseData, language);
  const caseTypeMismatch = detectCaseTypeMismatch(caseData, language);
  const amountMismatch = getLocalizedAmountMismatch(caseData, language);
  const riskLabel = getCaseRiskLabel(caseData);

  function persistCase(next: CaseData) {
    try {
      const savedCases = JSON.parse(localStorage.getItem("nyaymitra_saved_cases") || "[]") as CaseData[];
      const withoutDuplicate = savedCases.filter((item) => item.caseId !== next.caseId);
      localStorage.setItem("nyaymitra_case_data", JSON.stringify(next));
      localStorage.setItem("nyaymitra_saved_cases", JSON.stringify([next, ...withoutDuplicate]));
    } catch {}
    setCaseData(next);
  }

  function editCase() {
    try {
      localStorage.setItem("nyaymitra_edit_case", JSON.stringify(caseData));
    } catch {}
    router.push("/intake?edit=true");
  }

  function handleDownloadPdf() {
    if (!caseData) return;
    setDownloadError("");
    try {
      const draft = caseData.complaintDraft || editableDraft || generateComplaintDraft(caseData, pdfLanguage);
      const updated = { ...caseData, complaintDraft: draft, language: pdfLanguage };
      persistCase(updated);
      generateLegalKitPdf(updated, pdfLanguage);
    } catch (err) {
      console.error("PDF download failed:", err);
      setDownloadError("PDF download failed. Please try again.");
    }
  }

  function handleExportJson() {
    if (!caseData) return;
    setDownloadError("");
    try {
      const draft = caseData.complaintDraft || editableDraft || generateComplaintDraft(caseData, pdfLanguage);
      const exportData = { ...caseData, language: pdfLanguage, complaintDraft: draft, officialActionSuggestions: buildOfficialActionSuggestions(caseData) };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `nyaymitra-case-${caseData.caseId || "draft"}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
      console.error("JSON export failed:", err);
      setDownloadError("JSON export failed. Please try again.");
    }
  }

  function handleGenerateDraftComplaint() {
    if (!caseData) return;
    const nextDraft = generateComplaintDraft(caseData, draftLanguage);
    setEditableDraft(nextDraft);
    persistCase({ ...caseData, complaintDraft: nextDraft });
    setDraftMessage("");
  }

  function handleResetDraft() {
    if (!caseData) return;
    setEditableDraft("");
    setDraftMessage("");
    persistCase({ ...caseData, complaintDraft: "" });
  }

  function handleDraftChange(value: string) {
    if (!caseData) return;
    setEditableDraft(value);
    persistCase({ ...caseData, complaintDraft: value });
  }

  async function handleCopyDraft() {
    if (!editableDraft) return;
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        setDraftMessage("Clipboard not available.");
        return;
      }
      await navigator.clipboard.writeText(editableDraft);
      setDraftMessage(t("msgDraftCopied"));
    } catch {
      setDraftMessage("Failed to copy.");
    }
  }

  function handleUpdatePreviewWithAnswers() {
    if (!caseData) return;
    persistCase({ ...caseData, followUpAnswers });
    setUpdateMessage(t("msgPreviewUpdated"));
  }

  function isAiError(result: unknown): result is AiClientError {
    return Boolean(result && typeof result === "object" && "error" in result);
  }

  async function handleAiFollowups() {
    if (!caseData) return;
    const current = caseData;
    setAiLoading("followup");
    setAiMessage(t("aiAnalyzingCase"));
    const result = await aiGenerateFollowups(current) as { questions?: string[] } | AiClientError;
    setAiLoading("");
    if (isAiError(result) || !result.questions) {
      setAiMessage(isAiError(result) ? result.error : "AI did not return follow-up questions.");
      return;
    }
    const questions = Array.from(new Set([...extraFollowUpQuestions, ...result.questions]));
    setExtraFollowUpQuestions(questions);
    const updated = { ...current, aiAnalysis: { ...(current.aiAnalysis || {}), followupQuestions: questions, lastAnalyzedAt: new Date().toISOString() } };
    persistCase(updated);
    setAiState((prev) => ({
      ...prev,
      followupQuestions: questions,
      analysis: { ...(prev.analysis || {}), followupQuestions: questions, lastAnalyzedAt: new Date().toISOString() },
      lastAnalyzedAt: new Date().toISOString(),
    }));
    setAiMessage(t("aiAnalysisCompleted"));
  }

  async function handleAiImproveDraft() {
    if (!caseData) return;
    const current = caseData;
    setAiLoading("draft");
    setAiMessage(t("aiAnalyzingCase"));
    const result = await aiGenerateDraft(current) as { draftText?: string } | AiClientError;
    setAiLoading("");
    if (isAiError(result) || !result.draftText) {
      setAiMessage(isAiError(result) ? result.error : "AI did not return draft text.");
      return;
    }
    setEditableDraft(result.draftText);
    persistCase({ ...current, complaintDraft: result.draftText, aiAnalysis: { ...(current.aiAnalysis || {}), generatedDraft: result.draftText, lastAnalyzedAt: new Date().toISOString() } });
    setAiState((prev) => ({
      ...prev,
      analysis: { ...(prev.analysis || {}), generatedDraft: result.draftText, lastAnalyzedAt: new Date().toISOString() },
      lastAnalyzedAt: new Date().toISOString(),
    }));
    setAiMessage(t("aiDraftGenerated"));
  }

  async function handleAiReview() {
    if (!caseData) return;
    const current = caseData;
    setAiLoading("review");
    setAiMessage(t("aiAnalyzingCase"));
    const result = await aiReviewCase(current) as AiReview | AiClientError;
    setAiLoading("");
    if (isAiError(result)) {
      setAiMessage(isAiError(result) ? result.error : "AI review failed.");
      return;
    }
    persistCase({ ...current, aiAnalysis: { ...(current.aiAnalysis || {}), review: result, lastAnalyzedAt: new Date().toISOString() } });
    setAiState((prev) => ({
      ...prev,
      analysis: { ...(prev.analysis || {}), review: result, lastAnalyzedAt: new Date().toISOString() },
      lastAnalyzedAt: new Date().toISOString(),
    }));
    setAiMessage(t("aiAnalysisCompleted"));
  }

  async function handleAskAdvisor() {
    if (!caseData || !advisorQuestion.trim()) return;
    const current = caseData;
    setAdvisorLoading(true);
    setAdvisorMessage(t("aiThinkingNyayMitra"));
    const result = await aiAskAdvisor(current, advisorQuestion) as Omit<AdvisorChat, "id" | "question" | "createdAt"> | AiClientError;
    const failed = isAiError(result);
    const fallback = {
      answer: "This matter needs legal-aid/lawyer review. NyayMitra can help organize documents but is not legal advice.",
      nextSteps: ["Organize facts in date order.", "Keep original proof safe."],
      missingInfo: [],
      riskNote: "This is preparation guidance only, not legal advice.",
      lawyerReviewRecommended: false,
    };
    const answer = failed ? fallback : result;
    const chat: AdvisorChat = { ...answer, id: `CHAT-${Date.now()}`, question: advisorQuestion, createdAt: new Date().toISOString() };
    persistCase({ ...current, advisorChats: [...(current.advisorChats || []), chat] });
    setAiState((prev) => ({ ...prev, advisorChats: [...(prev.advisorChats || []), chat] }));
    setAdvisorQuestion("");
    setAdvisorMessage(failed ? `${result.error} ${t("aiRuleBasedFallback")}` : t("aiGuidanceGenerated"));
    setAdvisorLoading(false);
  }

  const evidenceMeaning: Record<string, string> = {
    [t("proofWhatsApp")]: t("evidenceMeaningWhatsApp"),
    [t("proofUPI")]: t("evidenceMeaningUPI"),
    [t("proofBankSMS")]: t("evidenceMeaningBankSMS"),
    [t("proofPhone")]: t("evidenceMeaningPhone"),
    [t("proofEmail")]: t("evidenceMeaningEmail"),
    [t("proofPolice")]: t("evidenceMeaningPolice"),
    [OTHER_PROOF_OPTION]: t("evidenceMeaningOther"),
  };

  const activeProofOptions = Array.from(new Set([...caseData.proofs, ...(caseData.aiAnalysis?.classification?.suggestedProofs || [])]));

  return (
    <div className="bg-slate-950 text-white">
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={editCase} className="rounded-lg bg-white/10 px-5 py-3 font-bold text-white hover:bg-white/20">{t("editIntake")}</button>
            <Link href="/dashboard" className="rounded-lg border border-white/20 px-5 py-3 text-center font-bold text-white hover:bg-white/10">{t("backDashboard")}</Link>
            <TouchSelect
              value={pdfLanguage}
              placeholder={t("downloadLang")}
              options={downloadLangOptions}
              onChange={(value) => setPdfLanguage(value as Language)}
              className="w-36"
            />
            <TouchSelect
              value=""
              placeholder={`${t("exportJson")} / ${t("downloadPdf")}`}
              options={exportOptions}
              onChange={(value) => { if (value === "json") handleExportJson(); else if (value === "pdf") handleDownloadPdf(); }}
            />
          </div>
        </div>
        {downloadError && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{downloadError}</p>}

        <div className="space-y-8">
          <CaseQualityCard result={quality} />

          <div className="rounded-lg border border-teal-400/30 bg-white/10 p-6 shadow-2xl">
            <p className="mb-2 text-sm font-semibold text-teal-300">{t("preview")}</p>
            <h2 className="text-3xl font-bold">{t("caseSnapshot")}</h2>
            <p className="mt-4 text-slate-200">
              {Number(caseData.amountLost) > 0 ? <>Based on the information provided, this appears to be a <b>{caseData.caseType}</b> preparation matter where <b>{caseData.fullName}</b> reports a value/loss of <b>₹{caseData.amountLost}</b> on <b>{caseData.incidentDate}</b>. </> : <>Based on the information provided, this appears to be a <b>{caseData.caseType}</b> matter where <b>{caseData.fullName}</b> wants help organizing documents and preparing for legal-aid/lawyer review. </>}Opposite party details:{" "}
              <b>{caseData.oppositeParty || "Not provided"}</b>. The user wants help with:{" "}
              <b>
                {[...caseData.relief.filter((item) => item !== OTHER_RELIEF_OPTION), ...(caseData.customReliefs || [])].length > 0
                  ? [...caseData.relief.filter((item) => item !== OTHER_RELIEF_OPTION), ...(caseData.customReliefs || [])].join(", ")
                  : "Not selected"}
              </b>.
            </p>
            <div className="mt-5 rounded-lg bg-slate-900 p-4 text-sm text-slate-300">
              <b>{t("kitLabelUserStory")}:</b> {caseData.story}
            </div>
          </div>

          {amountMismatch && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-900 shadow-2xl">
              <h2 className="text-xl font-black">{t("labelAmountMismatch")}</h2>
              <p className="mt-2 font-semibold leading-7">{amountMismatch}</p>
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
            </div>
          )}

          <div className="space-y-6">
            <div className="rounded-lg border border-teal-400/30 bg-white/10 p-6 shadow-2xl">
              <h2 className="text-2xl font-bold">{t("riskRouter")}</h2>
              <p className="mt-3 text-xl font-bold text-teal-300">{riskLabel}</p>
              <p className="mt-3 text-slate-200">
                {outputMode === "urgent-legal-aid-route"
                  ? "Urgent legal-aid/lawyer review is recommended. NyayMitra will prepare a consultation note and document organizer only."
                  : "This case can be prepared with evidence, timeline, and a draft for review. For serious matters, contact legal aid or a lawyer."}
              </p>
              <p className="mt-4 rounded-lg bg-slate-900 p-4 text-sm text-slate-300">NyayMitra is a legal self-help tool, not a lawyer. Verify with legal aid/lawyer before filing.</p>
            </div>
            <OfficialActionLinks caseData={caseData} />
          </div>

          <div className="rounded-lg border border-teal-400/30 bg-slate-900 p-6 shadow-2xl">
            <p className="text-sm font-semibold text-teal-300">Optional AI layer</p>
            <h2 className="mt-2 text-2xl font-bold">AI Assist</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">Let NyayMitra analyze your story and improve your preparation kit. Rule-based mode still works if AI is unavailable.</p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <button type="button" onClick={handleAiFollowups} className="rounded-lg bg-white/10 px-4 py-3 font-bold text-white">{aiLoading === "followup" ? t("aiAnalyzingCase") : t("aiFollowups")}</button>
              <button type="button" onClick={handleAiImproveDraft} className="rounded-lg bg-white/10 px-4 py-3 font-bold text-white">{aiLoading === "draft" ? t("aiAnalyzingCase") : t("aiImproveDraft")}</button>
              <button type="button" onClick={handleAiReview} className="rounded-lg bg-white/10 px-4 py-3 font-bold text-white">{aiLoading === "review" ? t("aiAnalyzingCase") : t("aiReview")}</button>
            </div>
            {aiMessage && <p className="mt-3 rounded-lg bg-teal-100 p-3 text-sm font-bold text-teal-900" aria-live="polite">{aiMessage}</p>}
            {caseData.aiAnalysis && (
              <div className="mt-5 space-y-4">
                {(caseData.aiAnalysis.classification || caseData.aiAnalysis.extraction) && (
                  <div className="rounded-lg bg-white p-5 text-slate-950">
                    <h3 className="text-xl font-black">AI Analysis Result</h3>
                    {caseData.aiAnalysis.classification && <div className="mt-3 grid gap-3 md:grid-cols-2"><p><b>AI Classified Case Type:</b> {caseData.aiAnalysis.classification.caseType}</p><p><b>AI Confidence:</b> {caseData.aiAnalysis.classification.confidence}%</p><p><b>AI Output Mode:</b> {outputModeLabel(caseData.aiAnalysis.classification.outputMode)}</p><p><b>AI Risk Level:</b> {caseData.aiAnalysis.classification.riskLevel}</p><p><b>AI Risk Reason:</b> {caseData.aiAnalysis.classification.riskReason}</p><p><b>Lawyer Review:</b> {caseData.aiAnalysis.classification.lawyerReviewRecommended ? "Recommended" : "Not specifically flagged"}</p><p className="md:col-span-2"><b>AI Short Summary:</b> {caseData.aiAnalysis.classification.shortSummary}</p></div>}
                    {caseData.aiAnalysis.extraction && <div className="mt-4 grid gap-4 md:grid-cols-3"><AiBox title="AI Extracted Timeline" items={caseData.aiAnalysis.extraction.timeline.map((item) => `${item.date}: ${item.event}`)} /><AiBox title="AI Parties" items={caseData.aiAnalysis.extraction.parties} /><AiBox title="AI Missing Details" items={caseData.aiAnalysis.extraction.missingDetails} /></div>}
                  </div>
                )}
                {caseData.aiAnalysis.followupQuestions && <AiBox title="AI Suggested Follow-up Questions" items={caseData.aiAnalysis.followupQuestions} />}
                {caseData.aiAnalysis.review && <div className="rounded-lg bg-white p-5 text-slate-950"><h3 className="text-xl font-black">AI Case Review</h3><p className="mt-2"><b>Quality score:</b> {caseData.aiAnalysis.review.qualityScore}</p><div className="mt-4 grid gap-4 md:grid-cols-2"><AiBox title="Strengths" items={caseData.aiAnalysis.review.strengths} /><AiBox title="Weaknesses" items={caseData.aiAnalysis.review.weaknesses} /><AiBox title="Missing proof" items={caseData.aiAnalysis.review.missingProof} /><AiBox title="Suggestions" items={caseData.aiAnalysis.review.suggestions} /></div></div>}
                {getVerifiedSourceNotes(caseData).length > 0 && <AiBox title="Verified Sources Used" items={getVerifiedSourceNotes(caseData).map((source) => `${source.title} - ${source.sourceName}`)} />}
                {hasLawHallucinationRisk(caseData.aiAnalysis, getVerifiedSourceNotes(caseData)) && <p className="rounded-lg bg-red-100 p-3 text-sm font-bold text-red-800">{t("kitAiHallucinationRisk")}</p>}
              </div>
            )}
          </div>

          <div className="rounded-lg bg-white p-6 text-slate-950 shadow-2xl">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">Safe preparation guidance</p>
            <h2 className="mt-2 text-3xl font-black">{t("sectionAdvisor")}</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">Ask NyayMitra for preparation guidance, possible routes, risks, and next steps. This is not legal advice.</p>
            <p className="mt-3 rounded-lg bg-slate-950 p-4 text-sm font-semibold text-white">NyayMitra can explain preparation options and next steps, but it is not a substitute for a licensed advocate. Please verify important decisions with legal aid or a lawyer.</p>
            <textarea value={advisorQuestion} onChange={(event) => setAdvisorQuestion(event.target.value)} rows={3} className="mt-5 w-full rounded-lg border border-slate-200 bg-slate-50 p-4 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" placeholder="Ask a question about your case preparation..." />
            <button type="button" onClick={handleAskAdvisor} className="mt-4 rounded-lg bg-teal-600 px-6 py-3 font-black text-white hover:bg-teal-700">{advisorLoading ? t("aiThinkingNyayMitra") : t("aiAskAdvisor")}</button>
            {advisorMessage && <p className="mt-3 rounded-lg bg-teal-100 p-3 text-sm font-bold text-teal-900" aria-live="polite">{advisorMessage}</p>}
            {(caseData.advisorChats || []).length > 0 && <div className="mt-5 space-y-4">{caseData.advisorChats?.map((chat) => <AdvisorChatCard key={chat.id} chat={chat} />)}</div>}
          </div>

          <div className="space-y-6">
            <div className="rounded-lg bg-white p-6 text-slate-900 shadow-2xl">
              <h2 className="text-2xl font-bold">{t("timeline")}</h2>
              <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                <div className="rounded-lg bg-slate-100 p-4"><p className="font-bold">1. Incident</p><p className="text-sm">{caseData.incidentDate}</p></div>
                <div className="rounded-lg bg-slate-100 p-4"><p className="font-bold">2. Loss</p><p className="text-sm">₹{caseData.amountLost}</p></div>
                <div className="rounded-lg bg-slate-100 p-4"><p className="font-bold">3. Evidence</p><p className="text-sm">{caseData.proofs.filter((item) => item !== OTHER_PROOF_OPTION).length} standard + {(caseData.customProofs || []).length} custom</p></div>
                <div className="rounded-lg bg-slate-100 p-4"><p className="font-bold">4. Complaint</p><p className="text-sm">{caseData.proofs.includes("Police/cyber complaint acknowledgement") ? "Already initiated" : "Not filed yet"}</p></div>
                <div className="rounded-lg bg-teal-100 p-4"><p className="font-bold">5. Next Step</p><p className="text-sm">{outputMode === "urgent-legal-aid-route" ? "Prepare consultation note" : "Prepare draft for review"}</p></div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-6 text-slate-900 shadow-2xl">
              <h2 className="text-2xl font-bold">{t("evidenceTable")}</h2>
              <CardTable
                columns={[
                  { key: "annexure", header: t("kitLabelAnnexureNo"), render: (row) => row.annexure },
                  { key: "evidence", header: t("kitLabelEvidence"), render: (row) => <span className="flex items-center gap-2">{row.evidence} <SourceTag source={row.source} /></span> },
                  { key: "status", header: "Available?", render: (row) => row.status },
                  { key: "fileName", header: "Uploaded File Name", render: (row) => row.fileName },
                  { key: "proves", header: t("kitLabelProves"), render: (row) => row.proves },
                  { key: "action", header: "Suggested action", render: (row) => row.action },
                ]}
                data={[
                  ...activeProofOptions.filter((proof) => proof !== OTHER_PROOF_OPTION),
                  ...(caseData.customProofs || []),
                ].map((proof) => {
                  const custom = (caseData.customProofs || []).includes(proof);
                  const available = caseData.proofs.includes(proof);
                  const uploadedFile = caseData.uploadedFiles.find((file) => file.evidenceCategory === proof);
                  const isAiSuggested = caseData.aiAnalysis?.classification?.suggestedProofs?.includes(proof) || false;
                  const source: "rule" | "ai" = isAiSuggested ? "ai" : "rule";
                  const annexure = uploadedFile ? `A${caseData.uploadedFiles.findIndex((file) => file.id === uploadedFile.id) + 1}` : "-";
                  const status = custom || available ? "Yes" : t("kitLabelMissing");
                  const fileName = uploadedFile?.fileName || (custom ? "Custom proof added, file not uploaded yet." : available ? "Marked available, file not uploaded yet." : "No file / not marked.");
                  const proves = custom ? "User-provided supporting proof." : evidenceMeaning[proof] || "Supports the facts, timeline, identity, communication, authority history, or requested relief.";
                  const action = custom ? "Keep original copy safe." : available ? "Attach this in the final PDF." : "Try to collect this before final PDF.";
                  return { annexure, evidence: proof, status, fileName, proves, action, source };
                })}
                keyExtractor={(row) => row.evidence}
                emptyMessage={t("kitNoEvidenceToBeAdded")}
              />
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 text-slate-900 shadow-2xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">Rule-based draft generator</p>
                <h2 className="mt-2 text-3xl font-black text-slate-950">{outputMode === "urgent-legal-aid-route" ? t("sectionDraftLegalAid") : t("editableDraft")}</h2>
                <p className="mt-2 text-sm font-semibold text-slate-600">Generated locally from your case details. Review and edit before using.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <label className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-700">{t("draftLanguageLabel")}:</span>
                  <select value={draftLanguage} onChange={(e) => {
                    const lang = e.target.value as Language;
                    setDraftLanguage(lang);
                    if (caseData) persistCase({ ...caseData, language: lang });
                  }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-teal-500">
                    <option value="en">{t("draftLangEnglish")}</option>
                    <option value="hi">{t("draftLangHindi")}</option>
                  </select>
                </label>
                <button type="button" onClick={handleGenerateDraftComplaint} className="rounded-lg bg-teal-600 px-5 py-3 font-bold text-white hover:bg-teal-700">{outputMode === "urgent-legal-aid-route" ? t("btnGenerateLegalAid") : t("btnGenerateDraft")}</button>
                <button type="button" onClick={handleResetDraft} className="rounded-lg bg-slate-100 px-5 py-3 font-bold text-slate-700 hover:bg-slate-200">{t("btnResetDraft")}</button>
                <button type="button" onClick={handleCopyDraft} className="rounded-lg bg-slate-950 px-5 py-3 font-bold text-white hover:bg-slate-800">{t("btnCopyDraft")}</button>
              </div>
            </div>
            <textarea value={editableDraft} onChange={(event) => handleDraftChange(event.target.value)} rows={18} className="mt-6 w-full rounded-lg border border-slate-200 bg-slate-50 p-5 font-mono text-sm leading-7 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" placeholder={outputMode === "urgent-legal-aid-route" ? t("msgNoLegalAidDraft") : t("msgNoDraft")} />
            {editableDraft && <DraftQualityCard result={analyzeDraftQuality(editableDraft, caseData)} />}
            {draftMessage && <p className="mt-4 rounded-lg bg-teal-100 p-3 text-sm font-bold text-teal-900">{draftMessage}</p>}
          </div>

          <div className="space-y-6">
            <div className="rounded-lg bg-white p-6 text-slate-900 shadow-2xl">
              <h2 className="text-2xl font-bold">{t("missingProof")}</h2>
              {displayedMissingProofs.length === 0 ? (
                <p className="mt-3 rounded-lg bg-green-100 p-4">{t("labelNoMissing")}</p>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {displayedMissingProofs.map((item) => (
                    <div key={item} className="rounded-lg border border-orange-300 bg-orange-50 p-4 flex items-center gap-2">
                      <SourceTag source="rule" />
                      <b>{t("labelMissingProofs")}</b> {item}. Try to collect this before final PDF.
                    </div>
                  ))}
                </div>
              )}
              {(caseData.customProofs || []).length > 0 && <p className="mt-4 rounded-lg bg-teal-50 p-4 text-sm font-bold text-teal-900">{t("labelCustomProofsNote")}</p>}
            </div>

            <div className="rounded-lg border border-teal-400/30 bg-slate-900 p-6 shadow-2xl">
              <p className="text-sm font-semibold text-teal-300">Rule-based preparation assistant</p>
              <h2 className="mt-2 text-2xl font-bold">{t("followUps")}</h2>
              <div className="mt-5 space-y-4">
                {getMergedFollowUpQuestions(caseData).map(({ question, source }) => (
                  <label key={question} className="block rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-slate-100">{question}</span>
                      <SourceTag source={source} />
                    </div>
                    <textarea value={followUpAnswers[question] || ""} onChange={(event) => setFollowUpAnswers((current) => ({ ...current, [question]: event.target.value }))} rows={3} className="mt-3 w-full rounded-lg border border-white/10 bg-white p-3 text-slate-950 outline-none focus:border-teal-400" placeholder="Type your answer here..." />
                  </label>
                ))}
              </div>
              <button type="button" onClick={handleUpdatePreviewWithAnswers} className="mt-5 w-full rounded-lg bg-teal-500 px-6 py-4 font-bold text-slate-950 shadow-lg transition hover:bg-teal-400">{t("btnUpdatePreview")}</button>
              {updateMessage && <p className="mt-3 rounded-lg bg-teal-100 p-3 text-sm font-bold text-teal-900">{updateMessage}</p>}
            </div>
          </div>

          {caseData.followUpAnswers && Object.values(caseData.followUpAnswers).some(Boolean) && (
            <div className="rounded-lg bg-white p-6 text-slate-900 shadow-2xl">
              <h2 className="text-2xl font-bold">Follow-up Answers Added</h2>
              <div className="mt-4 space-y-3">
                {Object.entries(caseData.followUpAnswers).filter(([, answer]) => answer.trim()).map(([question, answer]) => (
                  <div key={question} className="rounded-lg bg-slate-50 p-4">
                    <p className="font-black text-teal-700">{question}</p>
                    <p className="mt-2 text-slate-700">{answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg bg-white p-6 text-slate-900 shadow-2xl">
            <h2 className="text-2xl font-bold">{t("sectionNextSteps")}</h2>
            <ul className="mt-4 space-y-2">
              {getNextStepsChecklist(caseData).map((step) => <li key={step}>✅ {step}</li>)}
            </ul>
            <div className="mt-6">
              <button type="button" onClick={handleDownloadPdf} className="rounded-lg bg-teal-600 px-6 py-4 font-bold text-white shadow-lg transition hover:bg-teal-700">{t("downloadPdf")}</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function getCaseRiskLabel(caseData: CaseData) {
  if (getOutputModeForCase(caseData) === "urgent-legal-aid-route") return "High Risk / Legal Review Required";
  return calculateRiskLevel(caseData.amountLost);
}

function countCaseUsefulKeywords(caseData: CaseData) {
  const lowerStory = caseData.story.toLowerCase();
  const keywords = caseData.caseType === "Property / Land Dispute" ? propertyKeywords : caseData.caseType === "Consumer Complaint" ? consumerKeywords : caseData.caseType === "RTI / Government Service Delay" || caseData.caseType === "Government Document / Certificate Issue" ? rtiKeywords : storyKeywords;
  return keywords.filter((keyword) => lowerStory.includes(keyword)).length;
}

function getStoryQualityWarning(caseData: CaseData, language: Language) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  if (caseData.story.trim().length >= 80 && countCaseUsefulKeywords(caseData) < 3) {
    if (caseData.caseType === "Property / Land Dispute") return t("warnStoryQualityProperty");
    if (caseData.caseType === "Consumer Complaint") return t("warnStoryQualityConsumer");
    if (caseData.caseType === "RTI / Government Service Delay") return t("warnStoryQualityRti");
    return t("warnStoryQualityGeneric");
  }
  return "";
}

function getLocalizedAmountMismatch(caseData: CaseData, language: Language) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const fieldAmount = Number(caseData.amountLost);
  const matches = Array.from(caseData.story.matchAll(/(?:₹|rs\.?|inr)?\s*([0-9][0-9,]*(?:\.\d+)?)/gi));
  const storyAmounts = matches.map((match) => Number(match[1].replace(/,/g, ""))).filter((amount) => amount > 0);
  const differentAmount = storyAmounts.find((amount) => fieldAmount > 0 && amount !== fieldAmount);
  if (!differentAmount) return "";
  return t("warnAmountMismatch").replace("{fieldAmount}", String(caseData.amountLost)).replace("{storyAmount}", String(differentAmount));
}

function detectCaseTypeMismatch(caseData: CaseData, language: Language) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const lower = caseData.story.toLowerCase();
  if (caseData.caseType === "Cyber Fraud / UPI Scam" && /(ancestral|land|property|sale deed|revenue record|mutation|khasra|survey|uncle)/i.test(lower)) {
    return t("warnCaseTypeMismatchCyberToProperty");
  }
  if (caseData.caseType === "Property / Land Dispute" && /(upi|transaction|bank sms|cyber|scam|fraud|blocked)/i.test(lower)) {
    return t("warnCaseTypeMismatchPropertyToCyber");
  }
  return "";
}

function analyzeDraftQuality(draftText: string, caseData: CaseData) {
  const lowerDraft = draftText.toLowerCase();
  const hasSubject = lowerDraft.includes("subject:");
  const hasIncidentDate = Boolean(caseData.incidentDate && draftText.includes(caseData.incidentDate));
  const hasAmount = Boolean(caseData.amountLost && Number(caseData.amountLost) > 0 && draftText.includes(caseData.amountLost));
  const hasEvidence = (lowerDraft.includes("evidence") || lowerDraft.includes("annexure")) && (caseData.proofs.length || 0) > 0;
  const hasRelief = (lowerDraft.includes("relief requested") || lowerDraft.includes("relief")) && (caseData.relief.length || 0) > 0;
  const hasDeclaration = lowerDraft.includes("declaration");
  const suggestions: string[] = [];
  let score = 0;
  if (hasSubject) score += 15; else suggestions.push("Add subject.");
  if (hasIncidentDate) score += 15; else suggestions.push("Add incident date.");
  if (hasAmount) score += 15; else suggestions.push("Mention amount lost.");
  if (hasEvidence) score += 20; else suggestions.push("Mention evidence clearly.");
  if (hasRelief) score += 20; else suggestions.push("Add relief requested.");
  if (hasDeclaration) score += 15; else suggestions.push("Add declaration.");
  return { score, suggestions };
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
          {result.suggestions.map((s) => <span key={s} className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">{s}</span>)}
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
