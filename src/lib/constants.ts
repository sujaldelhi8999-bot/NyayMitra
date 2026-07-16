export const OTHER_PROOF_OPTION = "Other proof / document";
export const OTHER_RELIEF_OPTION = "Other relief / outcome";

export const storyKeywords = ["whatsapp", "upi", "payment", "paid", "blocked", "message", "scam", "fraud", "transaction", "bank", "job", "refund"];
export const propertyKeywords = ["property", "land", "grandfather", "ancestral", "sale deed", "revenue", "mutation", "tax", "possession", "court", "case", "khasra", "survey", "plot", "family"];
export const consumerKeywords = ["order", "invoice", "refund", "replacement", "damaged", "defective", "delivery", "seller", "platform", "customer support", "product"];
export const rtiKeywords = ["department", "application", "receipt", "acknowledgement", "delay", "certificate", "government", "follow-up", "rti", "service"];

export const HTTP_STATUS = {
  BAD_REQUEST: 400,
  INTERNAL_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

export const TIMEOUT = {
  AI_REQUEST: 30000,
} as const;

export const QUALITY = {
  MIN_STORY_LENGTH: 80,
  MIN_KEYWORDS: 3,
  STORY_SCORE: 20,
  DATE_SCORE: 10,
  AMOUNT_SCORE: 10,
  PARTY_SCORE: 15,
  GARBAGE_PENALTY: -10,
  TWO_PROOFS_SCORE: 10,
  THREE_PROOFS_SCORE: 10,
  TWO_RELIEFS_SCORE: 10,
  PROPERTY_DEED_SCORE: 15,
  PROPERTY_REVENUE_SCORE: 10,
  PROPERTY_POSSESSION_SCORE: 10,
  PROPERTY_COURT_SCORE: 10,
  CONSUMER_INVOICE_SCORE: 15,
  CONSUMER_PHOTO_SCORE: 10,
  CONSUMER_DELIVERY_SCORE: 10,
  CONSUMER_CHAT_SCORE: 10,
  RTI_APPLICATION_SCORE: 15,
  RTI_DEPT_SCORE: 10,
  RTI_FOLLOWUP_SCORE: 10,
  SCAM_UPI_SCORE: 15,
  SCAM_WHATSAPP_SCORE: 10,
  SCAM_BANK_SCORE: 10,
} as const;
