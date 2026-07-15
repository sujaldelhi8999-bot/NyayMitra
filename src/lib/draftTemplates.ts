import type { CaseData } from "@/types/case";
import { resolveOutputMode } from "./caseConfig";
import { OTHER_PROOF_OPTION, OTHER_RELIEF_OPTION } from "./constants";

function buildProofList(data: CaseData) {
  const standardProofs = data.proofs.filter((proof) => proof !== OTHER_PROOF_OPTION);
  const proofList = standardProofs.length
    ? standardProofs.map((proof, index) => `${index + 1}. ${proof}`).join("\n")
    : "1. Evidence to be added";
  const customProofList = data.customProofs?.length
    ? `\n\nCustom proofs:\n${data.customProofs.map((proof, index) => `${index + 1}. ${proof}`).join("\n")}`
    : "";
  return { proofList, customProofList };
}

function buildReliefList(data: CaseData) {
  const combinedReliefs = [...data.relief.filter((item) => item !== OTHER_RELIEF_OPTION), ...(data.customReliefs || [])];
  return combinedReliefs.length
    ? combinedReliefs.map((relief, index) => `${index + 1}. ${relief}`).join("\n")
    : "1. Relief to be confirmed";
}

function buildAnnexures(data: CaseData) {
  return data.uploadedFiles.length
    ? data.uploadedFiles.map((file, index) => `A${index + 1} - ${file.fileName} - ${file.evidenceCategory}`).join("\n")
    : "No uploaded annexures added yet.";
}

function buildFollowUps(data: CaseData) {
  const entries = Object.entries(data.followUpAnswers || {})
    .filter(([, answer]) => answer.trim())
    .map(([question, answer]) => `- ${question}\n  ${answer}`);
  return entries.length ? entries.join("\n") : "";
}

function buildUrgentAidDraft(data: CaseData, today: string) {
  const { proofList, customProofList } = buildProofList(data);
  const annexures = buildAnnexures(data);

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

function buildLimitedGuidanceDraft(data: CaseData, today: string) {
  const { proofList, customProofList } = buildProofList(data);
  const reliefList = buildReliefList(data);
  const annexures = buildAnnexures(data);

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

function buildFullComplaintDraft(data: CaseData, today: string) {
  const { proofList, customProofList } = buildProofList(data);
  const reliefList = buildReliefList(data);
  const annexures = buildAnnexures(data);
  const followUps = buildFollowUps(data);

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

export function generateComplaintDraft(data: CaseData) {
  const today = new Date().toISOString().split("T")[0];
  const outputMode = resolveOutputMode(data.caseType, data.story, data.aiAnalysis?.classification?.caseType, data.aiAnalysis?.classification?.outputMode);

  if (outputMode === "urgent-legal-aid-route") {
    return buildUrgentAidDraft(data, today);
  }

  if (outputMode === "limited-guidance-kit") {
    return buildLimitedGuidanceDraft(data, today);
  }

  return buildFullComplaintDraft(data, today);
}
