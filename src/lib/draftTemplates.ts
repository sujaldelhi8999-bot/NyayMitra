import type { CaseData } from "@/types/case";
import type { Language } from "@/lib/i18n";
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

function buildProofListHi(data: CaseData) {
  const standardProofs = data.proofs.filter((proof) => proof !== OTHER_PROOF_OPTION);
  const proofList = standardProofs.length
    ? standardProofs.map((proof, index) => `${index + 1}. ${proof}`).join("\n")
    : "1. सबूत जोड़े जाने हैं";
  const customProofList = data.customProofs?.length
    ? `\n\nकस्टम सबूत:\n${data.customProofs.map((proof, index) => `${index + 1}. ${proof}`).join("\n")}`
    : "";
  return { proofList, customProofList };
}

function buildReliefListHi(data: CaseData) {
  const combinedReliefs = [...data.relief.filter((item) => item !== OTHER_RELIEF_OPTION), ...(data.customReliefs || [])];
  return combinedReliefs.length
    ? combinedReliefs.map((relief, index) => `${index + 1}. ${relief}`).join("\n")
    : "1. राहत की पुष्टि की जानी है";
}

function buildAnnexuresHi(data: CaseData) {
  return data.uploadedFiles.length
    ? data.uploadedFiles.map((file, index) => `A${index + 1} - ${file.fileName} - ${file.evidenceCategory}`).join("\n")
    : "अभी तक कोई अपलोड किया गया एनेक्सचर नहीं जोड़ा गया।";
}

function buildFollowUpsHi(data: CaseData) {
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

function buildUrgentAidDraftHi(data: CaseData, today: string) {
  const { proofList, customProofList } = buildProofListHi(data);
  const annexures = buildAnnexuresHi(data);

  return `कानूनी सहायता परामर्श नोट

यह कोई अंतिम शिकायत या बचाव रणनीति नहीं है। इस मामले की तत्काल कानूनी सहायता या लाइसेंस प्राप्त अधिवक्ता द्वारा समीक्षा की जानी चाहिए।

नाम: ${data.fullName}
संपर्क: ${data.contact}
केस प्रकार: ${data.caseType}
घटना की तिथि: ${data.incidentDate}

संक्षिप्त तथ्य:
${data.story}

समयरेखा:
- घटना/तिथि ज्ञात: ${data.incidentDate || "प्रदान नहीं किया गया"}
- विपक्षी पक्ष/व्यक्ति/प्राधिकरण: ${data.oppositeParty || "प्रदान नहीं किया गया"}
- बताई गई राशि/मूल्य: ₹${data.amountLost || "0"}

सुरक्षा चिंता:
यह केस प्रकार या साझा किए गए तथ्यों के आधार पर तत्काल/उच्च जोखिम के रूप में रूट किया गया है। यदि तत्काल खतरा है, तो पहले आपातकालीन सेवाओं से संपर्क करें।

व्यवस्थित करने के लिए दस्तावेज/सबूत:
मानक सबूत:
${proofList}${customProofList}

कस्टम दस्तावेज सुरक्षा नोट:
कस्टम दस्तावेज उपयोगकर्ता द्वारा प्रदान किए गए हैं और फाइल करने या उन पर भरोसा करने से पहले उन्हें सत्यापित किया जाना चाहिए।

अपलोड किए गए एनेक्सचर:
${annexures}

कानूनी सहायता/वकील के लिए प्रश्न:
1. सत्यापित दस्तावेजों के आधार पर कौन से तत्काल सुरक्षा, न्यायालय या प्रक्रियात्मक कदम उपलब्ध हैं?
2. समीक्षा के लिए कौन से दस्तावेज ले जाने चाहिए?
3. तत्काल कौन सी समय सीमा या जोखिमों की जाँच की जानी चाहिए?

तत्काल अगले कदम:
1. जल्द से जल्द कानूनी सहायता/वकील से संपर्क करें।
2. मूल दस्तावेज, संदेश, फोटो और पावती सुरक्षित रखें।
3. यदि तत्काल खतरा है, तो 112 पर कॉल करें या स्थानीय आपातकालीन सेवाओं से संपर्क करें।

सुरक्षा नोट:
वकील/कानूनी सहायता समीक्षा आवश्यक है। न्यायमित्र दस्तावेज व्यवस्थित करने में मदद कर सकता है लेकिन कानूनी सलाह, बचाव रणनीति या किसी परिणाम की गारंटी नहीं देता।

तिथि: ${today}`;
}

function buildLimitedGuidanceDraftHi(data: CaseData, today: string) {
  const { proofList, customProofList } = buildProofListHi(data);
  const reliefList = buildReliefListHi(data);
  const annexures = buildAnnexuresHi(data);

  return `समीक्षा हेतु मसौदा प्रतिनिधित्व

यह कानूनी सहायता/वकील या प्राधिकरण समीक्षा के लिए एक तैयारी मसौदा है। यह कानूनी सलाह नहीं है और किसी परिणाम की गारंटी नहीं देता।

उपयोगकर्ता विवरण:
नाम: ${data.fullName}
संपर्क: ${data.contact}
केस प्रकार: ${data.caseType}

तथ्य सारांश:
${data.story}

समयरेखा:
- घटना की तिथि: ${data.incidentDate}
- विपक्षी पक्ष: ${data.oppositeParty || "प्रदान नहीं किया गया"}
- बताई गई राशि/मूल्य: ₹${data.amountLost || "0"}

सबूत सूची:
मानक सबूत:
${proofList}${customProofList}

कस्टम दस्तावेज सुरक्षा नोट:
कस्टम दस्तावेज उपयोगकर्ता द्वारा प्रदान किए गए हैं और फाइल करने या उन पर भरोसा करने से पहले उन्हें सत्यापित किया जाना चाहिए।

अपलोड किए गए एनेक्सचर:
${annexures}

अनुरोधित राहत/परिणाम:
${reliefList}

कानूनी सहायता/वकील के लिए प्रश्न:
1. दस्तावेजों के आधार पर कौन सा प्राधिकरण या मंच उपयुक्त है?
2. कौन सी समय सीमा, सूचना या सीमा-काल का मुद्दा जाँचा जाना चाहिए?
3. किसी भी फाइलिंग या प्रतिनिधित्व से पहले कौन सा सबूत गायब है?
4. जोखिम बढ़ाए बिना कौन सा सुरक्षित अगला कदम उठाया जाना चाहिए?

समीक्षा चेतावनी:
कृपया इस मसौदे को उपयोग करने से पहले कानूनी सहायता/वकील या आधिकारिक स्रोतों से सत्यापित करें।

तिथि: ${today}`;
}

function buildFullComplaintDraftHi(data: CaseData, today: string) {
  const { proofList, customProofList } = buildProofListHi(data);
  const reliefList = buildReliefListHi(data);
  const annexures = buildAnnexuresHi(data);
  const followUps = buildFollowUpsHi(data);

  return `सेवा में,
संबंधित प्राधिकरण

विषय:
${data.caseType} संबंधी शिकायत/आवेदन

महोदय/महोदया,

मैं, ${data.fullName}, ${data.caseType} संबंधी यह शिकायत/आवेदन प्रस्तुत करना चाहता/चाहती हूँ।

दिनांक ${data.incidentDate} को मुझसे ${data.oppositeParty || "विपक्षी पक्ष / संदिग्ध व्यक्ति"} ने संपर्क किया। मेरे कथन के अनुसार, घटना निम्नानुसार घटित हुई:

${data.story}

उपरोक्त घटना से संबंधित ₹${data.amountLost} की राशि का नुकसान/हस्तांतरण हुआ।

उपलब्ध सबूत:
मानक सबूत:
${proofList}${customProofList}

कस्टम दस्तावेज सुरक्षा नोट:
कस्टम दस्तावेज उपयोगकर्ता द्वारा प्रदान किए गए हैं और फाइल करने या उन पर भरोसा करने से पहले उन्हें सत्यापित किया जाना चाहिए।

अपलोड किए गए एनेक्सचर:
${annexures}

फॉलो-अप के दौरान दिए गए अतिरिक्त विवरण:
${followUps || "कोई अतिरिक्त फॉलो-अप उत्तर प्रदान नहीं किए गए।"}

मैं संबंधित प्राधिकरण से विनम्र अनुरोध करता/करती हूँ कि कृपया मेरी शिकायत दर्ज करें, लेनदेन विवरण की जाँच करें, कानून के अनुसाण उचित कार्रवाई करें और मुझे आगे के कदमों के बारे में मार्गदर्शन दें।

अनुरोधित राहत:
${reliefList}

मैं समझता/समझती हूँ कि यह केस संगठन के लिए तैयार किया गया मसौदा शिकायत है और इसे फाइल करने से पहले कानूनी सहायता/वकील या संबंधित प्राधिकरण से सत्यापित किया जाना चाहिए।

घोषणा:
उपर दी गई जानकारी मेरी जानकारी के अनुसार सत्य है।

नाम: ${data.fullName}
संपर्क: ${data.contact}
तिथि: ${today}`;
}

export function generateComplaintDraft(data: CaseData, language?: Language) {
  const today = new Date().toISOString().split("T")[0];
  const outputMode = resolveOutputMode(data.caseType, data.story, data.aiAnalysis?.classification?.caseType, data.aiAnalysis?.classification?.outputMode);

  if (language === "hi") {
    if (outputMode === "urgent-legal-aid-route") return buildUrgentAidDraftHi(data, today);
    if (outputMode === "limited-guidance-kit") return buildLimitedGuidanceDraftHi(data, today);
    return buildFullComplaintDraftHi(data, today);
  }

  if (outputMode === "urgent-legal-aid-route") return buildUrgentAidDraft(data, today);
  if (outputMode === "limited-guidance-kit") return buildLimitedGuidanceDraft(data, today);
  return buildFullComplaintDraft(data, today);
}
