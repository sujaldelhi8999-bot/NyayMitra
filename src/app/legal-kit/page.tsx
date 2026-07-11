"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import { getInitialLanguage, type Language, translate } from "@/lib/i18n";
import { buildKnowledgeContext } from "@/lib/legalKnowledge";
import { getCaseConfig, outputModeLabel, resolveOutputMode } from "@/lib/caseConfig";
import { buildOfficialActionSuggestions } from "@/lib/officialPortals";
import type { OfficialPortal } from "@/data/officialPortals";

type CaseData = {
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
    classification?: { caseType: string; confidence: number; outputMode: "full-preparation-kit" | "limited-guidance-kit" | "urgent-legal-aid-route"; riskLevel?: string; riskReason: string; shortSummary: string; suggestedProofs?: string[]; suggestedReliefs?: string[]; missingDetails?: string[]; nextSteps?: string[]; lawyerReviewRecommended?: boolean };
    extraction?: { caseSummary: string; timeline: { date: string; event: string }[]; parties: string[]; evidenceMentioned: string[]; missingDetails: string[] };
    followupQuestions?: string[];
    review?: { qualityScore: number; strengths: string[]; weaknesses: string[]; missingProof: string[]; suggestions: string[]; verifiedSourcesUsed?: VerifiedSource[] };
    generatedDraft?: string;
    lastAnalyzedAt?: string;
  };
  advisorChats?: AdvisorChat[];
};

type VerifiedSource = { title: string; sourceName: string; sourceUrl: string; lastChecked?: string };
type AdvisorChat = { id: string; question: string; answer: string; nextSteps: string[]; missingInfo: string[]; riskNote: string; lawyerReviewRecommended: boolean; createdAt: string; verifiedSourcesUsed?: VerifiedSource[] };

type UploadedFile = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  evidenceCategory: string;
  uploadedAt: string;
};

const proofMeaning: Record<string, string> = {
  "WhatsApp chat screenshot": "Conversation, demand, scam message, contact identity.",
  "UPI transaction screenshot": "Payment amount, transaction ID, receiver UPI ID.",
  "Bank SMS": "Debit alert and transaction timing.",
  "Phone number": "Contact route of suspected scammer.",
  "Email/chat record": "Communication trail.",
  "Police/cyber complaint acknowledgement": "Complaint already filed.",
  "Property papers": "May help identify title/ownership history, subject to legal verification.",
  "Mutation/tax records": "May help show revenue/tax entries, but these need legal review.",
  "Photos": "May help show possession, boundary, condition, or dispute context.",
  "Notices": "May help show prior legal communication or dispute history.",
  "Messages / emails": "May help show admissions, threats, negotiations, or timeline.",
  "Witness details": "May help identify people who know the property history or possession facts.",
  "Timeline notes": "Helps legal aid/lawyer understand events in order.",
  "Other supporting proof": "User-provided supporting material that should be reviewed before relying on it.",
};

const proofAction: Record<string, string> = {
  "WhatsApp chat screenshot": "Save full chat screenshots with visible phone number and date.",
  "UPI transaction screenshot": "Attach screenshot and bank statement entry.",
  "Bank SMS": "Keep SMS screenshot and bank statement.",
  "Phone number": "Mention number in complaint.",
  "Email/chat record": "Export or screenshot full conversation.",
  "Police/cyber complaint acknowledgement": "Attach acknowledgement number and date.",
};

const visitChecklist = [
  "Carry original ID proof",
  "Carry bank statement",
  "Carry screenshots in printed and digital form",
  "Note UTR / transaction ID",
  "Keep phone number / UPI ID / chat details ready",
  "Explain facts in chronological order",
  "Do not delete original chats or SMS",
];

const cyberLegalRoutes = [
  "Report cyber fraud on official cybercrime portal.",
  "Contact bank support immediately and request transaction dispute/freeze support.",
  "Prepare written complaint with transaction ID, screenshots, phone number, UPI ID, and timeline.",
  "For serious/high-value cases, consult legal aid/lawyer.",
  "Exact law sections should be verified from official sources before filing.",
];

const storyKeywords = ["whatsapp", "upi", "payment", "paid", "blocked", "message", "scam", "fraud", "transaction", "bank", "job", "refund"];
const statusOptions = ["Intake Started", "Draft Ready", "Review Needed", "Filed", "Closed"];

export default function LegalKitPage() {
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [language, setLanguage] = useState<Language>("en");
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  useEffect(() => {
    window.setTimeout(() => {
      const saved = localStorage.getItem("nyaymitra_case_data");
      if (saved) {
        const parsed = JSON.parse(saved) as CaseData;
        setLanguage(parsed.language || getInitialLanguage());
        setCaseData({ ...parsed, uploadedFiles: parsed.uploadedFiles || [], customProofs: parsed.customProofs || [], customReliefs: parsed.customReliefs || [], status: parsed.status || "Draft Ready" });
      } else {
        setLanguage(getInitialLanguage());
      }
      setLoaded(true);
    }, 0);
  }, []);

  if (!loaded) return null;

  if (!caseData) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
          <div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 text-center text-slate-950 shadow-2xl">
          <h1 className="text-3xl font-black">{t("kitNoData")}</h1>
          <Link href="/dashboard" className="mt-6 inline-flex rounded-full bg-teal-600 px-6 py-3 font-bold text-white">{t("backDashboard")}</Link>
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
    await navigator.clipboard.writeText(complaint);
    setCopyMessage(t("kitComplaintCopied"));
  }

  function persistCase(nextCase: CaseData) {
    const savedCases = JSON.parse(localStorage.getItem("nyaymitra_saved_cases") || "[]") as CaseData[];
    const withoutDuplicate = savedCases.filter((item) => item.caseId !== nextCase.caseId);
    localStorage.setItem("nyaymitra_case_data", JSON.stringify(nextCase));
    localStorage.setItem("nyaymitra_saved_cases", JSON.stringify([nextCase, ...withoutDuplicate]));
    setCaseData(nextCase);
  }

  function updateStatus(status: string) {
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
    text("This is a draft preparation document. It is not legal advice and does not guarantee any result.", 10);
    text("NyayMitra is a legal self-help preparation tool, not a lawyer. Please verify with legal aid/lawyer before filing.", 10);

    if (outputMode === "urgent-legal-aid-route") {
      section("Strong Disclaimer");
      text("This urgent/high-risk matter requires lawyer/legal-aid review. NyayMitra provides only a Legal Aid Consultation Note and document organization support.");
    }

    section("Case Snapshot");
    text([
      `Name: ${caseData.fullName}`,
      `Contact: ${caseData.contact}`,
      `Case type: ${caseData.caseType}`,
      `State / UT: ${caseData.stateOrUT || "Not provided"}`,
      `Incident date: ${caseData.incidentDate}`,
      `Amount lost: Rs. ${caseData.amountLost}`,
      `Opposite party details: ${caseData.oppositeParty || "Not provided"}`,
      `Relief wanted: ${[...caseData.relief.filter((item) => item !== "Other relief / outcome"), ...(caseData.customReliefs || [])].join(", ")}`,
    ]);
    text(`User story: ${caseData.story}`);

    if (outputMode === "urgent-legal-aid-route") {
      section("Safety Summary");
      text("The case has been routed to urgent legal-aid review based on the case type or safety signals. If there is immediate danger, contact local emergency services immediately.");
    }

    if (amountMismatch) {
      section("Amount Mismatch Warning");
      text(amountMismatch);
    }

    section(outputMode === "urgent-legal-aid-route" ? "Facts Timeline" : "Timeline of Events");
    timeline(caseData).forEach((item) => text(`- ${item}`));

    section(outputMode === "limited-guidance-kit" ? "Evidence Organizer" : outputMode === "urgent-legal-aid-route" ? "Document Checklist" : "Evidence Index");
    evidenceRows(caseData).forEach((row) => text(`${row.annexure}. ${row.evidence} | ${row.status} | File: ${row.fileName} | ${row.proves} | ${row.action}`));

    section("Uploaded Annexures");
    text(caseData.uploadedFiles.length ? caseData.uploadedFiles.map((file, index) => `A${index + 1} - ${file.fileName} - ${file.evidenceCategory}`) : "No uploaded annexure files added.");

    section("Missing Proof");
    text(missingProofs.length ? missingProofs.map((proof) => `- ${proof}`) : "No basic proof missing.");
    if (caseData.customProofs?.length) {
      section("Custom Proofs / Documents");
      text(caseData.customProofs.map((proof) => `- ${proof}`));
      text("Custom documents are user-provided and should be verified before filing or relying on them.");
    }
    if (caseData.customReliefs?.length) {
      section("Custom Relief / Outcome Requested");
      text(caseData.customReliefs.map((relief) => `- ${relief}`));
    }

    section("Smart Follow-up Answers");
    text(answeredFollowUps.length ? answeredFollowUps.map(([question, answer]) => `Q: ${question} A: ${answer}`) : "No follow-up answers added.");

    section("AI Legal Guidance History");
    text(caseData.advisorChats?.length ? caseData.advisorChats.flatMap((chat) => [`Q: ${chat.question}`, `A: ${chat.answer}`, `Risk: ${chat.riskNote}`, ...chat.nextSteps.map((step) => `- ${step}`)]) : "No AI legal guidance chats added.");

    section("Verified Source Notes");
    text(verifiedSourceNotes.length ? verifiedSourceNotes.map((source) => `${source.title} - ${source.sourceName}`) : "No exact legal source was used. Please verify with legal aid/lawyer before filing.");

    section("Official Action Links");
    officialActionSuggestions.portals.forEach((portal) => text([`${portal.title}`, `${portal.url}`, `${portal.notes}`]));
    text("Verify the portal and procedure before submitting. For emergencies, contact local emergency services immediately.");

    if (caseData.aiAnalysis) {
      section("AI Case Summary");
      text(caseData.aiAnalysis.extraction?.caseSummary || caseData.aiAnalysis.classification?.shortSummary || "No AI summary available.");
      section("AI Extracted Timeline");
      text(caseData.aiAnalysis.extraction?.timeline?.length ? caseData.aiAnalysis.extraction.timeline.map((item) => `- ${item.date}: ${item.event}`) : "No AI timeline available.");
      section("AI Missing Details");
      text(caseData.aiAnalysis.extraction?.missingDetails?.length ? caseData.aiAnalysis.extraction.missingDetails.map((item) => `- ${item}`) : "No AI missing details available.");
      section("AI Review Suggestions");
      text(caseData.aiAnalysis.review?.suggestions?.length ? caseData.aiAnalysis.review.suggestions.map((item) => `- ${item}`) : "No AI review suggestions available.");
    }

    section("Case Quality Score");
    text(`${quality.score}/100 - ${quality.label}`);

    section("Preparation Suggestions");
    text(quality.suggestions.length ? quality.suggestions.map((item) => `- ${item}`) : "Good preparation. Still verify with legal aid/lawyer before filing.");

    section("Relevant Legal Route");
    getLegalRoutes(caseData).forEach((route) => text(`- ${route}`));

    section(outputMode === "urgent-legal-aid-route" ? "Legal Aid Consultation Note" : outputMode === "limited-guidance-kit" ? "Draft Representation for Review" : "Draft Complaint/Application");
    text(complaint);

    if (outputMode !== "urgent-legal-aid-route") {
      section("Hearing / Visit Preparation");
      visitChecklist.forEach((item) => text(`- ${item}`));
    }

    if (outputMode === "urgent-legal-aid-route") {
      section("Questions for Lawyer/Legal Aid");
      text(["- What urgent protection or procedural steps should be considered?", "- What documents should be carried immediately?", "- Are there any deadlines, safety risks, or court/police steps requiring urgent review?"]);
      section("Urgent Next Steps");
      text(["- Contact legal aid/lawyer as soon as possible.", "- Keep original documents and communication proof safe.", "- For immediate danger, call 112 or local emergency services."]);
      section("Strong Lawyer/Legal Aid Warning");
      text("Do not rely on this note as legal advice. Lawyer/legal-aid review is required before taking legal action in this high-risk matter.");
    }

    section("Legal Aid Route");
    text("If the user cannot afford a lawyer, they may approach District Legal Services Authority / State Legal Services Authority / NALSA route.");
    text("For serious or high-value matters, get lawyer/legal-aid review before filing.");

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
          <Link href="/dashboard" className="rounded-full border border-white/20 px-5 py-3 text-center font-bold text-white hover:bg-white/10">{t("backDashboard")}</Link>
          <select
            aria-label="Export case"
            onChange={(e) => { if (e.target.value === "json") exportCaseJson(); else if (e.target.value === "pdf") downloadPdf(); e.target.value = ""; }}
            className="rounded-full bg-amber-400 px-5 py-3 font-black text-slate-950 shadow-lg hover:bg-amber-300"
          >
            <option value="">{t("exportJson")} / {t("downloadPdf")}</option>
            <option value="json">{t("exportJson")}</option>
            <option value="pdf">{t("downloadPdf")}</option>
          </select>
        </div>

        <article className="rounded-[2rem] bg-white p-6 shadow-2xl sm:p-10">
          <header className="border-b border-slate-200 pb-8">
            <p className="inline-flex rounded-full bg-teal-50 px-4 py-2 text-sm font-black text-teal-800">{t("kitDraftDisclaimer")}</p>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">NyayMitra {kitTitle}</h1>
            <p className="mt-3 text-xl font-bold text-slate-600">{caseData.caseType}</p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <Info label={t("kitLabelCaseId")} value={caseData.caseId || t("kitLabelNotSaved")} />
              <Info label={t("kitLabelStatus")} value={caseData.status || t("statusDraftReady")} />
              <Info label={t("kitLabelLastUpdated")} value={caseData.updatedAt ? new Date(caseData.updatedAt).toLocaleString() : t("kitLabelNotSet")} />
              <Info label={t("kitLabelOutputMode")} value={outputModeLabel(outputMode)} />
            </div>
            <div className="mt-5 rounded-2xl bg-slate-50 p-5">
              <label className="block text-sm font-black uppercase tracking-[0.18em] text-teal-700">{t("kitUpdateStatus")}</label>
              <select value={caseData.status || "Draft Ready"} onChange={(event) => updateStatus(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 font-bold outline-none focus:border-teal-500 md:max-w-sm">
                {statusOptions.map((status) => <option key={status}>{status}</option>)}
              </select>
              {statusMessage && <p className="mt-3 rounded-xl bg-teal-100 p-3 text-sm font-bold text-teal-900">{statusMessage}</p>}
            </div>
            <p className="mt-5 rounded-2xl bg-slate-950 p-4 text-sm font-semibold text-white">{t("disclaimer")}</p>
            <div className="mt-4 rounded-2xl border border-teal-100 bg-teal-50 p-5">
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
            <p className="mt-5 rounded-2xl bg-slate-50 p-5 leading-8"><b>{t("kitLabelUserStory")}:</b> {caseData.story}</p>
          </KitSection>

          {amountMismatch && <KitSection title="Amount Mismatch Warning"><p className="rounded-2xl border border-red-200 bg-red-50 p-5 font-semibold text-red-900">{amountMismatch}</p></KitSection>}

          <KitSection title={t("kitTimelineOfEvents")}>
            <div className="grid gap-4 md:grid-cols-5">{timeline(caseData).map((item, index) => <div key={item} className="rounded-2xl bg-slate-50 p-4"><p className="font-black text-teal-700">{t("kitStepLabel")} {index + 1}</p><p className="mt-2 text-sm font-semibold">{item}</p></div>)}</div>
          </KitSection>

          <KitSection title={outputMode === "limited-guidance-kit" ? "Evidence Organizer" : outputMode === "urgent-legal-aid-route" ? "Document Checklist" : "Evidence Index"}>
            <div className="overflow-x-auto"><table className="w-full min-w-[880px] text-left text-sm"><thead className="bg-slate-950 text-white"><tr><th className="p-3">Annexure No.</th><th className="p-3">Evidence</th><th className="p-3">Status</th><th className="p-3">Uploaded File Name</th><th className="p-3">What it helps prove</th><th className="p-3">Action</th></tr></thead><tbody>{evidenceRows(caseData).map((row) => <tr key={row.evidence} className="border-b"><td className="p-3 font-black">{row.annexure}</td><td className="p-3">{row.evidence}</td><td className="p-3">{row.status}</td><td className="p-3">{row.fileName}</td><td className="p-3">{row.proves}</td><td className="p-3">{row.action}</td></tr>)}</tbody></table></div>
          </KitSection>
          <KitSection title={t("kitCustomProofs")}><List items={(caseData.customProofs || []).length ? caseData.customProofs || [] : [t("kitNoCustomProofs")]} />{(caseData.customProofs || []).length > 0 && <p className="mt-4 rounded-xl bg-teal-50 p-4 text-sm font-bold text-teal-900">{t("kitCustomProofsNote")}</p>}</KitSection>
          <KitSection title={t("kitCustomRelief")}><List items={(caseData.customReliefs || []).length ? caseData.customReliefs || [] : [t("kitNoCustomRelief")]} /></KitSection>

          <KitSection title={t("kitUploadedAnnexures")}>
            {caseData.uploadedFiles.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-teal-950 text-white"><tr><th className="p-3">{t("kitLabelAnnexureNo")}</th><th className="p-3">{t("kitLabelFileName")}</th><th className="p-3">{t("labelProofFiles")}</th><th className="p-3">{t("kitLabelFileType")}</th><th className="p-3">{t("kitLabelFileSize")}</th><th className="p-3">{t("kitLabelUploadedAt")}</th></tr></thead><tbody>{caseData.uploadedFiles.map((file, index) => <tr key={file.id} className="border-b"><td className="p-3 font-black">A{index + 1}</td><td className="p-3 font-semibold">{file.fileName}</td><td className="p-3">{file.evidenceCategory}</td><td className="p-3">{file.fileType}</td><td className="p-3">{formatFileSize(file.fileSize)}</td><td className="p-3">{new Date(file.uploadedAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <p className="rounded-2xl bg-slate-50 p-5 font-semibold">{t("kitNoUploadedAnnexures")}</p>}
          </KitSection>
          <OfficialActionLinks caseData={caseData} />

          <KitSection title={t("kitMissingProof")}><p className="rounded-2xl bg-amber-50 p-5 font-semibold text-amber-900">{missingProofs.length ? missingProofs.join(", ") : t("kitNoBasicProofMissing")}</p></KitSection>
          <KitSection title={t("kitFollowUpAnswers")}>
            {answeredFollowUps.length ? <div className="space-y-3">{answeredFollowUps.map(([question, answer]) => <div key={question} className="rounded-2xl bg-slate-50 p-4"><p className="font-black text-teal-700">{question}</p><p className="mt-2 leading-7 text-slate-700">{answer}</p></div>)}</div> : <p className="rounded-2xl bg-slate-50 p-5 font-semibold">{t("kitNoFollowUpAnswers")}</p>}
          </KitSection>
          <KitSection title={t("kitAiHistory")}>
            {caseData.advisorChats?.length ? <div className="space-y-4">{caseData.advisorChats.map((chat) => <div key={chat.id} className="rounded-2xl bg-slate-50 p-5"><p className="font-black text-slate-950">Q: {chat.question}</p><p className="mt-3 leading-7 text-slate-700">{chat.answer}</p>{chat.lawyerReviewRecommended && <p className="mt-3 rounded-xl bg-red-100 p-3 text-sm font-black text-red-800">{t("kitLawyerReviewRecommended")}</p>}<p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">{chat.riskNote}</p><List items={chat.nextSteps} /></div>)}</div> : <p className="rounded-2xl bg-slate-50 p-5 font-semibold">{t("kitNoAiHistory")}</p>}
          </KitSection>
          <KitSection title={t("kitVerifiedSources")}>
            {verifiedSourceNotes.length ? <div className="grid gap-3 md:grid-cols-2">{verifiedSourceNotes.map((source) => <div key={source.title + source.sourceUrl} className="rounded-2xl bg-slate-50 p-4"><h3 className="font-black text-teal-700">{source.title}</h3><p className="mt-2 text-sm font-semibold">{source.sourceName}</p><p className="text-sm text-slate-600">Last checked: {source.lastChecked || "Source provided by AI"}</p><a className="mt-2 inline-flex text-sm font-bold text-teal-700" href={source.sourceUrl} target="_blank" rel="noreferrer">{source.sourceUrl}</a></div>)}</div> : <p className="rounded-2xl bg-amber-50 p-5 font-semibold text-amber-900">{t("kitNoVerifiedSources")}</p>}
            {hasLawHallucinationRisk(JSON.stringify(caseData.aiAnalysis || {}) + JSON.stringify(caseData.advisorChats || []), verifiedSourceNotes) && <p className="mt-4 rounded-xl bg-red-100 p-3 text-sm font-bold text-red-800">{t("kitAiHallucinationRisk")}</p>}
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
            <div className="rounded-2xl bg-slate-50 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div><p className="text-4xl font-black text-slate-950">{quality.score}/100</p><p className="mt-1 font-bold text-slate-600">{quality.label}</p></div>
                <div className="h-4 w-full overflow-hidden rounded-full bg-white md:w-80"><div className={`h-full ${quality.score >= 70 ? "bg-teal-500" : quality.score >= 40 ? "bg-amber-500" : "bg-orange-500"}`} style={{ width: `${quality.score}%` }} /></div>
              </div>
              <div className={`mt-5 rounded-2xl p-4 ${quality.score >= 70 ? "bg-teal-100 text-teal-900" : "bg-amber-100 text-amber-900"}`}>
                {quality.suggestions.length ? <List items={quality.suggestions} /> : <p className="font-semibold">{t("kitGoodPrep")}</p>}
              </div>
            </div>
          </KitSection>
          <KitSection title={t("kitRelevantLegalRoute")}><List items={getLegalRoutes(caseData)} /></KitSection>
          <KitSection title={outputMode === "urgent-legal-aid-route" ? t("kitLegalAidNote") : outputMode === "limited-guidance-kit" ? t("kitDraftRepresentation") : t("kitDraftComplaint")}>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-semibold text-slate-600">{t("kitDraftReviewNote")}</p>
                <button type="button" onClick={copyComplaintDraft} className="rounded-full bg-slate-950 px-5 py-3 font-bold text-white hover:bg-slate-800">{t("kitCopyDraft")}</button>
              </div>
              {copyMessage && <p className="mt-3 rounded-xl bg-teal-100 p-3 text-sm font-bold text-teal-900">{copyMessage}</p>}
              <pre className="mt-5 whitespace-pre-wrap rounded-2xl bg-slate-50 p-5 font-sans leading-8">{complaint}</pre>
            </div>
          </KitSection>
          <KitSection title={t("kitHearingPrep")}><List items={visitChecklist} /></KitSection>
          <KitSection title={t("kitLegalAidRoute")}><List items={[t("kitLegalAidRouteDesc"), t("kitLegalAidRouteSerious")]} /></KitSection>
        </article>
      </div>
    </main>
  );
}

function timeline(data: CaseData) {
  if (data.caseType === "Property / Land Dispute") {
    return [
      `Property dispute date/reference: ${data.incidentDate || "Not provided"}`,
      `Opposite party/person involved: ${data.oppositeParty || "Not provided"}`,
      `Documents collected: ${[...data.proofs.filter((item) => item !== "Other proof / document"), ...(data.customProofs || [])].join(", ") || "None selected"}`,
      "Known/old court case details should be checked with legal aid/lawyer if available.",
      "Next action: Organize documents and approach legal aid/lawyer with consultation note.",
    ];
  }
  if (data.caseType === "Consumer Complaint") {
    return [`Purchase/service date: ${data.incidentDate || "Not provided"}`, `Seller/platform: ${data.oppositeParty || "Not provided"}`, `Reported amount/value: Rs. ${data.amountLost || "0"}`, `Evidence collected: ${data.proofs.join(", ") || "None selected"}`, "Next action: Prepare refund/replacement representation for review."];
  }
  if (data.caseType === "RTI / Government Service Delay" || data.caseType === "Government Document / Certificate Issue") {
    return [`Application/date reference: ${data.incidentDate || "Not provided"}`, `Department/authority: ${data.oppositeParty || "Not provided"}`, `Evidence collected: ${data.proofs.join(", ") || "None selected"}`, "Next action: Prepare follow-up/RTI-style request where applicable."];
  }
  if (data.caseType === "Lost Documents / Police Complaint") {
    return [`Loss/report date: ${data.incidentDate || "Not provided"}`, `Location/authority details: ${data.oppositeParty || "Not provided"}`, `Evidence collected: ${data.proofs.join(", ") || "None selected"}`, "Next action: Prepare lost document report details and check State/UT route where applicable."];
  }
  return [
    `Incident happened on ${data.incidentDate}`,
    `Payment/loss occurred for Rs. ${data.amountLost}`,
    `Evidence collected: ${[...data.proofs.filter((item) => item !== "Other proof / document"), ...(data.customProofs || [])].length ? [...data.proofs.filter((item) => item !== "Other proof / document"), ...(data.customProofs || [])].join(", ") : "None selected"}`,
    data.proofs.includes("Police/cyber complaint acknowledgement") ? "Complaint already initiated - attach acknowledgement." : "Complaint not yet filed - prepare cybercrime/police/bank complaint draft.",
    "Next action: Review draft, organize evidence, and verify with legal aid/lawyer before filing.",
  ];
}

function getMissingProofSuggestions(data: CaseData, standardMissing: string[]) {
  if (data.caseType === "Property / Land Dispute") return ["Title/sale/property papers", "Revenue/mutation/tax records", "Property location/identifier", "Court papers/case number if any", "Notices/messages"].slice(0, 5);
  return standardMissing.slice(0, 8);
}

function evidenceRows(data: CaseData) {
  const options = Array.from(new Set([...getCaseConfig(data.caseType).proofs, ...(data.aiAnalysis?.classification?.suggestedProofs || []), ...(data.customProofs || [])]));
  return options.map((proof) => {
    const custom = (data.customProofs || []).includes(proof);
    const uploadedFile = data.uploadedFiles.find((file) => file.evidenceCategory === proof);
    const available = custom || data.proofs.includes(proof);

    return {
    annexure: uploadedFile ? `A${data.uploadedFiles.findIndex((file) => file.id === uploadedFile.id) + 1}` : "-",
    evidence: proof,
    status: available ? "Available" : "Missing",
    fileName: uploadedFile?.fileName || (custom ? "Custom proof added, file not uploaded yet." : available ? "Marked available, file not uploaded yet." : "No file / not marked."),
    proves: custom ? "User-provided supporting proof. Meaning should be verified during legal-aid/lawyer review." : proofMeaning[proof] || "Supports the facts, timeline, identity, payment, communication, or authority history.",
    action: custom ? "Keep original copy safe and mention it in consultation/draft." : proofAction[proof] || "Keep the original safe and attach a copy for review.",
  };
  });
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function countUsefulStoryKeywords(story: string) {
  const lowerStory = story.toLowerCase();
  return storyKeywords.filter((keyword) => lowerStory.includes(keyword)).length;
}

function hasTooManyRandomSymbols(story: string) {
  if (!story.trim()) return false;
  const symbolMatches = story.match(/[^a-zA-Z0-9\s.,₹@/-]/g) || [];
  return symbolMatches.length / story.length > 0.15;
}

function detectAmountMismatch(data: CaseData) {
  const fieldAmount = Number(data.amountLost);
  const matches = Array.from(data.story.matchAll(/(?:₹|rs\.?|inr)?\s*([0-9][0-9,]*(?:\.\d+)?)/gi));
  const storyAmounts = matches.map((match) => Number(match[1].replace(/,/g, ""))).filter((amount) => amount > 0);
  const differentAmount = storyAmounts.find((amount) => fieldAmount > 0 && amount !== fieldAmount);

  if (!differentAmount) return "";

  return `Amount mismatch detected: the amount field says ₹${data.amountLost}, but the story mentions ₹${differentAmount}. Please verify before generating PDF.`;
}

function getVerifiedSourceNotes(data: CaseData) {
  const aiSources = [
    ...(data.aiAnalysis?.review?.verifiedSourcesUsed || []),
    ...(data.advisorChats || []).flatMap((chat) => chat.verifiedSourcesUsed || []),
  ];
  const localSources = buildKnowledgeContext(data).map((entry) => ({ title: entry.title, sourceName: entry.sourceName, sourceUrl: entry.sourceUrl, lastChecked: entry.lastChecked }));
  const portalSources = buildOfficialActionSuggestions(data).portals.map((portal) => ({ title: portal.title, sourceName: portal.sourceName, sourceUrl: portal.url, lastChecked: portal.lastChecked }));
  return Array.from(new Map([...aiSources, ...localSources, ...portalSources].map((source) => [source.title + source.sourceUrl, source])).values());
}

function hasLawHallucinationRisk(text: string, sources: VerifiedSource[]) {
  return /\b(Section|IPC|BNS|BNSS|BSA|Act)\b/i.test(text) && sources.length === 0;
}

function calculateCaseQualityScore(data: CaseData) {
  let score = 0;
  const suggestions: string[] = [];

  if (data.caseType === "Property / Land Dispute") {
    if (data.story.trim().length >= 80) score += 20;
    else suggestions.push("Add clear relationship/history of the property.");
  } else if (data.caseType === "Consumer Complaint") {
    if (data.story.trim().length >= 80) score += 20;
    else suggestions.push("Add clearer order, seller/platform, defect/service issue, complaint history, and refund/replacement details.");
  } else if (data.caseType === "RTI / Government Service Delay" || data.caseType === "Government Document / Certificate Issue") {
    if (data.story.trim().length >= 80) score += 20;
    else suggestions.push("Add department name, application/reference number, date of application, delay period, acknowledgement, and action needed.");
  } else if (data.story.trim().length >= 80 && countUsefulStoryKeywords(data.story) >= 3) score += 20;
  else suggestions.push("Add a clearer story with useful details like WhatsApp, UPI, payment, transaction, bank, fraud, blocked, or refund.");

  if (hasTooManyRandomSymbols(data.story)) {
    score -= 10;
    suggestions.push("Reduce random symbols and write the story in clear sentences.");
  }

  if (data.incidentDate) score += 10;
  else suggestions.push("Add the incident date.");

  if (Number(data.amountLost) > 0) score += 10;
  else suggestions.push("Add the amount lost.");

  if (data.oppositeParty.trim()) score += 15;
  else suggestions.push(data.caseType === "Property / Land Dispute" ? "Add opposite party details." : data.caseType === "Consumer Complaint" ? "Add seller/platform/service provider details." : data.caseType === "RTI / Government Service Delay" ? "Add department/public authority details." : "Add opposite party details such as UPI ID, phone number, name, or account details.");

  if (data.caseType === "Property / Land Dispute") {
    const allProofText = [...data.proofs, ...(data.customProofs || []), data.story].join(" ").toLowerCase();
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
  } else if (data.caseType === "Consumer Complaint") {
    const allProofText = [...data.proofs, ...(data.customProofs || []), data.story].join(" ").toLowerCase();
    if (/(invoice|receipt|order)/i.test(allProofText)) score += 15;
    else suggestions.push("Add invoice/order receipt or order ID if available.");
    if (/(photo|video|damaged|defect)/i.test(allProofText)) score += 10;
    else suggestions.push("Add product photos/video if relevant.");
    if (/(delivery|delivered)/i.test(allProofText)) score += 10;
    else suggestions.push("Add delivery proof if available.");
    if (/(chat|email|support|complaint)/i.test(allProofText)) score += 10;
    else suggestions.push("Add complaint emails/chats or support ticket history.");
  } else if (data.caseType === "RTI / Government Service Delay" || data.caseType === "Government Document / Certificate Issue") {
    const allProofText = [...data.proofs, ...(data.customProofs || []), data.story].join(" ").toLowerCase();
    if (/(application|acknowledgement|receipt|reference)/i.test(allProofText)) score += 15;
    else suggestions.push("Add application acknowledgement or receipt/reference number.");
    if (/(department|authority)/i.test(allProofText)) score += 10;
    else suggestions.push("Add department/public authority name.");
    if (/(follow-up|reminder|email)/i.test(allProofText)) score += 10;
    else suggestions.push("Add previous follow-up emails or reminders if available.");
  } else {

  if (data.proofs.includes("UPI transaction screenshot")) score += 15;
  else suggestions.push("Add the UPI transaction screenshot if available.");

  if (data.proofs.includes("WhatsApp chat screenshot")) score += 10;
  else suggestions.push("Add WhatsApp/chat screenshots if the scammer contacted you there.");

  if (data.proofs.includes("Bank SMS")) score += 10;
  else suggestions.push("Add bank SMS, debit alert, or bank statement entry.");
  }

  if (data.relief.length + (data.customReliefs || []).length >= 2) score += 10;
  else suggestions.push("Select at least two relief options if they match your situation.");

  if (data.uploadedFiles.length >= 1 || (data.customProofs || []).length >= 1) score += 10;
  else suggestions.push("Upload at least one proof file so the annexure index is stronger.");

  if (data.uploadedFiles.length >= 3 || (data.customProofs || []).length >= 3) score += 10;
  else suggestions.push("Upload three or more key proof files if available.");

  score = Math.max(0, Math.min(100, score));

  return { score, label: score >= 70 ? "Strong Preparation" : score >= 40 ? "Moderate Preparation" : "Weak Preparation", suggestions };
}

function getLegalRoutes(data: CaseData) {
  if (data.caseType === "Property / Land Dispute") {
    return [
      "Use this kit as a Legal Aid Consultation Note only.",
      "Approach legal aid/lawyer with property papers, revenue/mutation/tax records, notices, photos, and timeline.",
      "Do not sign or submit property documents without legal review.",
      "Check old court case details, case number, court name, and current status through legal aid/lawyer or official court sources.",
      "This point needs verification from legal aid/lawyer or official sources.",
    ];
  }
  return cyberLegalRoutes;
}

function generateComplaintDraft(data: CaseData) {
  const today = new Date().toISOString().split("T")[0];
  const followUps = Object.entries(data.followUpAnswers || {})
    .filter(([, answer]) => answer.trim())
    .map(([question, answer]) => `- ${question}\n  ${answer}`)
    .join("\n");
  const standardProofs = data.proofs.filter((proof) => proof !== "Other proof / document");
  const proofList = standardProofs.length ? standardProofs.map((proof, index) => `${index + 1}. ${proof}`).join("\n") : "1. Evidence to be added";
  const customProofList = data.customProofs?.length ? `\n\nCustom proofs:\n${data.customProofs.map((proof, index) => `${index + 1}. ${proof}`).join("\n")}` : "";
  const annexures = data.uploadedFiles.length ? data.uploadedFiles.map((file, index) => `A${index + 1} - ${file.fileName} - ${file.evidenceCategory}`).join("\n") : "No uploaded annexures added yet.";
  const combinedReliefs = [...data.relief.filter((item) => item !== "Other relief / outcome"), ...(data.customReliefs || [])];
  const reliefList = combinedReliefs.length ? combinedReliefs.map((relief, index) => `${index + 1}. ${relief}`).join("\n") : "1. Relief to be confirmed";

  const outputMode = resolveOutputMode(data.caseType, data.story, data.aiAnalysis?.classification?.caseType, data.aiAnalysis?.classification?.outputMode);
  if (outputMode === "urgent-legal-aid-route") {
    return `Legal Aid Consultation Note

This is not a final complaint or defence strategy. This matter should be reviewed urgently by legal aid or a licensed advocate.

Name: ${data.fullName}
Contact: ${data.contact}
Case type: ${data.caseType}
Incident date: ${data.incidentDate}

Short facts:
${data.story}

Timeline:
- Incident/date known: ${data.incidentDate || "Not provided"}
- Opposite party/person/authority: ${data.oppositeParty || "Not provided"}
- Reported amount/value: Rs. ${data.amountLost || "0"}

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
Name: ${data.fullName}
Contact: ${data.contact}
Case type: ${data.caseType}

Facts summary:
${data.story}

Timeline:
- Incident date: ${data.incidentDate}
- Opposite party: ${data.oppositeParty || "Not provided"}
- Reported amount/value: Rs. ${data.amountLost || "0"}

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
The Concerned Authority

Subject:
Complaint / application regarding ${data.caseType}

Respected Sir/Madam,

I, ${data.fullName}, wish to submit this complaint/application regarding ${data.caseType}.

On ${data.incidentDate}, I was contacted by ${data.oppositeParty || "the opposite party / suspected person"}. Based on my statement, the incident happened as follows:

${data.story}

An amount of ₹${data.amountLost} was lost/transferred in connection with the above incident.

Evidence available:
Standard proofs:
${proofList}${customProofList}

Custom document safety note:
Custom documents are user-provided and should be verified before filing or relying on them.

Uploaded annexures:
${annexures}

Additional details provided during follow-up:
${followUps || "No additional follow-up answers provided."}

I request the concerned authority to kindly record my complaint, examine the transaction details, take appropriate action as per law, and guide me regarding further steps.

Relief requested:
${reliefList}

I understand that this is a draft complaint prepared for case organization and should be verified with legal aid/lawyer or concerned authority before filing.

Declaration:
The information stated above is true to the best of my knowledge.

Name: ${data.fullName}
Contact: ${data.contact}
Date: ${today}`;
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
  return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">{label}</p><p className="mt-2 font-bold">{value}</p></div>;
}

function List({ items }: { items: string[] }) {
  return <ul className="space-y-3">{items.map((item) => <li key={item} className="rounded-2xl bg-slate-50 p-4 font-semibold leading-7">{item}</li>)}</ul>;
}

function OfficialActionLinks({ caseData }: { caseData: CaseData }) {
  const suggestions = buildOfficialActionSuggestions(caseData);

  return (
    <KitSection title={t("kitOfficialLinks")}>
      <div className="rounded-[2rem] border border-teal-100 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-6 text-white shadow-2xl">
        <p className="max-w-3xl text-sm font-semibold leading-6 text-slate-300">{t("kitOfficialLinksDesc")}</p>
        {suggestions.showEmergency && <p className="mt-4 rounded-2xl border border-orange-300/40 bg-orange-500/15 p-4 text-sm font-bold text-orange-100">{t("kitEmergencyWarning")}</p>}
        <p className="mt-4 rounded-2xl bg-white/10 p-4 text-sm font-semibold text-slate-200">{suggestions.stateMessage}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {suggestions.portals.map((portal) => <PortalCard key={portal.id} portal={portal} />)}
        </div>
        <p className="mt-5 rounded-2xl bg-slate-950 p-4 text-sm font-semibold text-slate-200">{t("kitPortalDisclaimer")}</p>
      </div>
    </KitSection>
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

function AiInfo({ title, items }: { title: string; items: string[] }) {
  return <div className="rounded-2xl bg-slate-50 p-4"><h3 className="font-black text-teal-700">{title}</h3><ul className="mt-3 space-y-2 text-sm font-semibold text-slate-700">{items.filter(Boolean).map((item) => <li key={item}>{item}</li>)}</ul></div>;
}
