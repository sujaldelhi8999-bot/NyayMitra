"use client";

import type { Language } from "@/lib/i18n";

const options: { label: string; value: Language }[] = [
  { label: "English", value: "en" },
  { label: "हिंदी", value: "hi" },
  { label: "Hinglish", value: "hinglish" },
];

export function LanguageSwitcher({ language, onChange }: { language: Language; onChange: (language: Language) => void }) {
  return (
    <select
      aria-label="Select language"
      value={language}
      onChange={(e) => onChange(e.target.value as Language)}
      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-teal-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-200"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
