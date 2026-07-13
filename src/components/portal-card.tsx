"use client";

import type { OfficialPortal } from "@/data/officialPortals";

export function PortalCard({ portal }: { portal: OfficialPortal }) {
  return (
    <article className="rounded-lg border border-white/10 bg-white p-5 text-slate-950 shadow-xl">
      <div className="flex flex-wrap gap-2">
        <span className="rounded-lg bg-teal-100 px-3 py-1 text-xs font-black text-teal-800">Official</span>
        {portal.emergencyOnly && <span className="rounded-lg bg-orange-100 px-3 py-1 text-xs font-black text-orange-800">Emergency</span>}
        {portal.stateSpecific && <span className="rounded-lg bg-yellow-100 px-3 py-1 text-xs font-black text-yellow-800">State-specific</span>}
        <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{portal.category}</span>
      </div>
      <h3 className="mt-4 text-xl font-black">{portal.title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{portal.description}</p>
      <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">{portal.notes}</p>
      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs font-bold text-slate-600"><p>Source: {portal.sourceName}</p><p>Last checked: {portal.lastChecked}</p></div>
      <a href={portal.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-teal-700">{portal.actionLabel}</a>
    </article>
  );
}
