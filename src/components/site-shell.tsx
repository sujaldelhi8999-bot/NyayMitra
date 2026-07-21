"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage, type Language, translate } from "@/lib/i18n";
import { trapFocus } from "@/lib/focusTrap";

const navLinks = [
  { href: "/#features", key: "navFeatures" },
  { href: "/#how-it-works", key: "navHowItWorks" },
  { href: "/#safety", key: "navSafety" },
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
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  const handleTrapFocus = (e: KeyboardEvent) => {
    if (drawerRef.current) trapFocus(drawerRef.current, e);
  };

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

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={drawerRef}
        className={`fixed inset-y-0 right-0 z-[70] w-full max-w-sm bg-white shadow-xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <Link href="/" className="flex items-center gap-3" aria-label="NyayMitra home" onClick={onClose}>
            <span className="grid size-10 place-items-center rounded-lg bg-gradient-to-br from-teal-400 to-cyan-600 text-lg font-black text-white shadow-lg">
              N
            </span>
            <span className="text-xl font-black tracking-tight text-slate-950" suppressHydrationWarning>
              {t("appName")}
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition focus:outline-none focus:ring-2 focus:ring-teal-500"
            aria-label="Close menu"
          >
            <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
              className="block rounded-lg px-4 py-3.5 text-base font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-700 transition"
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
            className="block rounded-lg bg-teal-600 px-5 py-3.5 text-center text-base font-black text-white shadow-lg hover:bg-teal-700 transition"
          >
            {t("navStartCase")}
          </Link>
        </nav>
        <div className="border-t border-slate-200 px-5 py-4 text-center text-sm font-semibold text-slate-500">
          NyayMitra is a legal self-help tool, not a lawyer. Verify with legal aid/lawyer.
        </div>
      </aside>
    </>
  );
}

function Navbar({
  language,
  onChangeLanguage,
  mobileMenuOpen,
  onMenuOpen,
}: {
  language: Language;
  onChangeLanguage: (lang: Language) => void;
  mobileMenuOpen: boolean;
  onMenuOpen: () => void;
}) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  return (
    <header className="sticky top-0 z-50 border-b border-white/20 bg-white/85 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="NyayMitra home">
          <span className="grid size-10 place-items-center rounded-lg bg-gradient-to-br from-teal-400 to-cyan-600 text-lg font-black text-white shadow-lg shadow-teal-900/20">
            N
          </span>
          <span className="text-xl font-black tracking-tight text-slate-950" suppressHydrationWarning>
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
            onClick={onMenuOpen}
            aria-label="Open menu"
            aria-expanded={mobileMenuOpen}
          >
            <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </nav>
    </header>
  );
}

function Footer({ language }: { language: Language }) {
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  return (
    <footer className="border-t border-slate-200 bg-white px-5 py-6 text-center text-sm font-semibold text-slate-500">
      {t("disclaimer")}
    </footer>
  );
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  const { language, setLanguage } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (!window.location.hash) {
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  return (
    <>
      <Navbar
        language={language}
        onChangeLanguage={setLanguage}
        mobileMenuOpen={mobileMenuOpen}
        onMenuOpen={() => setMobileMenuOpen(true)}
      />
      <MobileNavDrawer
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        language={language}
        onChangeLanguage={setLanguage}
      />
      <main className="flex-1 main-content">{children}</main>
      <Footer language={language} />
    </>
  );
}