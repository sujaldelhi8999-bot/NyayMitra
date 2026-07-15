"use client";

import { useState } from "react";
import { verifiedLegalKnowledge } from "@/data/legalKnowledgeBase";
import { officialPortals } from "@/data/officialPortals";
import { translate, useLanguage } from "@/lib/i18n";
import { TouchSelect } from "@/components/touch-select";

export const dynamic = "force-dynamic";

export default function KnowledgeBasePage() {
  const { language } = useLanguage();
  const caseTypes = ["All", ...Array.from(new Set(verifiedLegalKnowledge.map((entry) => entry.caseType)))];
  const [filter, setFilter] = useState("All");
  const [tab, setTab] = useState<"legal" | "portals">("legal");
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const entries = filter === "All" ? verifiedLegalKnowledge : verifiedLegalKnowledge.filter((entry) => entry.caseType === filter);
  const portalCaseTypes = ["All", ...Array.from(new Set(officialPortals.flatMap((p) => p.caseTypes).filter((ct) => ct !== "all")))];
  const [portalFilter, setPortalFilter] = useState("All");
  const filteredPortals = portalFilter === "All" ? officialPortals : officialPortals.filter((p) => p.caseTypes.includes("all") ? false : p.caseTypes.includes(portalFilter));

  const caseTypeOptions = caseTypes.map((ct) => ({ value: ct, label: ct }));
  const portalCaseTypeOptions = portalCaseTypes.map((ct) => ({ value: ct, label: ct }));

  return (
    <div className="min-h-screen bg-slate-950 px-5 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-lg bg-gradient-to-br from-teal-500 to-slate-900 p-8 shadow-2xl">
          <p className="inline-flex rounded-lg bg-white/15 px-4 py-2 text-sm font-black">{t("kbHeader")}</p>
          <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">{t("kbTitle")}</h1>
          <p className="mt-3 max-w-3xl text-lg text-slate-100">{t("kbDescription")}</p>
          <p className="mt-4 rounded-lg bg-slate-950/70 p-4 text-sm font-semibold">{t("kbDisclaimer")}</p>
        </header>

        <section className="mt-8 rounded-lg bg-white p-5 text-slate-950 shadow-2xl">
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setTab("legal")} className={`rounded-lg px-6 py-4 font-black min-h-[48px] ${tab === "legal" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"}`}>{t("tabLegalKnowledge")}</button>
            <button type="button" onClick={() => setTab("portals")} className={`rounded-lg px-6 py-4 font-black min-h-[48px] ${tab === "portals" ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-700"}`}>{t("tabOfficialPortals")}</button>
          </div>
          {tab === "legal" && (
            <div>
              <label className="mt-5 block font-black text-teal-700">{t("filterByCaseType")}</label>
              <TouchSelect value={filter} onChange={setFilter} options={caseTypeOptions} placeholder={t("filterByCaseType")} className="mt-2 w-full md:max-w-md" />
            </div>
          )}
          {tab === "portals" && (
            <div>
              <label className="mt-5 block font-black text-teal-700">{t("filterByCaseType")}</label>
              <TouchSelect value={portalFilter} onChange={setPortalFilter} options={portalCaseTypeOptions} placeholder={t("filterByCaseType")} className="mt-2 w-full md:max-w-md" />
            </div>
          )}
        </section>

        {tab === "legal" ? <section className="mt-8 grid gap-5 grid-cols-1 sm:grid-cols-2">
          {entries.map((entry) => (
            <article key={entry.id} className="rounded-lg bg-white p-6 text-slate-950 shadow-2xl">
              <div className="flex flex-wrap gap-2"><span className="rounded-lg bg-teal-100 px-3 py-1 text-xs font-black text-teal-800">{entry.category}</span><span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{entry.caseType}</span></div>
              <h2 className="mt-4 text-2xl font-black">{entry.title}</h2>
              <p className="mt-3 leading-7 text-slate-700">{entry.plainSummary}</p>
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">{entry.usageNote}</p>
              <div className="mt-4 text-sm font-semibold text-slate-600"><p>Source: {entry.sourceName}</p><p>Last checked: {entry.lastChecked}</p><a className="text-teal-700" href={entry.sourceUrl} target="_blank" rel="noreferrer">{entry.sourceUrl}</a></div>
            </article>
          ))}
        </section> : <section className="mt-8 grid gap-5 grid-cols-1 sm:grid-cols-2">
          {filteredPortals.map((portal) => (
            <article key={portal.id} className="rounded-lg bg-white p-6 text-slate-950 shadow-2xl">
              <div className="flex flex-wrap gap-2"><span className="rounded-lg bg-teal-100 px-3 py-1 text-xs font-black text-teal-800">{t("badgeOfficial")}</span>{portal.emergencyOnly && <span className="rounded-lg bg-orange-100 px-3 py-1 text-xs font-black text-orange-800">{t("badgeEmergency")}</span>}{portal.stateSpecific && <span className="rounded-lg bg-yellow-100 px-3 py-1 text-xs font-black text-yellow-800">{t("badgeStateSpecific")}</span>}<span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{portal.category}</span></div>
              <h2 className="mt-4 text-2xl font-black">{portal.title}</h2>
              <p className="mt-3 leading-7 text-slate-700">{portal.description}</p>
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">{portal.notes}</p>
              <p className="mt-3 text-sm font-semibold text-slate-600">Case types: {portal.caseTypes.join(", ")}</p>
              <div className="mt-4 text-sm font-semibold text-slate-600"><p>Source: {portal.sourceName}</p><p>Last checked: {portal.lastChecked}</p><a className="text-teal-700" href={portal.url} target="_blank" rel="noopener noreferrer">{portal.url}</a></div>
            </article>
          ))}
        </section>}
      </div>
    </div>
  );
}
