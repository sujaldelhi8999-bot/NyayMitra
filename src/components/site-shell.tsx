"use client";

import Link from "next/link";
import { useState } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getInitialLanguage, type Language, translate } from "@/lib/i18n";

export function Navbar({ language, onChangeLanguage }: { language: Language; onChangeLanguage: (lang: Language) => void }) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  return (
    <header className="sticky top-0 z-50 border-b border-white/20 bg-white/85 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="NyayMitra home">
          <span className="grid size-10 place-items-center rounded-lg bg-gradient-to-br from-teal-400 to-cyan-600 text-lg font-black text-white shadow-lg shadow-teal-900/20">
            N
          </span>
          <span className="text-xl font-black tracking-tight text-slate-950">
            {t("appName")}
          </span>
        </Link>
        <div className="hidden items-center gap-8 text-sm font-semibold text-slate-600 md:flex">
          <Link href="/#features" className="hover:text-teal-700">{t("navFeatures")}</Link>
          <Link href="/#how-it-works" className="hover:text-teal-700">{t("navHowItWorks")}</Link>
          <Link href="/#safety" className="hover:text-teal-700">{t("navSafety")}</Link>
          <Link href="/intake" className="hover:text-teal-700">{t("navIntake")}</Link>
          <Link href="/dashboard" className="hover:text-teal-700">{t("navDashboard")}</Link>
          <Link href="/knowledge-base" className="hover:text-teal-700">{t("navKnowledgeBase")}</Link>
        </div>
        <div className="flex items-center gap-4">
          <LanguageSwitcher language={language} onChange={onChangeLanguage} />
          <Link
            href="/intake"
            className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5 hover:bg-teal-700"
          >
            {t("navStartCase")}
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function Footer({ language }: { language: Language }) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  return (
    <footer className="border-t border-slate-200 bg-white px-5 py-8 text-center text-sm font-semibold text-slate-500">
      {t("footerDisclaimer")}
    </footer>
  );
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => getInitialLanguage());

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    localStorage.setItem("nyaymitra_language", nextLanguage);
  }

  return (
    <>
      <Navbar language={language} onChangeLanguage={changeLanguage} />
      <main key={language} className="flex-1">{children}</main>
      <Footer language={language} />
    </>
  );
}