"use client";

import type { Language } from "@/lib/i18n";

export function LanguageSwitcher({ language, onChange }: { language: Language; onChange: (language: Language) => void }) {
  const options: { label: string; value: Language }[] = [
    { label: "English", value: "en" },
    { label: "हिंदी", value: "hi" },
    { label: "Hinglish", value: "hinglish" },
  ];

  return (
    <div className="flex flex-wrap gap-2" aria-label="Language switcher">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-label={`Switch language to ${option.label}`}
          onClick={() => onChange(option.value)}
          className={`rounded-full px-4 py-2 text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-teal-200 ${language === option.value ? "bg-teal-400 text-slate-950" : "bg-white/10 text-white hover:bg-white/20"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
