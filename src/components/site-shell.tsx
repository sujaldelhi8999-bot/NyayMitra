"use client";

import { useState } from "react";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage, type Language, translate } from "@/lib/i18n";

const navLinks = [
  { href: "/#features", key: "navFeatures" },
  { href: "/#how-it-works", key: "navHowItWorks" },
  { href: "/#safety", key: "navSafety" },
  { href: "/intake", key: "navIntake" },
  { href: "/dashboard", key: "navDashboard" },
  { href: "/knowledge-base", key: "navKnowledgeBase" },
] as const;

function MobileNavDrawer({
  isOpen,
  onClose,
  language,
  onChangeLanguage,
}: {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  onChangeLanguage: (lang: Language) => void;
}) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white shadow-xl md:hidden animate-in slide-in-from-right">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <span className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-gradient-to-br from-teal-400 to-cyan-600 text-lg font-black text-white shadow-lg">
                N
              </span>
              <span className="text-xl font-black text-slate-950">{t("appName")}</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
              aria-label="Close menu"
            >
              <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                onClick={onClose}
                className="block rounded-lg px-4 py-3 text-base font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-700 active:bg-teal-100"
              >
                {t(link.key)}
              </Link>
            ))}
            <div className="border-t border-slate-200 my-4 pt-4">
              <LanguageSwitcher language={language} onChange={onChangeLanguage} />
            </div>
            <Link
              href="/intake"
              onClick={onClose}
              className="block rounded-lg bg-teal-600 px-5 py-3.5 text-center text-base font-black text-white shadow-lg active:bg-teal-700"
            >
              {t("navStartCase")}
            </Link>
          </nav>
          <div className="border-t border-slate-200 px-5 py-4 text-center text-sm font-semibold text-slate-500">
            NyayMitra is a legal self-help tool, not a lawyer. Verify with legal aid/lawyer.
          </div>
        </div>
      </aside>
    </>
  );
}

function Navbar({ language, onChangeLanguage }: { language: Language; onChangeLanguage: (lang: Language) => void }) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
          {navLinks.map((link) => (
            <Link key={link.key} href={link.href} className="hover:text-teal-700">
              {t(link.key)}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <LanguageSwitcher language={language} onChange={onChangeLanguage} />
          <Link
            href="/intake"
            className="hidden rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5 hover:bg-teal-700 sm:inline-flex"
          >
            {t("navStartCase")}
          </Link>
          <button
            type="button"
            className="md:hidden rounded-lg p-2.5 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileMenuOpen}
          >
            <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </nav>
      <MobileNavDrawer
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        language={language}
        onChangeLanguage={onChangeLanguage}
      />
    </header>
  );
}

function Footer({ language }: { language: Language }) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  return (
    <footer className="border-t border-slate-200 bg-white px-5 py-6 text-center text-sm font-semibold text-slate-500">
      NyayMitra is a legal self-help tool, not a lawyer. Verify with legal aid/lawyer.
    </footer>
  );
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  const { language, setLanguage } = useLanguage();

  return (
    <>
      <Navbar language={language} onChangeLanguage={setLanguage} />
      <main>{children}</main>
      <Footer language={language} />
    </>
  );
}