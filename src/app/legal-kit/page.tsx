"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import { type Language, translate, useLanguage } from "@/lib/i18n";
import { getCaseConfig, outputModeLabel, resolveOutputMode } from "@/lib/caseConfig";
import { caseStatuses, caseStatusLabel, normalizeCaseStatus, type CaseStatus } from "@/lib/caseStatus";
import { buildOfficialActionSuggestions } from "@/lib/officialPortals";
import type { CaseData } from "@/types/case";
import { generateComplaintDraft } from "@/lib/draftTemplates";
import { calculateCaseQualityScore } from "@/lib/qualityScore";
import {
  timeline,
  evidenceRows,
  getMissingProofSuggestions,
  formatFileSize,
  detectAmountMismatch,
  getVerifiedSourceNotes,
  hasLawHallucinationRisk,
  getLegalRoutes,
} from "@/lib/caseUtils";
import { PortalCard } from "@/components/portal-card";

const visitChecklist = [
  "Carry original ID proof",
  "Carry bank statement",
  "Carry screenshots in printed and digital form",
  "Note UTR / transaction ID",
  "Keep phone number / UPI ID / chat details ready",
  "Explain facts in chronological order",
  "Do not delete original chats or SMS",
];

export default function LegalKitPage() {
  const { language: contextLanguage } = useLanguage();
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [language, setLanguage] = useState<Language>("en");
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  useEffect(() => {
    let cancelled = false;
    window.setTimeout(() => {
      if (cancelled) return;
      try {
        const saved = localStorage.getItem("nyaymitra_case_data");
        if (saved) {
          const parsed = JSON.parse(saved) as CaseData;
          setLanguage(parsed.language || contextLanguage);
          setCaseData({ ...parsed, uploadedFiles: parsed.uploadedFiles || [], customProofs: parsed.customProofs || [], customReliefs: parsed.customReliefs || [], status: normalizeCaseStatus(parsed.status) });
        } else {
          setLanguage(contextLanguage);
        }
      } catch {
        setLanguage(contextLanguage);
      }
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

  const activeProofOptions = Array.from(new Set([...getCaseConfig(caseData.caseType).proofs, ...(caseData.aiAnalysis?.classification?.suggestedProofs || [])]));
  const missingProofs = getMissingProofSuggestions(caseData, activeProofOptions.filter((proof) => !caseData.proofs.includes(proof)));
  const quality = calculateCaseQualityScore(caseData);
  const complaint = caseData.complaintDraft || generateComplaintDraft(caseData);
  const answeredFollowUps = Object.entries(caseData.followUpAnswers || {}).filter(([, answer]) => answer.trim());
  const amountMismatch = detectAmountMismatch(caseData);
  const verifiedSourceNotes = getVerifiedSourceNotes(caseData);
  const outputMode = caseData.outputMode || resolveOutputMode(caseData.caseType, caseData.story, caseData.aiAnalysis?.classification?.caseType, caseData.aiAnalysis?.classification?.outputMode);
  const kitTitle = getKitTitle(caseData.caseType, outputMode);
  const officialActionSuggestions = buildOfficialActionSuggestions(caseData);

  async function copyComplaintDraft() {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        setCopyMessage("Clipboard is not available in this context.");
        return;
      }
      await navigator.clipboard.writeText(complaint);
      setCopyMessage(t("kitComplaintCopied"));
    } catch {
      setCopyMessage("Failed to copy. Please copy manually.");
    }
  }

  function persistCase(nextCase: CaseData) {
    try {
      const savedCases = JSON.parse(localStorage.getItem("nyaymitra_saved_cases") || "[]") as CaseData[];
      const withoutDuplicate = savedCases.filter((item) => item.caseId !== nextCase.caseId);
      localStorage.setItem("nyaymitra_case_data", JSON.stringify(nextCase));
      localStorage.setItem("nyaymitra_saved_cases", JSON.stringify([nextCase, ...withoutDuplicate]));
    } catch {}
    setCaseData(nextCase);
  }

  function updateStatus(status: CaseStatus) {
    if (!caseData) return;
    persistCase({ ...caseData, status, updatedAt: new Date().toISOString() });
    setStatusMessage(t("kitCaseStatusUpdated"));
  }

  function exportCaseJson() {
    if (!caseData) return;
    const exportData = { ...caseData, officialActionSuggestions: buildOfficialActionSuggestions(caseData), verifiedSourceNotes: getVerifiedSourceNotes(caseData) };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `nyaymitra-case-${caseData.caseId || "draft"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadPdf() {
    if (!caseData) return;

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 42;
    let y = margin;

    function addPageIfNeeded(height = 40) {
      if (y + height > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    }

    function text(lines: string | string[], size = 10, bold = false) {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      const content: string[] = Array.isArray(lines) ? lines : doc.splitTextToSize(lines, pageWidth - margin * 2);
      content.forEach((line) => {
        addPageIfNeeded(16);
        doc.text(line, margin, y);
        y += size + 6;
      });
    }

    function section(title: string) {
      addPageIfNeeded(34);
      y += 10;
      text(title, 14, true);
      y += 4;
    }

    text(`NyayMitra ${kitTitle}`, 20, true);
    text(t("disclaimer"), 10);
    text(t("footerDisclaimer"), 10);

    if (outputMode === "urgent-legal-aid-route") {
      section(t("kitStrongDisclaimer"));
      text(t("kitStrongDisclaimerDesc"));
    }

    section(t("kitCaseSnapshot"));
    text([
      `${t("kitLabelName")}: ${caseData.fullName}`,
      `${t("kitLabelContact")}: ${caseData.contact}`,
      `${t("kitLabelCaseType")}: ${caseData.caseType}`,
      `${t("kitLabelStateUT")}: ${caseData.stateOrUT || t("kitLabelNotProvided")}`,
      `${t("kitLabelIncidentDate")}: ${caseData.incidentDate}`,
      `${t("kitLabelAmountLost")}: Rs. ${caseData.amountLost}`,
      `${t("kitLabelOppositeParty")}: ${caseData.oppositeParty || t("kitLabelNotProvided")}`,
      `${t("kitLabelReliefWanted")}: ${[...caseData.relief.filter((item) => item !== "Other relief / outcome"), ...(caseData.customReliefs || [])].join(", ")}`,
    ]);
    text(`${t("kitLabelUserStory")}: ${caseData.story}`);

    if (outputMode === "urgent-legal-aid-route") {
      section(t("kitSafetySummary"));
      text(t("kitSafetySummaryDesc"));
    }

    if (amountMismatch) {
      section(t("labelAmountMismatch"));
      text(amountMismatch);
    }

    section(outputMode === "urgent-legal-aid-route" ? "Facts Timeline" : t("kitTimelineOfEvents"));
    timeline(caseData).forEach((item) => text(`- ${item}`));

    section(outputMode === "limited-guidance-kit" ? t("kitEvidenceOrganizer") : outputMode === "urgent-legal-aid-route" ? t("kitDocumentChecklist") : t("kitEvidenceIndex"));
    evidenceRows(caseData).forEach((row) => text(`${row.annexure}. ${row.evidence} | ${row.status} | File: ${row.fileName} | ${row.proves} | ${row.action}`));

    section(t("kitUploadedAnnexures"));
    text(caseData.uploadedFiles.length ? caseData.uploadedFiles.map((file, index) => `A${index + 1} - ${file.fileName} - ${file.evidenceCategory}`) : t("kitNoUploadedAnnexureFiles"));

    section(t("kitMissingProof"));
    text(missingProofs.length ? missingProofs.map((proof) => `- ${proof}`) : t("kitNoBasicProofMissing"));
    if (caseData.customProofs?.length) {
      section(t("kitCustomProofs"));
      text(caseData.customProofs.map((proof) => `- ${proof}`));
      text(t("kitCustomProofsNote"));
    }
    if (caseData.customReliefs?.length) {
      section(t("kitCustomRelief"));
      text(caseData.customReliefs.map((relief) => `- ${relief}`));
    }

    section(t("kitFollowUpAnswers"));
    text(answeredFollowUps.length ? answeredFollowUps.map(([question, answer]) => `Q: ${question} A: ${answer}`) : t("kitNoFollowUpAnswers"));

    section(t("kitAiHistory"));
    text(caseData.advisorChats?.length ? caseData.advisorChats.flatMap((chat) => [`Q: ${chat.question}`, `A: ${chat.answer}`, `Risk: ${chat.riskNote}`, ...chat.nextSteps.map((step) => `- ${step}`)]) : t("kitNoAiHistory"));

    section(t("kitVerifiedSources"));
    text(verifiedSourceNotes.length ? verifiedSourceNotes.map((source) => `${source.title} - ${source.sourceName}`) : t("kitNoVerifiedSources"));

    section(t("kitOfficialLinks"));
    officialActionSuggestions.portals.forEach((portal) => text([`${portal.title}`, `${portal.url}`, `${portal.notes}`]));
    text(t("kitVerifyPortal"));

    if (caseData.aiAnalysis) {
      section(t("kitAiCaseSummary"));
      text(caseData.aiAnalysis.extraction?.caseSummary || caseData.aiAnalysis.classification?.shortSummary || "No AI summary available.");
      section("AI Extracted Timeline");
      text(caseData.aiAnalysis.extraction?.timeline?.length ? caseData.aiAnalysis.extraction.timeline.map((item) => `- ${item.date}: ${item.event}`) : "No AI timeline available.");
      section(t("kitAiMissingDetails"));
      text(caseData.aiAnalysis.extraction?.missingDetails?.length ? caseData.aiAnalysis.extraction.missingDetails.map((item) => `- ${item}`) : "No AI missing details available.");
      section(t("kitAiReviewSuggestions"));
      text(caseData.aiAnalysis.review?.suggestions?.length ? caseData.aiAnalysis.review.suggestions.map((item) => `- ${item}`) : "No AI review suggestions available.");
    }

    section(t("kitQualityScore"));
    text(`${quality.score}/100 - ${quality.label}`);

    section(t("kitPrepSuggestions"));
    text(quality.suggestions.length ? quality.suggestions.map((item) => `- ${item}`) : t("kitGoodPrep"));

    section(t("kitRelevantLegalRoute"));
    getLegalRoutes(caseData).forEach((route) => text(`- ${route}`));

    section(outputMode === "urgent-legal-aid-route" ? t("kitLegalAidNote") : outputMode === "limited-guidance-kit" ? t("kitDraftRepresentation") : t("kitDraftComplaint"));
    text(complaint);

    if (outputMode !== "urgent-legal-aid-route") {
      section(t("kitHearingPrep"));
      visitChecklist.forEach((item) => text(`- ${item}`));
    }

    if (outputMode === "urgent-legal-aid-route") {
      section(t("kitQuestionsForLawyer"));
      text([`- ${t("kitQuestionsLawyer1")}`, `- ${t("kitQuestionsLawyer2")}`, `- ${t("kitQuestionsLawyer3")}`]);
      section(t("kitUrgentNextSteps"));
      text([`- ${t("kitUrgentNextStep1")}`, `- ${t("kitUrgentNextStep2")}`, `- ${t("kitUrgentNextStep3")}`]);
      section(t("kitStrongLawyerWarning"));
      text(t("kitStrongLawyerWarningDesc"));
    }

    section(t("kitLegalAidRoute"));
    text(t("kitLegalAidRouteDesc"));
    text(t("kitLegalAidRouteSerious"));

    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      doc.setPage(page);
      doc.setFontSize(9);
      doc.text(`Page ${page} of ${totalPages}`, pageWidth - margin - 60, pageHeight - 24);
    }

    doc.save("nyaymitra-legal-action-kit.pdf");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/dashboard" className="rounded-lg border border-white/20 px-5 py-3 text-center font-bold text-white hover:bg-white/10">{t("backDashboard")}</Link>
          <select
            aria-label="Export case"
            onChange={(e) => { if (e.target.value === "json") exportCaseJson(); else if (e.target.value === "pdf") downloadPdf(); e.target.value = ""; }}
            className="rounded-lg bg-amber-400 px-5 py-3 font-black text-slate-950 shadow-lg hover:bg-amber-300"
          >
            <option value="">{t("exportJson")} / {t("downloadPdf")}</option>
            <option value="json">{t("exportJson")}</option>
            <option value="pdf">{t("downloadPdf")}</option>
          </select>
        </div>

        <article className="rounded-lg bg-white p-6 shadow-2xl sm:p-10">
          <header className="border-b border-slate-200 pb-8">
            <p className="inline-flex rounded-lg bg-teal-50 px-4 py-2 text-sm font-black text-teal-800">{t("kitDraftDisclaimer")}</p>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">NyayMitra {kitTitle}</h1>
            <p className="mt-3 text-xl font-bold text-slate-600">{caseData.caseType}</p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <Info label={t("kitLabelCaseId")} value={caseData.caseId || t("kitLabelNotSaved")} />
              <Info label={t("kitLabelStatus")} value={caseStatusLabel(normalizeCaseStatus(caseData.status), language)} />
              <Info label={t("kitLabelLastUpdated")} value={caseData.updatedAt ? new Date(caseData.updatedAt).toLocaleString() : t("kitLabelNotSet")} />
              <Info label={t("kitLabelOutputMode")} value={outputModeLabel(outputMode)} />
            </div>
            <div className="mt-5 rounded-lg bg-slate-50 p-5">
              <label className="block text-sm font-black uppercase tracking-[0.18em] text-teal-700">{t("kitUpdateStatus")}</label>
              <select value={normalizeCaseStatus(caseData.status)} onChange={(event) => updateStatus(normalizeCaseStatus(event.target.value))} className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3 font-bold outline-none focus:border-teal-500 md:max-w-sm">
                {caseStatuses.map((status) => <option key={status} value={status}>{caseStatusLabel(status, language)}</option>)}
              </select>
              {statusMessage && <p className="mt-3 rounded-lg bg-teal-100 p-3 text-sm font-bold text-teal-900">{statusMessage}</p>}
            </div>
            <p className="mt-5 rounded-lg bg-slate-950 p-4 text-sm font-semibold text-white">{t("disclaimer")}</p>
            <div className="mt-4 rounded-lg border border-teal-100 bg-teal-50 p-5">
              <h2 className="font-black text-teal-900">{t("kitSafetyNoteTitle")}</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{t("kitSafetyNoteDesc")}</p>
            </div>
          </header>

          <KitSection title={t("kitCaseSnapshot")}>
            <div className="grid gap-4 md:grid-cols-2">
              <Info label={t("kitLabelName")} value={caseData.fullName} />
              <Info label={t("kitLabelContact")} value={caseData.contact} />
              <Info label={t("kitLabelCaseType")} value={caseData.caseType} />
              <Info label={t("kitLabelStateUT")} value={caseData.stateOrUT || t("kitLabelNotProvided")} />
              <Info label={t("kitLabelIncidentDate")} value={caseData.incidentDate} />
              <Info label={t("kitLabelAmountLost")} value={`Rs. ${caseData.amountLost}`} />
              <Info label={t("kitLabelOppositeParty")} value={caseData.oppositeParty || t("kitLabelNotProvided")} />
              <Info label={t("kitLabelReliefWanted")} value={[...caseData.relief.filter((item) => item !== "Other relief / outcome"), ...(caseData.customReliefs || [])].join(", ")} />
            </div>
            <p className="mt-5 rounded-lg bg-slate-50 p-5 leading-8"><b>{t("kitLabelUserStory")}:</b> {caseData.story}</p>
          </KitSection>

          {amountMismatch && <KitSection title="Amount Mismatch Warning"><p className="rounded-lg border border-red-200 bg-red-50 p-5 font-semibold text-red-900">{amountMismatch}</p></KitSection>}

          <KitSection title={t("kitTimelineOfEvents")}>
            <div className="grid gap-4 md:grid-cols-5">{timeline(caseData).map((item, index) => <div key={item} className="rounded-lg bg-slate-50 p-4"><p className="font-black text-teal-700">{t("kitStepLabel")} {index + 1}</p><p className="mt-2 text-sm font-semibold">{item}</p></div>)}</div>
          </KitSection>

          <KitSection title={outputMode === "limited-guidance-kit" ? "Evidence Organizer" : outputMode === "urgent-legal-aid-route" ? "Document Checklist" : "Evidence Index"}>
            <div className="overflow-x-auto"><table className="w-full min-w-[880px] text-left text-sm"><thead className="bg-slate-950 text-white"><tr><th className="p-3">Annexure No.</th><th className="p-3">Evidence</th><th className="p-3">Status</th><th className="p-3">Uploaded File Name</th><th className="p-3">What it helps prove</th><th className="p-3">Action</th></tr></thead><tbody>{evidenceRows(caseData).map((row) => <tr key={row.evidence} className="border-b"><td className="p-3 font-black">{row.annexure}</td><td className="p-3">{row.evidence}</td><td className="p-3">{row.status}</td><td className="p-3">{row.fileName}</td><td className="p-3">{row.proves}</td><td className="p-3">{row.action}</td></tr>)}</tbody></table></div>
          </KitSection>
          <KitSection title={t("kitCustomProofs")}><List items={(caseData.customProofs || []).length ? caseData.customProofs || [] : [t("kitNoCustomProofs")]} />{(caseData.customProofs || []).length > 0 && <p className="mt-4 rounded-lg bg-teal-50 p-4 text-sm font-bold text-teal-900">{t("kitCustomProofsNote")}</p>}</KitSection>
          <KitSection title={t("kitCustomRelief")}><List items={(caseData.customReliefs || []).length ? caseData.customReliefs || [] : [t("kitNoCustomRelief")]} /></KitSection>

          <KitSection title={t("kitUploadedAnnexures")}>
            {caseData.uploadedFiles.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-teal-950 text-white"><tr><th className="p-3">{t("kitLabelAnnexureNo")}</th><th className="p-3">{t("kitLabelFileName")}</th><th className="p-3">{t("labelProofFiles")}</th><th className="p-3">{t("kitLabelFileType")}</th><th className="p-3">{t("kitLabelFileSize")}</th><th className="p-3">{t("kitLabelUploadedAt")}</th></tr></thead><tbody>{caseData.uploadedFiles.map((file, index) => <tr key={file.id} className="border-b"><td className="p-3 font-black">A{index + 1}</td><td className="p-3 font-semibold">{file.fileName}</td><td className="p-3">{file.evidenceCategory}</td><td className="p-3">{file.fileType}</td><td className="p-3">{formatFileSize(file.fileSize)}</td><td className="p-3">{new Date(file.uploadedAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <p className="rounded-lg bg-slate-50 p-5 font-semibold">{t("kitNoUploadedAnnexures")}</p>}
          </KitSection>
          <OfficialActionLinks caseData={caseData} language={language} />

          <KitSection title={t("kitMissingProof")}><p className="rounded-lg bg-amber-50 p-5 font-semibold text-amber-900">{missingProofs.length ? missingProofs.join(", ") : t("kitNoBasicProofMissing")}</p></KitSection>
          <KitSection title={t("kitFollowUpAnswers")}>
            {answeredFollowUps.length ? <div className="space-y-3">{answeredFollowUps.map(([question, answer]) => <div key={question} className="rounded-lg bg-slate-50 p-4"><p className="font-black text-teal-700">{question}</p><p className="mt-2 leading-7 text-slate-700">{answer}</p></div>)}</div> : <p className="rounded-lg bg-slate-50 p-5 font-semibold">{t("kitNoFollowUpAnswers")}</p>}
          </KitSection>
          <KitSection title={t("kitAiHistory")}>
            {caseData.advisorChats?.length ? <div className="space-y-4">{caseData.advisorChats.map((chat) => <div key={chat.id} className="rounded-lg bg-slate-50 p-5"><p className="font-black text-slate-950">Q: {chat.question}</p><p className="mt-3 leading-7 text-slate-700">{chat.answer}</p>{chat.lawyerReviewRecommended && <p className="mt-3 rounded-lg bg-red-100 p-3 text-sm font-black text-red-800">{t("kitLawyerReviewRecommended")}</p>}<p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-900">{chat.riskNote}</p><List items={chat.nextSteps} /></div>)}</div> : <p className="rounded-lg bg-slate-50 p-5 font-semibold">{t("kitNoAiHistory")}</p>}
          </KitSection>
          <KitSection title={t("kitVerifiedSources")}>
            {verifiedSourceNotes.length ? <div className="grid gap-3 md:grid-cols-2">{verifiedSourceNotes.map((source) => <div key={source.title + source.sourceUrl} className="rounded-lg bg-slate-50 p-4"><h3 className="font-black text-teal-700">{source.title}</h3><p className="mt-2 text-sm font-semibold">{source.sourceName}</p><p className="text-sm text-slate-600">Last checked: {source.lastChecked || "Source provided by AI"}</p><a className="mt-2 inline-flex text-sm font-bold text-teal-700" href={source.sourceUrl} target="_blank" rel="noreferrer">{source.sourceUrl}</a></div>)}</div> : <p className="rounded-lg bg-amber-50 p-5 font-semibold text-amber-900">{t("kitNoVerifiedSources")}</p>}
            {hasLawHallucinationRisk(JSON.stringify(caseData.aiAnalysis || {}) + JSON.stringify(caseData.advisorChats || []), verifiedSourceNotes) && <p className="mt-4 rounded-lg bg-red-100 p-3 text-sm font-bold text-red-800">{t("kitAiHallucinationRisk")}</p>}
          </KitSection>
          {caseData.aiAnalysis && (
            <KitSection title={t("kitAiAnalysis")}>
              <div className="grid gap-4 md:grid-cols-2">
                {caseData.aiAnalysis.extraction && <AiInfo title={t("kitAiCaseSummary")} items={[caseData.aiAnalysis.extraction.caseSummary, ...caseData.aiAnalysis.extraction.timeline.map((item) => `${item.date}: ${item.event}`)]} />}
                {caseData.aiAnalysis.extraction && <AiInfo title={t("kitAiMissingDetails")} items={caseData.aiAnalysis.extraction.missingDetails} />}
                {caseData.aiAnalysis.review && <AiInfo title={t("kitAiReviewSuggestions")} items={caseData.aiAnalysis.review.suggestions} />}
                {caseData.aiAnalysis.classification && <AiInfo title={t("kitAiClassification")} items={[caseData.aiAnalysis.classification.caseType, caseData.aiAnalysis.classification.outputMode, caseData.aiAnalysis.classification.riskReason]} />}
              </div>
            </KitSection>
          )}
          <KitSection title={t("kitQualityScore")}>
            <div className="rounded-lg bg-slate-50 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div><p className="text-4xl font-black text-slate-950">{quality.score}/100</p><p className="mt-1 font-bold text-slate-600">{quality.label}</p></div>
                <div className="h-4 w-full overflow-hidden rounded-full bg-white md:w-80"><div className={`h-full ${quality.score >= 70 ? "bg-teal-500" : quality.score >= 40 ? "bg-amber-500" : "bg-orange-500"}`} style={{ width: `${quality.score}%` }} /></div>
              </div>
              <div className={`mt-5 rounded-lg p-4 ${quality.score >= 70 ? "bg-teal-100 text-teal-900" : "bg-amber-100 text-amber-900"}`}>
                {quality.suggestions.length ? <List items={quality.suggestions} /> : <p className="font-semibold">{t("kitGoodPrep")}</p>}
              </div>
            </div>
          </KitSection>
          <KitSection title={t("kitRelevantLegalRoute")}><List items={getLegalRoutes(caseData)} /></KitSection>
          <KitSection title={outputMode === "urgent-legal-aid-route" ? t("kitLegalAidNote") : outputMode === "limited-guidance-kit" ? t("kitDraftRepresentation") : t("kitDraftComplaint")}>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-lg">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-semibold text-slate-600">{t("kitDraftReviewNote")}</p>
                <button type="button" onClick={copyComplaintDraft} className="rounded-lg bg-slate-950 px-5 py-3 font-bold text-white hover:bg-slate-800">{t("kitCopyDraft")}</button>
              </div>
              {copyMessage && <p className="mt-3 rounded-lg bg-teal-100 p-3 text-sm font-bold text-teal-900">{copyMessage}</p>}
              <pre className="mt-5 whitespace-pre-wrap rounded-lg bg-slate-50 p-5 font-sans leading-8">{complaint}</pre>
            </div>
          </KitSection>
          <KitSection title={t("kitHearingPrep")}><List items={visitChecklist} /></KitSection>
          <KitSection title={t("kitLegalAidRoute")}><List items={[t("kitLegalAidRouteDesc"), t("kitLegalAidRouteSerious")]} /></KitSection>
        </article>
      </div>
    </main>
  );
}

function getKitTitle(caseType: string, outputMode: string) {
  if (outputMode === "urgent-legal-aid-route") return "Legal Aid Consultation Note";
  if (caseType === "Cyber Fraud / UPI Scam") return "Cyber Fraud Legal Action Kit";
  if (caseType === "Consumer Complaint") return "Consumer Complaint Preparation Kit";
  if (caseType === "Unpaid Salary / Gig Worker Payment") return "Salary Dispute Preparation Kit";
  if (caseType === "Other / Not Sure") return "General Legal Guidance Kit";
  return `${caseType} Preparation Kit`;
}

function KitSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border-b border-slate-200 py-8 last:border-0"><h2 className="mb-5 text-2xl font-black text-slate-950">{title}</h2>{children}</section>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">{label}</p><p className="mt-2 font-bold">{value}</p></div>;
}

function List({ items }: { items: string[] }) {
  return <ul className="space-y-3">{items.map((item) => <li key={item} className="rounded-lg bg-slate-50 p-4 font-semibold leading-7">{item}</li>)}</ul>;
}

function OfficialActionLinks({ caseData, language }: { caseData: CaseData; language: Language }) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const suggestions = buildOfficialActionSuggestions(caseData);

  return (
    <KitSection title={t("kitOfficialLinks")}>
      <div className="rounded-lg border border-teal-100 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-6 text-white shadow-2xl">
        <p className="max-w-3xl text-sm font-semibold leading-6 text-slate-300">{t("kitOfficialLinksDesc")}</p>
        {suggestions.showEmergency && <p className="mt-4 rounded-lg border border-orange-300/40 bg-orange-500/15 p-4 text-sm font-bold text-orange-100">{t("kitEmergencyWarning")}</p>}
        <p className="mt-4 rounded-lg bg-white/10 p-4 text-sm font-semibold text-slate-200">{suggestions.stateMessage}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {suggestions.portals.map((portal) => <PortalCard key={portal.id} portal={portal} />)}
        </div>
        <p className="mt-5 rounded-lg bg-slate-950 p-4 text-sm font-semibold text-slate-200">{t("kitPortalDisclaimer")}</p>
      </div>
    </KitSection>
  );
}

function AiInfo({ title, items }: { title: string; items: string[] }) {
  return <div className="rounded-lg bg-slate-50 p-4"><h3 className="font-black text-teal-700">{title}</h3><ul className="mt-3 space-y-2 text-sm font-semibold text-slate-700">{items.filter(Boolean).map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div>;
}
