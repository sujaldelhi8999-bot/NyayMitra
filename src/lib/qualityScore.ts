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

export function calculateCaseQualityScore(data: CaseData) {
  let score = 0;
  const suggestions: string[] = [];
  const caseType = data.caseType;
  getCaseConfig(caseType);

  const storyLength = data.story.trim().length;
  const keywordCount = countUsefulStoryKeywords(data.story, caseType);
  const storyHasGarbage = hasTooManyRandomSymbols(data.story);
  const storyValid = storyLength >= 80 && keywordCount >= 3 && !storyHasGarbage;

  if (storyValid) {
    score += 20;
  } else {
    if (storyLength < 80) {
      if (caseType === "Property / Land Dispute") suggestions.push("Add clear relationship/history of the property (at least 80 characters).");
      else if (caseType === "Consumer Complaint") suggestions.push("Add clearer order, seller/platform, defect/service issue, complaint history, and refund/replacement details (at least 80 characters).");
      else if (caseType === "RTI / Government Service Delay" || caseType === "Government Document / Certificate Issue") suggestions.push("Add department name, application/reference number, date of application, delay period, acknowledgement, and action needed (at least 80 characters).");
      else suggestions.push("Add a clearer story with useful details like WhatsApp, UPI, payment, transaction, bank, fraud, blocked, or refund (at least 80 characters).");
    }
    if (keywordCount < 3) {
      suggestions.push(`Story needs more case-relevant keywords (found ${keywordCount}, need at least 3).`);
    }
    if (storyHasGarbage) {
      score -= 10;
      suggestions.push("Reduce random symbols and write the story in clear sentences.");
    }
  }

  if (data.incidentDate) score += 10;
  else suggestions.push("Add the incident date.");

  if (Number(data.amountLost) > 0 && storyMentionsAmount(data.story, data.amountLost)) score += 10;
  else if (Number(data.amountLost) <= 0) suggestions.push("Add the amount lost.");
  else suggestions.push("Amount in story doesn't match amount field — verify consistency.");

  if (hasValidOppositeParty(data.oppositeParty, caseType)) score += 15;
  else {
    if (caseType === "Property / Land Dispute") suggestions.push("Add opposite party details (name, phone, or contact info).");
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