type AiMode = "classify" | "extract" | "followup" | "draft" | "review" | "advisor";
export type AiClientError = { error: string; debug?: unknown };

async function callAi(mode: AiMode, caseData: unknown, question?: string) {
  try {
    const response = await fetch("/api/ai/case-assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, caseData, question }),
    });
    if (!response.ok) {
      let detail: string | undefined;
      try {
        const errBody = await response.json();
        detail = errBody?.error;
      } catch {}
      return { error: detail || `AI request failed (HTTP ${response.status}).` };
    }
    const result = await response.json();
    return result?.success ? result.data : { error: result?.error || "AI request failed.", debug: result?.debug };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "AI request failed." };
  }
}

export function aiClassifyCase(caseData: unknown) { return callAi("classify", caseData); }
export function aiExtractFacts(caseData: unknown) { return callAi("extract", caseData); }
export function aiGenerateFollowups(caseData: unknown) { return callAi("followup", caseData); }
export function aiGenerateDraft(caseData: unknown) { return callAi("draft", caseData); }
export function aiReviewCase(caseData: unknown) { return callAi("review", caseData); }
export function aiAskAdvisor(caseData: unknown, question: string) { return callAi("advisor", caseData, question); }
