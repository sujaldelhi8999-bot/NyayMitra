import type { CaseData } from "@/types/case";
import { getCaseConfig } from "@/lib/caseConfig";
import { storyKeywords, propertyKeywords, consumerKeywords, rtiKeywords, QUALITY } from "./constants";

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

function hasValidOppositeParty(oppositeParty: string, caseType: string) {
  if (!oppositeParty.trim()) return false;
  const lower = oppositeParty.toLowerCase();
  const hasUpi = /@/.test(oppositeParty);
  const hasPhone = /\d{10}/.test(oppositeParty);
  const hasEmail = /@.*\./.test(oppositeParty);
  const hasName = /[a-z]{2,}/i.test(oppositeParty);
  return hasUpi || hasPhone || hasEmail || hasName;
}

function storyMentionsAmount(story: string, amount: string) {
  if (!amount || Number(amount) <= 0) return false;
  const amountNum = Number(amount);
  const matches = Array.from(story.matchAll(/(?:₹|rs\.?|inr)?\s*([0-9][0-9,]*(?:\.\d+)?)/gi));
  const storyAmounts = matches.map((match) => Number(match[1].replace(/,/g, ""))).filter((a) => a > 0);
  return storyAmounts.some((a) => a === amountNum);
}

function scoreStorySection(data: CaseData, caseType: string, suggestions: string[]) {
  let score = 0;
  const storyLength = data.story.trim().length;
  const keywordCount = countUsefulStoryKeywords(data.story, caseType);
  const storyHasGarbage = hasTooManyRandomSymbols(data.story);
  const storyValid = storyLength >= QUALITY.MIN_STORY_LENGTH && keywordCount >= QUALITY.MIN_KEYWORDS && !storyHasGarbage;

  if (storyValid) {
    score += QUALITY.STORY_SCORE;
  } else {
    if (storyLength < QUALITY.MIN_STORY_LENGTH) {
      if (caseType === "Property / Land Dispute") suggestions.push("Add clear relationship/history of the property (at least 80 characters).");
      else if (caseType === "Consumer Complaint") suggestions.push("Add clearer order, seller/platform, defect/service issue, complaint history, and refund/replacement details (at least 80 characters).");
      else if (caseType === "RTI / Government Service Delay" || caseType === "Government Document / Certificate Issue") suggestions.push("Add department name, application/reference number, date of application, delay period, acknowledgement, and action needed (at least 80 characters).");
      else suggestions.push("Add a clearer story with useful details like WhatsApp, UPI, payment, transaction, bank, fraud, blocked, or refund (at least 80 characters).");
    }
    if (keywordCount < QUALITY.MIN_KEYWORDS) {
      suggestions.push(`Story needs more case-relevant keywords (found ${keywordCount}, need at least ${QUALITY.MIN_KEYWORDS}).`);
    }
    if (storyHasGarbage) {
      score += QUALITY.GARBAGE_PENALTY;
      suggestions.push("Reduce random symbols and write the story in clear sentences.");
    }
  }
  return score;
}

function scoreDate(data: CaseData, suggestions: string[]) {
  if (data.incidentDate) return QUALITY.DATE_SCORE;
  suggestions.push("Add the incident date.");
  return 0;
}

function scoreAmount(data: CaseData, suggestions: string[]) {
  if (Number(data.amountLost) > 0 && storyMentionsAmount(data.story, data.amountLost)) return QUALITY.AMOUNT_SCORE;
  else if (Number(data.amountLost) <= 0) suggestions.push("Add the amount lost.");
  else suggestions.push("Amount in story doesn't match amount field — verify consistency.");
  return 0;
}

function scoreOppositeParty(data: CaseData, caseType: string, suggestions: string[]) {
  if (hasValidOppositeParty(data.oppositeParty, caseType)) return QUALITY.PARTY_SCORE;
  if (caseType === "Property / Land Dispute") suggestions.push("Add opposite party details (name, phone, or contact info).");
  else if (caseType === "Consumer Complaint") suggestions.push("Add seller/platform/service provider details.");
  else if (caseType === "RTI / Government Service Delay" || caseType === "Government Document / Certificate Issue") suggestions.push("Add department/public authority details.");
  else suggestions.push("Add opposite party details such as UPI ID, phone number, name, or account details.");
  return 0;
}

function scoreProofsByCaseType(data: CaseData, caseType: string, suggestions: string[]) {
  let score = 0;
  const allProofText = [...data.proofs, ...(data.customProofs || []), data.story].join(" ").toLowerCase();

  if (caseType === "Property / Land Dispute") {
    if (/(sale deed|title|property papers|old land papers)/i.test(allProofText)) score += QUALITY.PROPERTY_DEED_SCORE;
    else suggestions.push("Add sale deed/title documents if available.");
    if (/(revenue|mutation|tax|khasra|survey)/i.test(allProofText)) score += QUALITY.PROPERTY_REVENUE_SCORE;
    else suggestions.push("Add revenue/mutation/tax records if available.");
    if (/(possession|photo|boundary)/i.test(allProofText)) score += QUALITY.PROPERTY_POSSESSION_SCORE;
    else suggestions.push("Add possession proof if available.");
    if (/(notice|court|case number|civil case)/i.test(allProofText)) score += QUALITY.PROPERTY_COURT_SCORE;
    else suggestions.push("Add any notices/court papers/case number if available.");
    if (!/(location|khasra|survey|plot|village|address)/i.test(allProofText)) suggestions.push("Add property location and survey/khasra/plot details if available.");
    suggestions.push("Add lawyer/legal-aid review because property disputes are high-risk.");
  } else if (caseType === "Consumer Complaint") {
    if (/(invoice|receipt|order)/i.test(allProofText)) score += QUALITY.CONSUMER_INVOICE_SCORE;
    else suggestions.push("Add invoice/order receipt or order ID if available.");
    if (/(photo|video|damaged|defect)/i.test(allProofText)) score += QUALITY.CONSUMER_PHOTO_SCORE;
    else suggestions.push("Add product photos/video if relevant.");
    if (/(delivery|delivered)/i.test(allProofText)) score += QUALITY.CONSUMER_DELIVERY_SCORE;
    else suggestions.push("Add delivery proof if available.");
    if (/(chat|email|support|complaint)/i.test(allProofText)) score += QUALITY.CONSUMER_CHAT_SCORE;
    else suggestions.push("Add complaint emails/chats or support ticket history.");
  } else if (caseType === "RTI / Government Service Delay" || caseType === "Government Document / Certificate Issue") {
    if (/(application|acknowledgement|receipt|reference)/i.test(allProofText)) score += QUALITY.RTI_APPLICATION_SCORE;
    else suggestions.push("Add application acknowledgement or receipt/reference number.");
    if (/(department|authority)/i.test(allProofText)) score += QUALITY.RTI_DEPT_SCORE;
    else suggestions.push("Add department/public authority name.");
    if (/(follow-up|reminder|email)/i.test(allProofText)) score += QUALITY.RTI_FOLLOWUP_SCORE;
    else suggestions.push("Add previous follow-up emails or reminders if available.");
  } else {
    if (data.proofs.includes("UPI transaction screenshot")) score += QUALITY.SCAM_UPI_SCORE;
    else suggestions.push("Add the UPI transaction screenshot if available.");
    if (data.proofs.includes("WhatsApp chat screenshot")) score += QUALITY.SCAM_WHATSAPP_SCORE;
    else suggestions.push("Add WhatsApp/chat screenshots if the scammer contacted you there.");
    if (data.proofs.includes("Bank SMS")) score += QUALITY.SCAM_BANK_SCORE;
    else suggestions.push("Add bank SMS, debit alert, or bank statement entry.");
  }
  return score;
}

function scoreReliefs(data: CaseData, suggestions: string[]) {
  if (data.relief.length + (data.customReliefs || []).length >= 2) return QUALITY.TWO_RELIEFS_SCORE;
  suggestions.push("Select at least two relief options if they match your situation.");
  return 0;
}

function scoreUploadedFiles(data: CaseData, suggestions: string[]) {
  let score = 0;
  if (data.uploadedFiles.length >= 1 || (data.customProofs || []).length >= 1) {
    score += QUALITY.TWO_PROOFS_SCORE;
  } else {
    suggestions.push("Upload at least one proof file so the annexure index is stronger.");
  }
  if (data.uploadedFiles.length >= 3 || (data.customProofs || []).length >= 3) {
    score += QUALITY.THREE_PROOFS_SCORE;
  } else {
    suggestions.push("Upload three or more key proof files if available.");
  }
  return score;
}

export function calculateCaseQualityScore(data: CaseData) {
  const caseType = data.caseType;
  getCaseConfig(caseType);

  const suggestions: string[] = [];
  let score = 0;

  score += scoreStorySection(data, caseType, suggestions);
  score += scoreDate(data, suggestions);
  score += scoreAmount(data, suggestions);
  score += scoreOppositeParty(data, caseType, suggestions);
  score += scoreProofsByCaseType(data, caseType, suggestions);
  score += scoreReliefs(data, suggestions);
  score += scoreUploadedFiles(data, suggestions);

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    label: score >= 70 ? "Strong Preparation" : score >= 40 ? "Moderate Preparation" : "Weak Preparation",
    suggestions,
  };
}
