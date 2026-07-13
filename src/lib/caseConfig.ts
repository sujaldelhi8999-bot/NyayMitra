export type OutputMode = "full-preparation-kit" | "limited-guidance-kit" | "urgent-legal-aid-route";

type CaseConfig = {
  caseType: string;
  caseTypeHi: string;
  caseTypeHinglish: string;
  proofs: string[];
  relief: string[];
  outputMode: OutputMode;
  riskMessage: string;
};

const urgentSafetyKeywords = ["immediate danger", "arrest", "detention", "custody", "eviction threat", "court deadline", "suicide", "self-harm", "serious criminal", "serious violence", "threat to safety", "violence"];
const commonProofs = ["Messages / emails", "Screenshots", "Payment proof", "ID proof if relevant", "Witness details", "Timeline notes", "Other supporting proof"];
const otherProofs = ["Any document", "Screenshots", "Messages / emails", "Payment proof", "Photos / videos", "ID proof if relevant", "Notice / letter", "Police/court/government acknowledgement", "Witness details", "Timeline notes"];
const otherRelief = ["Legal aid guidance", "Document organization", "Complaint/application draft", "Lawyer review", "Authority visit preparation", "Next-step guidance", "Safety guidance if urgent"];

export const highRiskCaseTypes = [
  "Domestic Violence / Family Safety Concern",
  "Property / Land Dispute",
  "Divorce / Custody / Family Matter",
  "Bail / Arrest / Criminal Defence",
];

export const caseConfigs: CaseConfig[] = [
  { caseType: "Cyber Fraud / UPI Scam", caseTypeHi: "साइबर धोखाधड़ी / UPI स्कैम", caseTypeHinglish: "Cyber Fraud / UPI Scam", proofs: ["WhatsApp chat screenshot", "UPI transaction screenshot", "Bank SMS", "Phone number", "Email/chat record", "Police/cyber complaint acknowledgement"], relief: ["Refund", "Police complaint", "Cybercrime complaint", "Bank complaint", "Legal aid guidance"], outputMode: "full-preparation-kit", riskMessage: "Prepare cybercrime, bank, and police complaint material. Verify with legal aid/lawyer where needed." },
  { caseType: "Consumer Complaint", caseTypeHi: "उपभोक्ता शिकायत", caseTypeHinglish: "Consumer Complaint", proofs: ["Invoice/order receipt", "Payment proof", "Product photos", "Delivery proof", "Customer support chat/email", ...commonProofs], relief: ["Refund", "Replacement", "Seller complaint", "Consumer grievance guidance", "Legal aid guidance"], outputMode: "full-preparation-kit", riskMessage: "Consumer preparation kit can be drafted from bills, payment proof, and complaint history." },
  { caseType: "Unpaid Salary / Gig Worker Payment", caseTypeHi: "बकाया वेतन / गिग वर्कर भुगतान", caseTypeHinglish: "Unpaid Salary / Gig Worker Payment", proofs: ["Work agreement/message", "Attendance/work proof", "Payment promise", "Invoice", "Email/chat record", ...commonProofs], relief: ["Payment demand", "Employer/client complaint", "Labour/legal aid guidance", "Draft notice preparation"], outputMode: "full-preparation-kit", riskMessage: "Organize work proof, payment agreement, and reminders before seeking legal aid or authority help." },
  { caseType: "Landlord / Tenant Dispute", caseTypeHi: "मकान मालिक / किरायेदार विवाद", caseTypeHinglish: "Landlord / Tenant Dispute", proofs: ["Rent agreement", "Rent receipts", "Deposit proof", "Notice/message", ...commonProofs], relief: ["Deposit return", "Repair/harassment complaint", "Settlement guidance", "Legal aid guidance"], outputMode: "limited-guidance-kit", riskMessage: "Property possession issues can be sensitive. Use preparation guidance and seek legal review." },
  { caseType: "Cheque Bounce / Payment Recovery", caseTypeHi: "चेक बाउंस / भुगतान वसूली", caseTypeHinglish: "Cheque Bounce / Payment Recovery", proofs: ["Cheque image", "Bank return memo", "Payment agreement", "Demand messages", ...commonProofs], relief: ["Payment recovery guidance", "Draft demand facts", "Legal aid/lawyer review"], outputMode: "limited-guidance-kit", riskMessage: "Deadlines and legal sections need lawyer/legal-aid verification." },
  { caseType: "Online Shopping Fraud", caseTypeHi: "ऑनलाइन शॉपिंग धोखाधड़ी", caseTypeHinglish: "Online Shopping Fraud", proofs: ["Order receipt", "Payment proof", "Product photos", "Delivery proof", "Seller chat/email", ...commonProofs], relief: ["Refund", "Replacement", "Platform complaint", "Consumer grievance guidance"], outputMode: "full-preparation-kit", riskMessage: "Prepare consumer-style complaint material with order and payment proof." },
  { caseType: "Harassment / Threat Complaint", caseTypeHi: "उत्पीड़न / धमकी शिकायत", caseTypeHinglish: "Harassment / Threat Complaint", proofs: ["Threat messages", "Call logs", "Witness details", "Screenshots", ...commonProofs], relief: ["Police complaint guidance", "Safety planning", "Legal aid guidance"], outputMode: "limited-guidance-kit", riskMessage: "If immediate danger exists, contact emergency services and legal aid/lawyer support." },
  { caseType: "Lost Documents / Police Complaint", caseTypeHi: "खोए दस्तावेज / पुलिस शिकायत", caseTypeHinglish: "Lost Documents / Police Complaint", proofs: ["ID proof copy", "Document number", "Loss location details", "Date/time details", ...commonProofs], relief: ["Police complaint draft", "Document replacement guidance", "Acknowledgement guidance"], outputMode: "full-preparation-kit", riskMessage: "Prepare a lost document complaint with date, place, and document details." },
  { caseType: "RTI / Government Service Delay", caseTypeHi: "RTI / सरकारी सेवा में देरी", caseTypeHinglish: "RTI / Government Service Delay", proofs: ["Application receipt", "Department details", "Reference number", "Previous reminders", ...commonProofs], relief: ["RTI preparation", "Grievance draft", "Status request", "Legal aid guidance"], outputMode: "full-preparation-kit", riskMessage: "Organize application numbers, dates, and department details." },
  { caseType: "Domestic Violence / Family Safety Concern", caseTypeHi: "घरेलू हिंसा / पारिवारिक सुरक्षा चिंता", caseTypeHinglish: "Domestic Violence / Family Safety Concern", proofs: ["Medical record", "Threat messages", "Photos", "Witness details", ...commonProofs], relief: ["Urgent legal aid", "Safety support", "Document organization"], outputMode: "urgent-legal-aid-route", riskMessage: "Urgent legal-aid/lawyer and safety support is recommended. NyayMitra should only organize facts and documents." },
  { caseType: "Property / Land Dispute", caseTypeHi: "संपत्ति / जमीन विवाद", caseTypeHinglish: "Property / Land Dispute", proofs: ["Property papers", "Mutation/tax records", "Photos", "Notices", ...commonProofs], relief: ["Legal aid/lawyer review", "Document organization", "Question list"], outputMode: "urgent-legal-aid-route", riskMessage: "Property disputes require legal-aid/lawyer review before action." },
  { caseType: "Divorce / Custody / Family Matter", caseTypeHi: "तलाक / कस्टडी / पारिवारिक मामला", caseTypeHinglish: "Divorce / Custody / Family Matter", proofs: ["Marriage/family documents", "Child-related documents", "Messages", "Financial records", ...commonProofs], relief: ["Legal aid/lawyer review", "Document organization", "Question list"], outputMode: "urgent-legal-aid-route", riskMessage: "Family/custody issues require legal-aid/lawyer review." },
  { caseType: "Bail / Arrest / Criminal Defence", caseTypeHi: "जमानत / गिरफ्तारी / आपराधिक बचाव", caseTypeHinglish: "Bail / Arrest / Criminal Defence", proofs: ["Case papers", "Arrest details", "Court/police documents", "ID proof", ...commonProofs], relief: ["Urgent legal aid", "Document organization", "Questions for lawyer"], outputMode: "urgent-legal-aid-route", riskMessage: "No defence strategy is provided. Urgent legal-aid/lawyer review is required." },
  { caseType: "Accident / Insurance Claim", caseTypeHi: "दुर्घटना / बीमा दावा", caseTypeHinglish: "Accident / Insurance Claim", proofs: ["Insurance policy", "Accident photos", "Medical bills", "Police/claim documents", ...commonProofs], relief: ["Insurance claim guidance", "Document checklist", "Legal aid guidance"], outputMode: "full-preparation-kit", riskMessage: "Prepare insurance claim material and verify serious injury or disputed claims with legal aid/lawyer." },
  { caseType: "Education / College Fee Dispute", caseTypeHi: "शिक्षा / कॉलेज फीस विवाद", caseTypeHinglish: "Education / College Fee Dispute", proofs: ["Fee receipts", "Admission documents", "College emails", "Policy/rules", ...commonProofs], relief: ["Refund request", "Institution complaint", "Legal aid guidance"], outputMode: "full-preparation-kit", riskMessage: "Organize fee receipts, rules, and communication history." },
  { caseType: "Employment Termination", caseTypeHi: "रोजगार समाप्ति", caseTypeHinglish: "Employment Termination", proofs: ["Offer letter", "Termination message", "Salary slips", "HR emails", ...commonProofs], relief: ["Dues request", "Experience letter", "Legal aid guidance"], outputMode: "limited-guidance-kit", riskMessage: "Employment disputes may need legal-aid/lawyer review depending on contract and facts." },
  { caseType: "Medical Negligence Concern", caseTypeHi: "चिकित्सा लापरवाही चिंता", caseTypeHinglish: "Medical Negligence Concern", proofs: ["Medical records", "Bills", "Prescription", "Hospital communication", ...commonProofs], relief: ["Record organization", "Expert/legal review questions", "Complaint guidance"], outputMode: "limited-guidance-kit", riskMessage: "Medical negligence needs expert and legal review before filing." },
  { caseType: "Loan / Debt Recovery Issue", caseTypeHi: "ऋण / कर्ज वसूली मुद्दा", caseTypeHinglish: "Loan / Debt Recovery Issue", proofs: ["Loan agreement", "Payment records", "Demand notices", "Messages / emails", ...commonProofs], relief: ["Payment plan guidance", "Harassment record", "Legal aid/lawyer review"], outputMode: "limited-guidance-kit", riskMessage: "Debt recovery issues need careful review of documents and communications." },
  { caseType: "Defamation / Online Abuse", caseTypeHi: "मानहानि / ऑनलाइन दुर्व्यवहार", caseTypeHinglish: "Defamation / Online Abuse", proofs: ["Screenshots", "Profile/link details", "Messages", "Witness details", ...commonProofs], relief: ["Evidence preservation", "Platform report", "Legal aid/lawyer review"], outputMode: "limited-guidance-kit", riskMessage: "Defamation and online abuse require careful verification before action." },
  { caseType: "Neighbour Dispute", caseTypeHi: "पड़ोसी विवाद", caseTypeHinglish: "Neighbour Dispute", proofs: ["Photos / videos", "Messages", "Witness details", "Police/authority acknowledgement", ...commonProofs], relief: ["Mediation preparation", "Complaint guidance", "Legal aid guidance"], outputMode: "limited-guidance-kit", riskMessage: "Avoid escalation and seek legal aid/lawyer review if threats or violence exist." },
  { caseType: "Police Complaint / General Complaint", caseTypeHi: "पुलिस शिकायत / सामान्य शिकायत", caseTypeHinglish: "Police Complaint / General Complaint", proofs: ["Written complaint", "Acknowledgement", "Messages", "Photos / videos", ...commonProofs], relief: ["Complaint preparation", "Authority visit preparation", "Legal aid guidance"], outputMode: "limited-guidance-kit", riskMessage: "Prepare facts and proof. Verify legal steps with legal aid/lawyer." },
  { caseType: "Business / Contract Dispute", caseTypeHi: "व्यवसाय / अनुबंध विवाद", caseTypeHinglish: "Business / Contract Dispute", proofs: ["Contract", "Invoices", "Payment records", "Emails/messages", ...commonProofs], relief: ["Draft representation", "Negotiation questions", "Legal aid/lawyer review"], outputMode: "limited-guidance-kit", riskMessage: "Contract terms and deadlines should be reviewed by legal aid/lawyer." },
  { caseType: "Startup / Freelancer Contract Issue", caseTypeHi: "स्टार्टअप / फ्रीलांसर अनुबंध मुद्दा", caseTypeHinglish: "Startup / Freelancer Contract Issue", proofs: ["Contract / scope of work", "Invoices", "Delivery proof", "Client messages", ...commonProofs], relief: ["Payment request", "Contract review questions", "Legal aid/lawyer review"], outputMode: "limited-guidance-kit", riskMessage: "Use preparation guidance and verify contract rights with legal aid/lawyer." },
  { caseType: "Government Document / Certificate Issue", caseTypeHi: "सरकारी दस्तावेज / प्रमाणपत्र मुद्दा", caseTypeHinglish: "Government Document / Certificate Issue", proofs: ["Application receipt", "Reference number", "Department messages", "ID proof", ...commonProofs], relief: ["Status request", "Grievance/application draft", "Authority visit preparation"], outputMode: "full-preparation-kit", riskMessage: "Organize application details and authority communication." },
  { caseType: "Other / Not Sure", caseTypeHi: "अन्य / निश्चित नहीं", caseTypeHinglish: "Other / Not Sure", proofs: otherProofs, relief: otherRelief, outputMode: "limited-guidance-kit", riskMessage: "Use limited preparation guidance until the matter is classified or reviewed by legal aid/lawyer." },
];

export function getCaseConfig(caseType: string) {
  return caseConfigs.find((config) => config.caseType === caseType) || caseConfigs[0];
}

function getOutputMode(caseType: string): OutputMode {
  return getCaseConfig(caseType).outputMode;
}

export function hasUrgentSafetySignal(text: string) {
  const lower = text.toLowerCase();
  return urgentSafetyKeywords.some((keyword) => lower.includes(keyword));
}

export function resolveOutputMode(caseType: string, story = "", suggestedCaseType?: string, suggestedMode?: OutputMode): OutputMode {
  if (highRiskCaseTypes.includes(caseType) || (suggestedCaseType && highRiskCaseTypes.includes(suggestedCaseType)) || hasUrgentSafetySignal(story)) return "urgent-legal-aid-route";
  return suggestedMode || getOutputMode(caseType);
}

export function outputModeLabel(mode: string) {
  if (mode === "full-preparation-kit") return "Full Preparation Kit";
  if (mode === "limited-guidance-kit") return "Limited Guidance Kit";
  return "Urgent Legal Aid Review";
}

export function getOutputModeForCase(data: { caseType: string; story: string; outputMode?: string; aiAnalysis?: { classification?: { caseType?: string; outputMode?: OutputMode } } }): OutputMode {
  return data.outputMode as OutputMode || resolveOutputMode(data.caseType, data.story, data.aiAnalysis?.classification?.caseType, data.aiAnalysis?.classification?.outputMode);
}
