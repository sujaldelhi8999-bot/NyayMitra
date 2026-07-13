import type { Language } from "@/lib/i18n";
import { translate } from "@/lib/i18n";

export type CaseStatus = "intake-started" | "draft-ready" | "review-needed" | "filed" | "closed";

export const DEFAULT_CASE_STATUS: CaseStatus = "draft-ready";

export const caseStatuses: CaseStatus[] = [
  "intake-started",
  "draft-ready",
  "review-needed",
  "filed",
  "closed",
];

const caseStatusLabelKeys: Record<CaseStatus, keyof typeof import("@/lib/i18n").translations.en> = {
  "intake-started": "statusIntakeStarted",
  "draft-ready": "statusDraftReady",
  "review-needed": "statusReviewNeeded",
  filed: "statusFiled",
  closed: "statusClosed",
};

export function caseStatusLabel(status: CaseStatus, language: Language) {
  return translate(language, caseStatusLabelKeys[status]);
}

const legacyStatusValues: Record<string, CaseStatus> = {
  "Complaint Started": "intake-started",
  "Draft Ready": "draft-ready",
  "Review Needed": "review-needed",
  Filed: "filed",
  Closed: "closed",
  "शिकायत शुरू": "intake-started",
  "ड्राफ्ट तैयार": "draft-ready",
  "समीक्षा आवश्यक": "review-needed",
  "दायर": "filed",
  "बंद": "closed",
};

export function normalizeCaseStatus(status?: string): CaseStatus {
  if (!status) return DEFAULT_CASE_STATUS;
  if (caseStatuses.includes(status as CaseStatus)) return status as CaseStatus;
  return legacyStatusValues[status] || DEFAULT_CASE_STATUS;
}
