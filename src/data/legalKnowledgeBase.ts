export type LegalKnowledgeEntry = {
  id: string;
  caseType: string;
  title: string;
  category: "procedure" | "evidence" | "legal-aid" | "template" | "safety";
  sourceName: string;
  sourceUrl: string;
  lastChecked: string;
  plainSummary: string;
  usageNote: string;
};

export const verifiedLegalKnowledge: LegalKnowledgeEntry[] = [
  { id: "cyber-upi-1", caseType: "Cyber Fraud / UPI Scam", title: "Cyber fraud reporting route", category: "procedure", sourceName: "National Cyber Crime Portal", sourceUrl: "https://cybercrime.gov.in/", lastChecked: "2026-07-11", plainSummary: "Cyber fraud complaints can be reported through the official cybercrime portal. Users should keep transaction IDs, screenshots, phone numbers, and bank details ready.", usageNote: "Use as general reporting route only. Exact legal sections must be verified." },
  { id: "cyber-upi-2", caseType: "Cyber Fraud / UPI Scam", title: "Bank dispute and freeze support", category: "procedure", sourceName: "RBI Sachet / Bank customer support route", sourceUrl: "https://sachet.rbi.org.in/", lastChecked: "2026-07-11", plainSummary: "For payment fraud, users should contact their bank quickly and request dispute or freeze support where available.", usageNote: "Use as practical next step, not a guarantee of refund." },
  { id: "consumer-1", caseType: "Consumer Complaint", title: "Consumer grievance route", category: "procedure", sourceName: "National Consumer Helpline", sourceUrl: "https://consumerhelpline.gov.in/", lastChecked: "2026-07-11", plainSummary: "Consumers can organize bills, order details, complaint history, and seller responses before raising a grievance.", usageNote: "Do not cite exact law sections unless separately verified." },
  { id: "salary-1", caseType: "Unpaid Salary / Gig Worker Payment", title: "Unpaid work payment preparation", category: "evidence", sourceName: "e-Shram / labour grievance preparation route", sourceUrl: "https://eshram.gov.in/", lastChecked: "2026-07-11", plainSummary: "Workers should collect appointment messages, work proof, attendance records, payment promises, invoices, and employer contact details.", usageNote: "Use for evidence organization and legal-aid referral." },
  { id: "lost-doc-1", caseType: "Lost Documents / Police Complaint", title: "Lost document complaint preparation", category: "template", sourceName: "Police citizen service portals", sourceUrl: "https://digitalpolice.gov.in/", lastChecked: "2026-07-11", plainSummary: "For lost documents, users should prepare document type, number if known, place/date of loss, ID proof, and contact details.", usageNote: "Use as a drafting template route only." },
  { id: "rti-1", caseType: "RTI / Government Service Delay", title: "RTI and service delay preparation", category: "procedure", sourceName: "RTI Online", sourceUrl: "https://rtionline.gov.in/", lastChecked: "2026-07-11", plainSummary: "Users can organize application numbers, department names, dates, and pending service details before filing an RTI or grievance.", usageNote: "Use as general procedural preparation." },
  { id: "legal-aid-1", caseType: "Legal Aid / NALSA", title: "Legal aid route", category: "legal-aid", sourceName: "NALSA", sourceUrl: "https://nalsa.gov.in/", lastChecked: "2026-07-11", plainSummary: "People who cannot afford a lawyer may approach District Legal Services Authority, State Legal Services Authority, or NALSA channels.", usageNote: "Recommend legal-aid/lawyer review for serious or high-value matters." },
  { id: "safety-high-risk-1", caseType: "High-risk legal-aid routing", title: "High-risk matter safety routing", category: "safety", sourceName: "NyayMitra safety policy", sourceUrl: "https://nalsa.gov.in/", lastChecked: "2026-07-11", plainSummary: "High-stakes issues such as arrest, bail, domestic violence, custody, serious violence, and property disputes should be routed to urgent legal-aid/lawyer support.", usageNote: "Do not generate final strategy. Provide document organization and urgent referral only." },
];

export type CaseLike = { caseType?: string; aiAnalysis?: { classification?: { outputMode?: string } } };

export function buildKnowledgeContext(caseData: CaseLike) {
  const caseTypeEntries = verifiedLegalKnowledge.filter((entry) => entry.caseType === caseData.caseType);
  const legalAidEntries = verifiedLegalKnowledge.filter((entry) => entry.category === "legal-aid");
  const outputMode = caseData.aiAnalysis?.classification?.outputMode;
  const safetyEntries = verifiedLegalKnowledge.filter((entry) => entry.category === "safety" || outputMode === "urgent-legal-aid-route");

  const entries = [...caseTypeEntries, ...legalAidEntries, ...safetyEntries];
  return Array.from(new Map(entries.map((entry) => [entry.id, entry])).values());
}

