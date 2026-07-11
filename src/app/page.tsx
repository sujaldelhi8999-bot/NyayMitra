"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SectionHeading } from "@/components/section-heading";
import { SiteShell } from "@/components/site-shell";
import { getInitialLanguage, type Language, translate } from "@/lib/i18n";

const features = [
  ["Guided Case Intake", "Simple prompts help users explain a cyber fraud complaint without legal jargon."],
  ["Evidence Organizer", "Group screenshots, messages, transaction IDs, and acknowledgements in one case file."],
  ["Timeline Builder", "Convert scattered facts into a clear sequence of events for review."],
  ["Legal Action Kit PDF", "Prepare structured drafts and checklists for cybercrime, bank, and police routes."],
  ["Legal Aid Routing", "Surface next steps for legal aid or lawyer review when the case needs support."],
  ["Responsible AI Safety", "Clear boundaries keep NyayMitra as self-help preparation, not legal advice."],
];

const steps = ["Tell your story", "Upload proof", "Confirm timeline", "Generate Legal Action Kit"];
const legalProblems = ["Cyber fraud", "Consumer complaint", "Salary dispute", "Tenant issue", "Police complaint", "RTI delay", "Family safety concern", "Property issue", "Other / Not Sure"];

export default function Home() {
  const [language, setLanguage] = useState<Language>("en");
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  useEffect(() => {
    window.setTimeout(() => setLanguage(getInitialLanguage()), 0);
  }, []);

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    localStorage.setItem("nyaymitra_language", nextLanguage);
  }

  return (
    <SiteShell>
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,#14b8a633,transparent_34%),linear-gradient(135deg,#06152f_0%,#0f2745_52%,#0f766e_100%)] px-5 py-20 text-white sm:px-8 lg:py-28">
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-50 to-transparent" />
        <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="mb-6"><LanguageSwitcher language={language} onChange={changeLanguage} /></div>
            <p className="inline-flex rounded-full border border-teal-200/30 bg-white/10 px-4 py-2 text-sm font-bold text-teal-50 backdrop-blur">AI Legal Guidance and Case Preparation Assistant for Bharat</p>
            <h1 className="mt-7 text-5xl font-black tracking-tight sm:text-7xl">
              NyayMitra
            </h1>
            <p className="mt-6 max-w-2xl text-xl leading-9 text-slate-100">
              Explain any legal problem in simple language. NyayMitra helps classify the issue, organize proof, ask smart questions, prepare drafts or consultation notes, and route serious matters to legal aid or lawyer review.
            </p>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <Link href="/intake" className="rounded-full bg-teal-400 px-8 py-4 text-center text-base font-black text-slate-950 shadow-2xl shadow-teal-950/30 transition hover:-translate-y-1 hover:bg-teal-300">
                {t("startCase")}
              </Link>
              <a href="#safety" className="rounded-full border border-white/25 bg-white/10 px-8 py-4 text-center text-base font-bold text-white backdrop-blur transition hover:bg-white/20">
                Read safety note
              </a>
            </div>
          </div>
          <div className="rounded-[2rem] border border-white/15 bg-white/10 p-5 shadow-2xl shadow-slate-950/30 backdrop-blur-xl">
            <div className="rounded-[1.5rem] bg-white p-6 text-slate-950">
              <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                <div>
                  <p className="text-sm font-bold text-teal-700">Case Snapshot</p>
                  <h3 className="text-2xl font-black">Universal Case Preparation</h3>
                </div>
                <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-teal-800">Draft</span>
              </div>
              <div className="mt-6 space-y-4">
                {[
                  "Issue classified with safe routing",
                  "Proof and missing details organized",
                  "Draft or consultation note prepared for review",
                ].map((item) => (
                  <div key={item} className="flex gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                    <span className="mt-0.5 size-5 rounded-full bg-teal-500" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="px-5 py-20 sm:px-8">
        <SectionHeading eyebrow="Universal Support" title="Works across many legal problems" description="NyayMitra adapts the preparation kit, proof checklist, and safety route to the issue described by the user." />
        <div className="mx-auto mt-10 grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {legalProblems.map((item) => <div key={item} className="rounded-3xl bg-slate-950 p-5 text-lg font-black text-white shadow-xl">{item}</div>)}
        </div>
        <div className="mx-auto mt-12 grid max-w-7xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(([title, text]) => (
            <article key={title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 transition hover:-translate-y-1 hover:shadow-2xl">
              <div className="mb-5 size-12 rounded-2xl bg-gradient-to-br from-teal-100 to-cyan-100" />
              <h3 className="text-xl font-black text-slate-950">{title}</h3>
              <p className="mt-3 leading-7 text-slate-600">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="bg-white px-5 py-20 sm:px-8">
        <SectionHeading eyebrow="Process" title="From confusion to a case-ready kit" description="NyayMitra breaks case preparation into four clear, presentation-friendly steps." />
        <div className="mx-auto mt-12 grid max-w-6xl gap-5 md:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step} className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl shadow-slate-950/15">
              <p className="text-sm font-black text-teal-300">Step {index + 1}</p>
              <h3 className="mt-4 text-2xl font-black">{step}</h3>
            </div>
          ))}
        </div>
      </section>

      <section id="safety" className="px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-teal-100 bg-gradient-to-br from-white to-teal-50 p-8 shadow-2xl shadow-teal-900/10 sm:p-12">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-teal-700">Responsible AI Safety</p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">Legal self-help, not legal advice</h2>
          <p className="mt-5 text-lg leading-8 text-slate-700">
            NyayMitra does not provide legal advice and does not guarantee any result. It helps users prepare drafts, organize evidence, and seek legal aid or lawyer review where needed.
          </p>
          <Link href="/intake" className="mt-8 inline-flex rounded-full bg-slate-950 px-8 py-4 font-black text-white shadow-xl shadow-slate-950/20 transition hover:-translate-y-1 hover:bg-teal-700">
            Start Case Preparation
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
