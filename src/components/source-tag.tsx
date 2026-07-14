"use client";

export function SourceTag({ source }: { source: "ai" | "rule" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
        source === "ai"
          ? "bg-purple-100 text-purple-800"
          : "bg-teal-100 text-teal-800"
      }`}
      title={source === "ai" ? "AI-generated" : "Rule-based"}
    >
      {source === "ai" ? "AI" : "Rule"}
    </span>
  );
}