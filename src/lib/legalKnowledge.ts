import { verifiedLegalKnowledge } from "@/data/legalKnowledgeBase";

type CaseLike = { caseType?: string; aiAnalysis?: { classification?: { outputMode?: string } } };

function getKnowledgeForCaseType(caseType?: string) {
  return verifiedLegalKnowledge.filter((entry) => entry.caseType === caseType);
}

function getLegalAidKnowledge() {
  return verifiedLegalKnowledge.filter((entry) => entry.category === "legal-aid");
}

function getSafetyKnowledge(outputMode?: string) {
  return verifiedLegalKnowledge.filter((entry) => entry.category === "safety" || outputMode === "urgent-legal-aid-route");
}

export function buildKnowledgeContext(caseData: CaseLike) {
  const entries = [
    ...getKnowledgeForCaseType(caseData.caseType),
    ...getLegalAidKnowledge(),
    ...getSafetyKnowledge(caseData.aiAnalysis?.classification?.outputMode),
  ];
  return Array.from(new Map(entries.map((entry) => [entry.id, entry])).values());
}
