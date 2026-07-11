import { NextResponse } from "next/server";
import { buildKnowledgeContext } from "@/lib/legalKnowledge";
import { buildOfficialActionSuggestions } from "@/lib/officialPortals";

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mode = body?.mode as Mode;
    const caseData = body?.caseData;
    const question = body?.question;

    if (!modes.includes(mode)) {
      return NextResponse.json({ success: false, error: "Invalid AI mode." }, { status: 400 });
    }

    if (!caseData) {
      return NextResponse.json({ success: false, error: "caseData is required." }, { status: 400 });
    }

    if (mode === "advisor" && typeof question !== "string") {
      return NextResponse.json({ success: false, error: "question is required." }, { status: 400 });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ success: false, error: "AI is not configured. Add OPENROUTER_API_KEY in .env.local and restart the dev server." });
    }

    const verifiedKnowledgeContext = buildKnowledgeContext(caseData);
    const officialPortalContext = buildOfficialActionSuggestions(caseData);
    const propertySafetyContext = caseData?.caseType === "Property / Land Dispute"
      ? "Property / Land Dispute is high-risk. Do not provide legal advice. Do not draft a final complaint. Produce document organization and legal-aid/lawyer consultation guidance only. Ask about property location, title papers, revenue records, court case details, notices, and urgent sale/possession issues."
      : "";

    if (process.env.NODE_ENV === "development") {
      console.log("AI route called with mode:", mode);
      console.log("API key exists:", Boolean(process.env.OPENROUTER_API_KEY));
      console.log("Model:", process.env.OPENROUTER_MODEL);
    }

    const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
    });

    const responseText = await openRouterResponse.text();

    if (process.env.NODE_ENV === "development") {
      console.log("OpenRouter status:", openRouterResponse.status);
      console.log("OpenRouter raw response:", responseText.slice(0, 500));
    }

    if (!openRouterResponse.ok) {
      return NextResponse.json({
        success: false,
        error: "OpenRouter request failed",
        debug: developmentDebug({
          status: openRouterResponse.status,
          message: responseText.slice(0, 500),
        }),
      });
    }

    let openRouterJson;
    try {
      openRouterJson = JSON.parse(responseText);
    } catch {
      return NextResponse.json({
        success: false,
        error: "OpenRouter returned invalid response JSON",
        debug: developmentDebug({ rawPreview: responseText.slice(0, 500) }),
      });
    }

    const content = openRouterJson?.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({
        success: false,
        error: "AI response did not contain message content.",
        debug: developmentDebug({ rawPreview: JSON.stringify(openRouterJson).slice(0, 500) }),
      });
    }

    try {
      return NextResponse.json({ success: true, data: JSON.parse(content) });
    } catch {
      return NextResponse.json({
        success: false,
        error: "AI returned invalid JSON. Rule-based mode is still available.",
        debug: developmentDebug({ rawPreview: content.slice(0, 500) }),
      });
    }
  } catch {
    return NextResponse.json({ success: false, error: "AI could not respond right now." });
  }
}
