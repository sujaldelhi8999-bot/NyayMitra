"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useLanguage, type Language, translate } from "@/lib/i18n";
import { trapFocus } from "@/lib/focusTrap";

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  onChangeLanguage: (lang: Language) => void;
}

const navLinks = [
  { href: "/#features", key: "navFeatures" as const },
  { href: "/#how-it-works", key: "navHowItWorks" as const },
  { href: "/#safety", key: "navSafety" as const },
  { href: "/intake", key: "navIntake" as const },
  { href: "/dashboard", key: "navDashboard" as const },
  { href: "/knowledge-base", key: "navKnowledgeBase" as const },
];

export function MobileNavDrawer({ isOpen, onClose, language, onChangeLanguage }: MobileNavDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.body.style.overflow = "hidden";
      drawerRef.current?.focus();
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
        if (e.key === "Tab") handleTrapFocus(e);
      };
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = "";
        document.removeEventListener("keydown", handleKeyDown);
        previousActiveElement.current?.focus();
      };
    }
  }, [isOpen, onClose]);

  const handleTrapFocus = (e: KeyboardEvent) => {
    if (drawerRef.current) trapFocus(drawerRef.current, e);
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={drawerRef}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white shadow-2xl flex flex-col md:hidden"
        role="dialog"
        aria-modal="true"
        aria-label={t("navMenu")}
        tabIndex={-1}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <Link href="/" className="flex items-center gap-3" aria-label="NyayMitra home" onClick={onClose}>
            <span className="grid size-10 place-items-center rounded-lg bg-gradient-to-br from-teal-400 to-cyan-600 text-lg font-black text-white shadow-lg shadow-teal-900/20">
              N
            </span>
            <span className="text-xl font-black tracking-tight text-slate-950">{t("appName")}</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
            aria-label={t("closeMenu")}
          >
            <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-5 py-6 space-y-3">
          {navLinks.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              onClick={onClose}
              className="flex items-center gap-3 rounded-lg px-4 py-3.5 text-base font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-700 transition min-h-[48px]"
            >
              <span className="size-5" aria-hidden="true">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="size-5">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
              {t(link.key)}
            </Link>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-600">{t("languageLabel")}</span>
            <select
              value={language}
              onChange={(e) => { onChangeLanguage(e.target.value as Language); onClose(); }}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-700 shadow-sm min-h-[48px]"
              aria-label={t("selectLanguage")}
            >
              <option value="en">English</option>
              <option value="hi">हिंदी</option>
              <option value="hinglish">Hinglish</option>
            </select>
          </div>
          <Link
            href="/intake"
            onClick={onClose}
            className="block rounded-lg bg-slate-950 px-5 py-3.5 text-center text-base font-bold text-white shadow-lg shadow-slate-950/15 transition hover:bg-teal-700 min-h-[48px]"
          >
            {t("navStartCase")}
          </Link>
        </div>
      </aside>
    </>
  );
}