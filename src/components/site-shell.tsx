"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getInitialLanguage, type Language } from "@/lib/i18n";

export function Navbar({ language, onChangeLanguage }: { language: Language; onChangeLanguage: (lang: Language) => void }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/20 bg-white/85 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="NyayMitra home">
          <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 to-cyan-600 text-lg font-black text-white shadow-lg shadow-teal-900/20">
            N
          </span>
          <span className="text-xl font-black tracking-tight text-slate-950">
            NyayMitra
          </span>
        </Link>
        <div className="hidden items-center gap-8 text-sm font-semibold text-slate-600 md:flex">
          <Link href="/#features" className="hover:text-teal-700">Features</Link>
          <Link href="/#how-it-works" className="hover:text-teal-700">How it works</Link>
          <Link href="/#safety" className="hover:text-teal-700">Safety</Link>
          <Link href="/intake" className="hover:text-teal-700">Intake</Link>
          <Link href="/dashboard" className="hover:text-teal-700">Dashboard</Link>
          <Link href="/knowledge-base" className="hover:text-teal-700">Knowledge Base</Link>
        </div>
        <div className="flex items-center gap-4">
          <LanguageSwitcher language={language} onChange={onChangeLanguage} />
          <Link
            href="/intake"
            className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5 hover:bg-teal-700"
          >
            Start Case Preparation
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white px-5 py-8 text-center text-sm font-semibold text-slate-500">
      NyayMitra is a legal self-help preparation tool, not a lawyer. Please verify with legal aid/lawyer before filing.
    </footer>
  );
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    setLanguage(getInitialLanguage());
  }, []);

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    localStorage.setItem("nyaymitra_language", nextLanguage);
  }

  return (
    <>
      <Navbar language={language} onChangeLanguage={changeLanguage} />
      <main key={language} className="flex-1">{children}</main>
      <Footer />
    </>
  );
}