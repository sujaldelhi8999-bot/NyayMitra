import type { CaseData } from "@/types/case";
import { getCaseConfig } from "@/lib/caseConfig";
import { storyKeywords, propertyKeywords, consumerKeywords, rtiKeywords } from "./constants";

function countUsefulStoryKeywords(story: string, caseType: string) {
  const lowerStory = story.toLowerCase();
  const keywords = caseType === "Property / Land Dispute"
    ? propertyKeywords
    : caseType === "Consumer Complaint"
    ? consumerKeywords
    : caseType === "RTI / Government Service Delay" || caseType === "Government Document / Certificate Issue"
    ? rtiKeywords
    : storyKeywords;
  return keywords.filter((keyword) => lowerStory.includes(keyword)).length;
}

function hasTooManyRandomSymbols(story: string) {
  if (!story.trim()) return false;
  const symbolMatches = story.match(/[^a-zA-Z0-9\s.,₹@/-]/g) || [];
  return symbolMatches.length / story.length > 0.15;
}

export function calculateCaseQualityScore(data: CaseData) {
  let score = 0;
  const suggestions: string[] = [];
  const caseType = data.caseType;
  getCaseConfig(caseType);

  if (caseType === "Property / Land Dispute") {
    if (data.story.trim().length >= 80) score += 20;
    else suggestions.push("Add clear relationship/history of the property.");
  } else if (caseType === "Consumer Complaint") {
    if (data.story.trim().length >= 80) score += 20;
    else suggestions.push("Add clearer order, seller/platform, defect/service issue, complaint history, and refund/replacement details.");
  } else if (caseType === "RTI / Government Service Delay" || caseType === "Government Document / Certificate Issue") {
    if (data.story.trim().length >= 80) score += 20;
    else suggestions.push("Add department name, application/reference number, date of application, delay period, acknowledgement, and action needed.");
  } else if (data.story.trim().length >= 80 && countUsefulStoryKeywords(data.story, caseType) >= 3) {
    score += 20;
  } else {
    suggestions.push("Add a clearer story with useful details like WhatsApp, UPI, payment, transaction, bank, fraud, blocked, or refund.");
  }

  if (hasTooManyRandomSymbols(data.story)) {
    score -= 10;
    suggestions.push("Reduce random symbols and write the story in clear sentences.");
  }

  if (data.incidentDate) score += 10;
  else suggestions.push("Add the incident date.");

  if (Number(data.amountLost) > 0) score += 10;
  else suggestions.push("Add the amount lost.");

  if (data.oppositeParty.trim()) score += 15;
  else {
    if (caseType === "Property / Land Dispute") suggestions.push("Add opposite party details.");
    else if (caseType === "Consumer Complaint") suggestions.push("Add seller/platform/service provider details.");
    else if (caseType === "RTI / Government Service Delay" || caseType === "Government Document / Certificate Issue") suggestions.push("Add department/public authority details.");
    else suggestions.push("Add opposite party details such as UPI ID, phone number, name, or account details.");
  }

  const allProofText = [...data.proofs, ...(data.customProofs || []), data.story].join(" ").toLowerCase();

  if (caseType === "Property / Land Dispute") {
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
  } else if (caseType === "Consumer Complaint") {
    if (/(invoice|receipt|order)/i.test(allProofText)) score += 15;
    else suggestions.push("Add invoice/order receipt or order ID if available.");
    if (/(photo|video|damaged|defect)/i.test(allProofText)) score += 10;
    else suggestions.push("Add product photos/video if relevant.");
    if (/(delivery|delivered)/i.test(allProofText)) score += 10;
    else suggestions.push("Add delivery proof if available.");
    if (/(chat|email|support|complaint)/i.test(allProofText)) score += 10;
    else suggestions.push("Add complaint emails/chats or support ticket history.");
  } else if (caseType === "RTI / Government Service Delay" || caseType === "Government Document / Certificate Issue") {
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

  return {
    score,
    label: score >= 70 ? "Strong Preparation" : score >= 40 ? "Moderate Preparation" : "Weak Preparation",
    suggestions,
  };
}