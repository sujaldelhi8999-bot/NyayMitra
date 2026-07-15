import { NextResponse } from "next/server";
import { buildKnowledgeContext } from "@/lib/legalKnowledge";
import { buildOfficialActionSuggestions } from "@/lib/officialPortals";
import { HTTP_STATUS, TIMEOUT } from "@/lib/constants";

const modes = ["classify", "extract", "followup", "draft", "review", "advisor"] as const;
type Mode = (typeof modes)[number];

const systemPrompt = `You are NyayMitra, an AI Legal Guidance Assistant and AI Legal Self-Help Advisor for India.
You are not a lawyer.
You must not provide legal advice.
You must not guarantee success.
You must not invent legal sections or citations.
If legal sections or procedure details are needed but not provided in verified database, say: "This point needs verification from legal aid/lawyer or official sources."
You help users organize facts, evidence, timelines, missing proof, draft text, and questions for legal-aid/lawyer review.
For high-stakes matters including bail, arrest, criminal defence, custody, divorce, domestic violence, property/land disputes, serious violence, or immediate danger, produce only a safety-focused legal-aid consultation note and recommend urgent legal-aid/lawyer support.
Never encourage hiding facts, destroying evidence, creating fake evidence, threatening anyone, or bypassing legal process.
Return only valid JSON.`;

const schemas: Record<Mode, string> = {
  classify: `Return JSON: {"caseType": string, "confidence": number, "outputMode": "full-preparation-kit" | "limited-guidance-kit" | "urgent-legal-aid-route", "riskLevel": "Low Risk" | "Medium Risk" | "High Risk", "riskReason": string, "shortSummary": string, "suggestedProofs": string[], "suggestedReliefs": string[], "missingDetails": string[], "nextSteps": string[], "lawyerReviewRecommended": boolean}`,
  extract: `Return JSON: {"caseSummary": string, "timeline": [{"date": string, "event": string}], "parties": string[], "evidenceMentioned": string[], "missingDetails": string[]}`,
  followup: `Return JSON: {"questions": string[]}`,
  draft: `Return JSON: {"title": string, "draftType": string, "draftText": string, "safetyNote": string, "verifiedSourcesUsed": [{"title": string, "sourceName": string, "sourceUrl": string}]}`,
  review: `Return JSON: {"qualityScore": number, "strengths": string[], "weaknesses": string[], "missingProof": string[], "suggestions": string[], "verifiedSourcesUsed": [{"title": string, "sourceName": string, "sourceUrl": string}]}`,
  advisor: `Return JSON: {"answerType": "general-guidance" | "evidence-guidance" | "next-steps" | "risk-warning" | "legal-aid-route" | "case-classification", "answer": string, "probableCaseType": string, "nextSteps": string[], "missingInfo": string[], "riskNote": string, "lawyerReviewRecommended": boolean, "verifiedSourcesUsed": [{"title": string, "sourceName": string, "sourceUrl": string}]}`,
};

function developmentDebug(debug: unknown) {
  return process.env.NODE_ENV === "development" ? debug : undefined;
}

function validateRequest(body: Record<string, unknown>) {
  const mode = body?.mode as Mode;
  const caseData = body?.caseData as Record<string, unknown> | undefined;
  const question = body?.question as string | undefined;

  if (!modes.includes(mode)) {
    return { error: NextResponse.json({ success: false, error: "Invalid AI mode." }, { status: HTTP_STATUS.BAD_REQUEST }) };
  }

  if (!caseData) {
    return { error: NextResponse.json({ success: false, error: "caseData is required." }, { status: HTTP_STATUS.BAD_REQUEST }) };
  }

  if (mode === "advisor" && typeof question !== "string") {
    return { error: NextResponse.json({ success: false, error: "question is required." }, { status: HTTP_STATUS.BAD_REQUEST }) };
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return { error: NextResponse.json({ success: false, error: "AI is not configured. Add OPENROUTER_API_KEY in .env.local and restart the dev server." }, { status: HTTP_STATUS.SERVICE_UNAVAILABLE }) };
  }

  return { mode, caseData, question };
}

function buildSafetyContext(caseData: Record<string, unknown>) {
  return caseData?.caseType === "Property / Land Dispute"
    ? "Property / Land Dispute is high-risk. Do not provide legal advice. Do not draft a final complaint. Produce document organization and legal-aid/lawyer consultation guidance only. Ask about property location, title papers, revenue records, court case details, notices, and urgent sale/possession issues."
    : "";
}

function handleApiError(responseText: string, status: number, context: string) {
  return NextResponse.json({
    success: false,
    error: context,
    debug: developmentDebug({ status, message: responseText.slice(0, 500) }),
  }, { status: HTTP_STATUS.BAD_GATEWAY });
}

function handleParseError(raw: string, context: string) {
  return NextResponse.json({
    success: false,
    error: context,
    debug: developmentDebug({ rawPreview: raw.slice(0, 500) }),
  }, { status: HTTP_STATUS.BAD_GATEWAY });
}

function sanitizeAiJson(content: string): string {
  let cleaned = content;
  cleaned = cleaned.replace(/<\|start\|>|<\|end\|>|<\|constrain\|>(?:json)?|<\|const\w*/g, "");
  cleaned = cleaned.replace(/```json\s*/gi, "").replace(/```\s*/g, "");
  cleaned = cleaned.replace(/^\s*[\s\S]*?(\{)/, "$1");
  const lastBrace = cleaned.lastIndexOf("}");
  if (lastBrace !== -1) cleaned = cleaned.slice(0, lastBrace + 1);
  cleaned = cleaned.trim();
  cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");
  return cleaned;
}

const RETRYABLE_STATUSES = new Set([429, 502, 503]);

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  let lastError: Response | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const retryAfter = lastError?.headers?.get("Retry-After");
      const delayMs = retryAfter ? Math.min(Number(retryAfter) * 1000, 10000) : Math.pow(2, attempt - 1) * 1000;
      await new Promise((r) => setTimeout(r, delayMs));
    }
    try {
      const response = await fetch(url, options);
      if (!RETRYABLE_STATUSES.has(response.status) || attempt === maxRetries) return response;
      lastError = response;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw e;
      if (attempt === maxRetries) throw e;
      lastError = null;
    }
  }
  return lastError!;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const validated = validateRequest(body);
    if ("error" in validated) return validated.error;

    const { mode, caseData, question } = validated;
    const verifiedKnowledgeContext = buildKnowledgeContext(caseData);
    const officialPortalContext = buildOfficialActionSuggestions(caseData);
    const propertySafetyContext = buildSafetyContext(caseData);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT.AI_REQUEST);
    let openRouterResponse: Response;
    try {
      openRouterResponse = await fetchWithRetry("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "NyayMitra",
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-001",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `${schemas[mode]}\n\nYou may only refer to legal/procedure information from this verifiedKnowledgeContext. For portal/website/reporting-route questions, use only officialPortalContext and do not invent websites. If something is not present, say human/legal-aid verification is required. If no verified source applies, return verifiedSourcesUsed: []. FIR/e-FIR availability depends on State/UT and case type. NyayMitra can suggest official portals, but final acceptance depends on the concerned authority. Treat customProofs as user-provided documents only; do not assume they are valid or legally sufficient. Say: "These documents should be reviewed by legal aid/lawyer before relying on them." CustomReliefs are user-requested outcomes and should be framed as possible outcomes for review, not guarantees. ${propertySafetyContext}\n\nverifiedKnowledgeContext:\n${JSON.stringify(verifiedKnowledgeContext)}\n\nofficialPortalContext:\n${JSON.stringify(officialPortalContext)}\n\nMode: ${mode}\nQuestion: ${question || ""}\nCase data:\n${JSON.stringify(caseData)}` },
          ],
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timeout);
      if (e instanceof DOMException && e.name === "AbortError") {
        return handleParseError("", "AI request timed out. Please try again.");
      }
      throw e;
    }
    clearTimeout(timeout);

    const responseText = await openRouterResponse.text();

    if (!openRouterResponse.ok) {
      const status = openRouterResponse.status;
      const errorMessages: Record<number, string> = {
        402: "AI credit limit reached. Add credits at openrouter.ai/keys.",
        429: "Too many AI requests. Please wait and try again.",
        502: "AI model is temporarily unavailable. Try again in a moment.",
        503: "AI service is temporarily unavailable. Try again in a moment.",
      };
      return handleApiError(responseText, status, errorMessages[status] || "OpenRouter request failed");
    }

    let openRouterJson;
    try {
      openRouterJson = JSON.parse(responseText);
    } catch {
      return handleParseError(responseText, "OpenRouter returned invalid response JSON");
    }

    const content = openRouterJson?.choices?.[0]?.message?.content;

    if (!content) {
      return handleParseError(JSON.stringify(openRouterJson), "AI response did not contain message content.");
    }

    try {
      return NextResponse.json({ success: true, data: JSON.parse(sanitizeAiJson(content)) });
    } catch {
      return handleParseError(content, "AI returned invalid JSON. Rule-based mode is still available.");
    }
  } catch {
    return NextResponse.json({ success: false, error: "AI could not respond right now." }, { status: HTTP_STATUS.INTERNAL_ERROR });
  }
}
