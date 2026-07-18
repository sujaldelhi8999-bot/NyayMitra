import { jsPDF } from "jspdf-fontkit";
import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import { notoSansDevanagari } from "@/fonts/NotoSansDevanagari";
import { getCaseConfig, getOutputModeForCase } from "@/lib/caseConfig";
import { buildOfficialActionSuggestions } from "@/lib/officialPortals";
import type { CaseData } from "@/types/case";
import { generateComplaintDraft } from "@/lib/draftTemplates";
import { calculateCaseQualityScore } from "@/lib/qualityScore";
import {
  timeline,
  evidenceRows,
  getMissingProofSuggestions,
  detectAmountMismatch,
  getVerifiedSourceNotes,
  getLegalRoutes,
} from "@/lib/caseUtils";
import { OTHER_RELIEF_OPTION } from "@/lib/constants";

const visitChecklist = [
  "Carry original ID proof",
  "Carry bank statement",
  "Carry screenshots in printed and digital form",
  "Note UTR / transaction ID",
  "Keep phone number / UPI ID / chat details ready",
  "Explain facts in chronological order",
  "Do not delete original chats or SMS",
];

function getKitTitle(caseType: string, outputMode: string) {
  if (outputMode === "urgent-legal-aid-route") return "Legal Aid Consultation Note";
  if (caseType === "Cyber Fraud / UPI Scam") return "Cyber Fraud Legal Action Kit";
  if (caseType === "Consumer Complaint") return "Consumer Complaint Preparation Kit";
  if (caseType === "Unpaid Salary / Gig Worker Payment") return "Salary Dispute Preparation Kit";
  if (caseType === "Other / Not Sure") return "General Legal Guidance Kit";
  return `${caseType} Preparation Kit`;
}

export function generateLegalKitPdf(caseData: CaseData, language: Language) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  try {
    doc.addFileToVFS("NotoSansDevanagari-Regular.ttf", notoSansDevanagari);
    doc.addFont("NotoSansDevanagari-Regular.ttf", "NotoSansDevanagari", "normal");
  } catch {
    // Font registration failed — fall back to helvetica
  }

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
    doc.setFontSize(size);
    const content: string[] = Array.isArray(lines) ? lines : doc.splitTextToSize(lines, pageWidth - margin * 2);
    content.forEach((line) => {
      if (!line || !line.trim()) {
        y += size + 6;
        return;
      }
      addPageIfNeeded(16);
      if (/[\u0900-\u097F]/.test(line)) {
        doc.setFont("NotoSansDevanagari", "normal");
      } else {
        doc.setFont("helvetica", bold ? "bold" : "normal");
      }
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

  const outputMode = getOutputModeForCase(caseData);
  const kitTitle = getKitTitle(caseData.caseType, outputMode);
  const activeProofOptions = Array.from(new Set([...getCaseConfig(caseData.caseType).proofs, ...(caseData.aiAnalysis?.classification?.suggestedProofs || [])]));
  const missingProofs = getMissingProofSuggestions(caseData, activeProofOptions.filter((proof) => !caseData.proofs.includes(proof)));
  const quality = calculateCaseQualityScore(caseData);
  const complaint = caseData.complaintDraft || generateComplaintDraft(caseData, language);
  const answeredFollowUps = Object.entries(caseData.followUpAnswers || {}).filter(([, answer]) => answer.trim());
  const amountMismatch = detectAmountMismatch(caseData);
  const verifiedSourceNotes = getVerifiedSourceNotes(caseData);
  const officialActionSuggestions = buildOfficialActionSuggestions(caseData);

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
    `${t("kitLabelReliefWanted")}: ${[...caseData.relief.filter((item) => item !== OTHER_RELIEF_OPTION), ...(caseData.customReliefs || [])].join(", ")}`,
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
