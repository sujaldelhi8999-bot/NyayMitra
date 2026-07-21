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


function getKitTitle(caseType: string, outputMode: string, language: Language) {
  if (language === "hi") {
    if (outputMode === "urgent-legal-aid-route") return "कानूनी सहायता परामर्श नोट";
    if (caseType === "Cyber Fraud / UPI Scam") return "साइबर धोखाधड़ी लीगल एक्शन किट";
    if (caseType === "Consumer Complaint") return "उपभोक्ता शिकायत तैयारी किट";
    if (caseType === "Unpaid Salary / Gig Worker Payment") return "वेतन विवाद तैयारी किट";
    if (caseType === "Other / Not Sure") return "सामान्य कानूनी मार्गदर्शन किट";
    return `${caseType} तैयारी किट`;
  }
  if (outputMode === "urgent-legal-aid-route") return "Legal Aid Consultation Note";
  if (caseType === "Cyber Fraud / UPI Scam") return "Cyber Fraud Legal Action Kit";
  if (caseType === "Consumer Complaint") return "Consumer Complaint Preparation Kit";
  if (caseType === "Unpaid Salary / Gig Worker Payment") return "Salary Dispute Preparation Kit";
  if (caseType === "Other / Not Sure") return "General Legal Guidance Kit";
  return `${caseType} Preparation Kit`;
}

export function generateLegalKitPdf(caseData: CaseData, language: Language) {
  const pdfLang: Language = language === "hi" ? "hi" : "en";
  const t = (key: Parameters<typeof translate>[1]) => translate(pdfLang, key);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let hasDevanagariFont = false;
  try {
    doc.addFileToVFS("NotoSansDevanagari-Regular.ttf", notoSansDevanagari);
    doc.addFont("NotoSansDevanagari-Regular.ttf", "NotoSansDevanagari", "normal");
    hasDevanagariFont = true;
  } catch {
    hasDevanagariFont = false;
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
      const isDevanagari = /[\u0900-\u097F]/.test(line);
      if (isDevanagari && hasDevanagariFont) {
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
  const kitTitle = getKitTitle(caseData.caseType, outputMode, pdfLang);
  const activeProofOptions = Array.from(new Set([...getCaseConfig(caseData.caseType).proofs, ...(caseData.aiAnalysis?.classification?.suggestedProofs || [])]));
  const missingProofs = getMissingProofSuggestions(caseData, activeProofOptions.filter((proof) => !caseData.proofs.includes(proof)));
  const quality = calculateCaseQualityScore(caseData);
  const complaint = caseData.complaintDraft || generateComplaintDraft(caseData, pdfLang);
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
    `${t("kitLabelContact")}: ${[caseData.phone, caseData.email].filter(Boolean).join(" | ") || ""}`,
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

  section(outputMode === "urgent-legal-aid-route" ? (language === "hi" ? "तथ्य समयरेखा" : "Facts Timeline") : t("kitTimelineOfEvents"));
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
    text(caseData.aiAnalysis.extraction?.caseSummary || caseData.aiAnalysis.classification?.shortSummary || (language === "hi" ? "कोई AI सारांश उपलब्ध नहीं है।" : "No AI summary available."));
    section(language === "hi" ? "AI द्वारा निकाली गई समयरेखा" : "AI Extracted Timeline");
    text(caseData.aiAnalysis.extraction?.timeline?.length ? caseData.aiAnalysis.extraction.timeline.map((item) => `- ${item.date}: ${item.event}`) : (language === "hi" ? "कोई AI समयरेखा उपलब्ध नहीं है।" : "No AI timeline available."));
    section(t("kitAiMissingDetails"));
    text(caseData.aiAnalysis.extraction?.missingDetails?.length ? caseData.aiAnalysis.extraction.missingDetails.map((item) => `- ${item}`) : (language === "hi" ? "कोई AI विवरण उपलब्ध नहीं है।" : "No AI missing details available."));
    section(t("kitAiReviewSuggestions"));
    text(caseData.aiAnalysis.review?.suggestions?.length ? caseData.aiAnalysis.review.suggestions.map((item) => `- ${item}`) : (language === "hi" ? "कोई AI समीक्षा सुझाव उपलब्ध नहीं है।" : "No AI review suggestions available."));
  }

  section(t("kitQualityScore"));
  text(`${quality.score}/100 - ${quality.label}`);

  section(t("kitPrepSuggestions"));
  text(quality.suggestions.length ? quality.suggestions.map((item) => `- ${item}`) : t("kitGoodPrep"));

  section(t("kitRelevantLegalRoute"));
  getLegalRoutes(caseData).forEach((route) => text(`- ${route}`));

  section(outputMode === "urgent-legal-aid-route" ? t("kitLegalAidNote") : outputMode === "limited-guidance-kit" ? t("kitDraftRepresentation") : t("kitDraftComplaint"));
  text(complaint);

  const hearingChecklist = [
    t("kitVisitChecklist1"),
    t("kitVisitChecklist2"),
    t("kitVisitChecklist3"),
    t("kitVisitChecklist4"),
    t("kitVisitChecklist5"),
    t("kitVisitChecklist6"),
    t("kitVisitChecklist7"),
  ];

  if (outputMode !== "urgent-legal-aid-route") {
    section(t("kitHearingPrep"));
    hearingChecklist.forEach((item) => text(`- ${item}`));
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
    const pageStr = language === "hi" ? `पृष्ठ ${page} / ${totalPages}` : `Page ${page} of ${totalPages}`;
    doc.text(pageStr, pageWidth - margin - 60, pageHeight - 24);
  }

  doc.save("nyaymitra-legal-action-kit.pdf");
}

