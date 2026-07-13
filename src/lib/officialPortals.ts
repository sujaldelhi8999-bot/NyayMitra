import { officialPortals, type OfficialPortal } from "@/data/officialPortals";
import { highRiskCaseTypes, hasUrgentSafetySignal } from "@/lib/caseConfig";

type PortalCaseData = { caseType?: string; story?: string; stateOrUT?: string; outputMode?: string; aiAnalysis?: { classification?: { outputMode?: string; riskLevel?: string; lawyerReviewRecommended?: boolean } } };

function matchesCaseType(portal: OfficialPortal, caseType?: string) {
  return portal.caseTypes.includes("all") || Boolean(caseType && portal.caseTypes.includes(caseType));
}

function isDelhi(state?: string) {
  return Boolean(state && /delhi|nct/i.test(state));
}

function getLegalAidPortals() {
  return officialPortals.filter((portal) => portal.category === "Legal Aid");
}

function shouldShowEmergencyWarning(caseData: PortalCaseData) {
  return Boolean(
    caseData.outputMode === "urgent-legal-aid-route" ||
    caseData.aiAnalysis?.classification?.outputMode === "urgent-legal-aid-route" ||
    caseData.aiAnalysis?.classification?.riskLevel === "High Risk" ||
    caseData.aiAnalysis?.classification?.lawyerReviewRecommended ||
    (caseData.caseType && highRiskCaseTypes.includes(caseData.caseType)) ||
    hasUrgentSafetySignal(caseData.story || "")
  );
}

function getOfficialPortalsForCase(caseType?: string, stateOrUTOrOptions?: string | { stateOrUT?: string; includeExamples?: boolean; includeEmergency?: boolean }) {
  const options = typeof stateOrUTOrOptions === "string" ? { stateOrUT: stateOrUTOrOptions } : stateOrUTOrOptions;
  const entries = officialPortals.filter((portal) => {
    if (portal.emergencyOnly && !options?.includeEmergency) return false;
    if (portal.stateSpecific) return isDelhi(options?.stateOrUT) || Boolean(options?.includeExamples && matchesCaseType(portal, caseType));
    return matchesCaseType(portal, caseType);
  });

  return Array.from(new Map([...entries, ...getLegalAidPortals()].map((portal) => [portal.id, portal])).values());
}

export function buildOfficialActionSuggestions(caseData: PortalCaseData) {
  const showEmergency = shouldShowEmergencyWarning(caseData);
  const portals = getOfficialPortalsForCase(caseData.caseType, {
    stateOrUT: caseData.stateOrUT,
    includeEmergency: showEmergency,
    includeExamples: isDelhi(caseData.stateOrUT),
  });
  const stateMessage = caseData.stateOrUT
    ? "FIR/e-FIR availability depends on State/UT, police department, and case type. Final acceptance depends on the concerned authority."
    : "Police e-FIR/online complaint portals vary by State/UT. Please select your State/UT or contact the local police station.";

  return { portals, showEmergency, stateMessage };
}
