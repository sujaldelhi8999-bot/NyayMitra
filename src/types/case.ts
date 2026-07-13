import type { OutputMode } from "@/lib/caseConfig";

export type VerifiedSource = {
  title: string;
  sourceName: string;
  sourceUrl: string;
  lastChecked?: string;
};

export type AdvisorChat = {
  id: string;
  question: string;
  answer: string;
  nextSteps: string[];
  missingInfo: string[];
  riskNote: string;
  lawyerReviewRecommended: boolean;
  createdAt: string;
  verifiedSourcesUsed?: VerifiedSource[];
};

export type AiClassification = {
  caseType: string;
  confidence: number;
  outputMode: OutputMode;
  riskLevel: "Low Risk" | "Medium Risk" | "High Risk";
  riskReason: string;
  shortSummary: string;
  suggestedProofs: string[];
  suggestedReliefs: string[];
  missingDetails: string[];
  nextSteps: string[];
  lawyerReviewRecommended: boolean;
};

export type AiExtraction = {
  caseSummary: string;
  timeline: { date: string; event: string }[];
  parties: string[];
  evidenceMentioned: string[];
  missingDetails: string[];
};

export type AiReview = {
  qualityScore: number;
  strengths: string[];
  weaknesses: string[];
  missingProof: string[];
  suggestions: string[];
  verifiedSourcesUsed?: VerifiedSource[];
};

export type UploadedFile = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  evidenceCategory: string;
  uploadedAt: string;
};

export type CaseData = {
  fullName: string;
  contact: string;
  caseType: string;
  stateOrUT?: string;
  story: string;
  incidentDate: string;
  amountLost: string;
  oppositeParty: string;
  proofs: string[];
  relief: string[];
  customProofs?: string[];
  customReliefs?: string[];
  followUpAnswers?: Record<string, string>;
  uploadedFiles: UploadedFile[];
  complaintDraft?: string;
  caseId?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
  language?: "en" | "hi" | "hinglish";
  outputMode?: string;
  aiAnalysis?: {
    classification?: AiClassification;
    extraction?: AiExtraction;
    followupQuestions?: string[];
    review?: AiReview;
    generatedDraft?: string;
    lastAnalyzedAt?: string;
  };
  advisorChats?: AdvisorChat[];
};