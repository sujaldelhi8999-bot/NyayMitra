import type { CaseData, VerifiedSource } from "@/types/case";
import { buildKnowledgeContext } from "./legalKnowledge";
import { buildOfficialActionSuggestions } from "./officialPortals";
import { getCaseConfig } from "./caseConfig";
import { OTHER_PROOF_OPTION } from "./constants";

export { OTHER_PROOF_OPTION };

export const proofMeaning: Record<string, string> = {
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

export const proofAction: Record<string, string> = {
  "WhatsApp chat screenshot": "Save full chat screenshots with visible phone number and date.",
  "UPI transaction screenshot": "Attach screenshot and bank statement entry.",
  "Bank SMS": "Keep SMS screenshot and bank statement.",
  "Phone number": "Mention number in complaint.",
  "Email/chat record": "Export or screenshot full conversation.",
  "Police/cyber complaint acknowledgement": "Attach acknowledgement number and date.",
};

export const cyberLegalRoutes = [
  "Report cyber fraud on official cybercrime portal.",
  "Contact bank support immediately and request transaction dispute/freeze support.",
  "Prepare written complaint with transaction ID, screenshots, phone number, UPI ID, and timeline.",
  "For serious/high-value cases, consult legal aid/lawyer.",
  "Exact law sections should be verified from official sources before filing.",
];

export const propertyLegalRoutes = [
  "Use this kit as a Legal Aid Consultation Note only.",
  "Approach legal aid/lawyer with property papers, revenue/mutation/tax records, notices, photos, and timeline.",
  "Do not sign or submit property documents without legal review.",
  "Check old court case details, case number, court name, and current status through legal aid/lawyer or official court sources.",
  "This point needs verification from legal aid/lawyer or official sources.",
];

export function getMissingProofSuggestions(data: CaseData, standardMissing: string[]) {
  if (data.caseType === "Property / Land Dispute") {
    return ["Title/sale/property papers", "Revenue/mutation/tax records", "Property location/identifier", "Court papers/case number if any", "Notices/messages"].slice(0, 5);
  }
  return standardMissing.slice(0, 8);
}

export function evidenceRows(data: CaseData) {
  const options = Array.from(
    new Set([...getCaseConfig(data.caseType).proofs, ...(data.aiAnalysis?.classification?.suggestedProofs || []), ...(data.customProofs || [])])
  );
  return options.map((proof) => {
    const custom = (data.customProofs || []).includes(proof);
    const uploadedFile = data.uploadedFiles.find((file) => file.evidenceCategory === proof);
    const available = custom || data.proofs.includes(proof);

    return {
      annexure: uploadedFile ? `A${data.uploadedFiles.findIndex((file) => file.id === uploadedFile.id) + 1}` : "-",
      evidence: proof,
      status: available ? "Available" : "Missing",
      fileName: uploadedFile?.fileName || (custom ? "Custom proof added, file not uploaded yet." : available ? "Marked available, file not uploaded yet." : "No file / not marked."),
      proves: custom
        ? "User-provided supporting proof. Meaning should be verified during legal-aid/lawyer review."
        : proofMeaning[proof] || "Supports the facts, timeline, identity, payment, communication, or authority history.",
      action: custom
        ? "Keep original copy safe and mention it in consultation/draft."
        : proofAction[proof] || "Keep the original safe and attach a copy for review.",
    };
  });
}

export function timeline(data: CaseData) {
  if (data.caseType === "Property / Land Dispute") {
    return [
      `Property dispute date/reference: ${data.incidentDate || "Not provided"}`,
      `Opposite party/person involved: ${data.oppositeParty || "Not provided"}`,
      `Documents collected: ${[...data.proofs.filter((item) => item !== OTHER_PROOF_OPTION), ...(data.customProofs || [])].join(", ") || "None selected"}`,
      "Known/old court case details should be checked with legal aid/lawyer if available.",
      "Next action: Organize documents and approach legal aid/lawyer with consultation note.",
    ];
  }
  if (data.caseType === "Consumer Complaint") {
    return [
      `Purchase/service date: ${data.incidentDate || "Not provided"}`,
      `Seller/platform: ${data.oppositeParty || "Not provided"}`,
      `Reported amount/value: Rs. ${data.amountLost || "0"}`,
      `Evidence collected: ${data.proofs.join(", ") || "None selected"}`,
      "Next action: Prepare refund/replacement representation for review.",
    ];
  }
  if (data.caseType === "RTI / Government Service Delay" || data.caseType === "Government Document / Certificate Issue") {
    return [
      `Application/date reference: ${data.incidentDate || "Not provided"}`,
      `Department/authority: ${data.oppositeParty || "Not provided"}`,
      `Evidence collected: ${data.proofs.join(", ") || "None selected"}`,
      "Next action: Prepare follow-up/RTI-style request where applicable.",
    ];
  }
  if (data.caseType === "Lost Documents / Police Complaint") {
    return [
      `Loss/report date: ${data.incidentDate || "Not provided"}`,
      `Location/authority details: ${data.oppositeParty || "Not provided"}`,
      `Evidence collected: ${data.proofs.join(", ") || "None selected"}`,
      "Next action: Prepare lost document report details and check State/UT route where applicable.",
    ];
  }
  return [
    `Incident happened on ${data.incidentDate}`,
    `Payment/loss occurred for Rs. ${data.amountLost}`,
    `Evidence collected: ${[...data.proofs.filter((item) => item !== OTHER_PROOF_OPTION), ...(data.customProofs || [])].length ? [...data.proofs.filter((item) => item !== OTHER_PROOF_OPTION), ...(data.customProofs || [])].join(", ") : "None selected"}`,
    data.proofs.includes("Police/cyber complaint acknowledgement")
      ? "Complaint already initiated - attach acknowledgement."
      : "Complaint not yet filed - prepare cybercrime/police/bank complaint draft.",
    "Next action: Review draft, organize evidence, and verify with legal aid/lawyer before filing.",
  ];
}

export function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function calculateRiskLevel(amount: string) {
  const value = Number(amount);
  if (value > 50000) return "High Risk";
  if (value > 10000) return "Medium Risk";
  return "Low Risk";
}

export function detectAmountMismatch(data: CaseData) {
  const fieldAmount = Number(data.amountLost);
  const matches = Array.from(data.story.matchAll(/(?:₹|rs\.?|inr)?\s*([0-9][0-9,]*(?:\.\d+)?)/gi));
  const storyAmounts = matches.map((match) => Number(match[1].replace(/,/g, ""))).filter((amount) => amount > 0);
  const differentAmount = storyAmounts.find((amount) => fieldAmount > 0 && amount !== fieldAmount);

  if (!differentAmount) return "";

  return `Amount mismatch detected: the amount field says ₹${data.amountLost}, but the story mentions ₹${differentAmount}. Please verify before generating PDF.`;
}

export function getVerifiedSourceNotes(data: CaseData): VerifiedSource[] {
  const aiSources = [
    ...(data.aiAnalysis?.review?.verifiedSourcesUsed || []),
    ...(data.advisorChats || []).flatMap((chat) => chat.verifiedSourcesUsed || []),
  ];
  const localSources = buildKnowledgeContext(data).map((entry) => ({
    title: entry.title,
    sourceName: entry.sourceName,
    sourceUrl: entry.sourceUrl,
    lastChecked: entry.lastChecked,
  }));
  const portalSources = buildOfficialActionSuggestions(data).portals.map((portal) => ({
    title: portal.title,
    sourceName: portal.sourceName,
    sourceUrl: portal.url,
    lastChecked: portal.lastChecked,
  }));
  return Array.from(new Map([...aiSources, ...localSources, ...portalSources].map((source) => [source.title + source.sourceUrl, source])).values());
}

export function hasLawHallucinationRisk(text: string, sources: VerifiedSource[]) {
  return /\b(Section|IPC|BNS|BNSS|BSA|Act)\b/i.test(text) && sources.length === 0;
}

export function getNextStepsChecklist(data: CaseData) {
  const outputMode = data.outputMode || "full-preparation-kit";
  if (outputMode === "urgent-legal-aid-route" && data.caseType === "Property / Land Dispute") {
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
  if (outputMode === "urgent-legal-aid-route") {
    return [
      "Keep original documents safe.",
      "Write a date-wise timeline.",
      "Collect notices/court/police papers if any.",
      "Do not sign or submit anything without legal review.",
      "Approach legal aid/lawyer with the consultation note.",
    ];
  }
  if (data.caseType === "Consumer Complaint") {
    return [
      "Keep invoice/order receipt and order ID ready.",
      "Save product photos/video and delivery proof.",
      "Save complaint emails/chats/support ticket history.",
      "Write a clear refund/replacement request for review.",
      "Use National Consumer Helpline where applicable.",
      "Verify next steps with legal aid/lawyer for serious disputes.",
    ];
  }
  if (data.caseType === "RTI / Government Service Delay" || data.caseType === "Government Document / Certificate Issue") {
    return [
      "Keep application acknowledgement and reference number ready.",
      "Note department/public authority name.",
      "Prepare a date-wise delay timeline.",
      "Collect previous reminders or follow-up emails.",
      "Use RTI Online for Central Government public authorities where applicable.",
      "Verify State/UT route or department process before submitting.",
    ];
  }
  if (data.caseType === "Lost Documents / Police Complaint") {
    return [
      "Keep ID proof copy ready.",
      "Write document details and approximate loss date/location.",
      "Check State/UT police lost-report portal where applicable.",
      "Visit local police station if online route is not available.",
      "Keep acknowledgement safely after reporting.",
    ];
  }
  return [
    "Save all screenshots",
    "Note transaction ID / UTR",
    "Contact bank support",
    "File cybercrime complaint where applicable",
    "Prepare draft for review",
    "Keep ID proof and bank statement ready",
    "Consult legal aid/lawyer for serious matters",
  ];
}

export function generateFollowUpQuestions(data: CaseData) {
  if (data.caseType === "Property / Land Dispute") {
    return Array.from(
      new Set([
        "What is the property location and basic property identifier, if known?",
        "What is your relationship to the original owner?",
        "Do you have sale deed/title papers or old land records?",
        "Do you have revenue/mutation/tax records?",
        "Is there any ongoing or old court case? If yes, do you know case number/court name?",
        "Is there any urgent sale, transfer, eviction, or possession issue?",
        "What exact help do you want from legal aid/lawyer?",
        ...(data.aiAnalysis?.followupQuestions || []),
      ])
    );
  }

  if (data.caseType === "Consumer Complaint") {
    return Array.from(
      new Set([
        "What is the order ID or invoice number?",
        "Who is the seller/platform/service provider?",
        "What was the date of purchase and delivery/service?",
        "What exactly was defective, damaged, delayed, or not provided?",
        "Have you requested refund, replacement, or written response already?",
        "Do you have complaint emails, chats, support tickets, invoice, photos, or delivery proof?",
        ...(data.aiAnalysis?.followupQuestions || []),
      ])
    );
  }

  if (data.caseType === "RTI / Government Service Delay" || data.caseType === "Government Document / Certificate Issue") {
    return Array.from(
      new Set([
        "What is the department or public authority name?",
        "What is the application/reference/receipt number?",
        "What was the date of application?",
        "How long has the matter been delayed?",
        "Do you have acknowledgement, receipt, or application copy?",
        "What previous follow-ups or reminders have you sent?",
        "What information, certificate, service, or action do you need now?",
        ...(data.aiAnalysis?.followupQuestions || []),
      ])
    );
  }

  const questions: string[] = [];
  const oppositeParty = data.oppositeParty.toLowerCase();
  const story = data.story.toLowerCase();

  if (!oppositeParty.includes("upi") && !oppositeParty.includes("@")) {
    questions.push("Do you know the receiver UPI ID or bank account details?");
  }

  if (!story.includes("utr") && !story.includes("transaction")) {
    questions.push("Do you have the UTR / transaction ID of the payment?");
  }

  if (!data.proofs.includes("Police/cyber complaint acknowledgement")) {
    questions.push("Have you already filed a cybercrime portal or police complaint?");
  }

  if (!data.proofs.includes("Bank SMS")) {
    questions.push("Do you have a bank SMS, bank statement entry, or debit alert?");
  }

  if (Number(data.amountLost) > 10000) {
    questions.push("Have you contacted your bank to request transaction dispute or freeze support?");
  }

  if (data.story.trim().length < 80) {
    questions.push("Can you explain the sequence of events in more detail?");
  }

  questions.push("What exact relief do you want: refund, complaint registration, bank action, or legal aid guidance?");

  return Array.from(new Set([...questions, ...(data.aiAnalysis?.followupQuestions || [])]));
}

export function getLegalRoutes(data: CaseData) {
  if (data.caseType === "Property / Land Dispute") {
    return propertyLegalRoutes;
  }
  return cyberLegalRoutes;
}