"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getOutputModeForCase, outputModeLabel } from "@/lib/caseConfig";
import { caseStatuses, caseStatusLabel, normalizeCaseStatus, type CaseStatus } from "@/lib/caseStatus";
import { buildOfficialActionSuggestions } from "@/lib/officialPortals";
import { translate, useLanguage } from "@/lib/i18n";
import type { CaseData } from "@/types/case";
import { calculateRiskLevel } from "@/lib/caseUtils";
import { calculateCaseQualityScore } from "@/lib/qualityScore";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const [cases, setCases] = useState<CaseData[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  useEffect(() => {
    let cancelled = false;
    window.setTimeout(() => {
      if (cancelled) return;
      try {
        const saved = JSON.parse(localStorage.getItem("nyaymitra_saved_cases") || "[]") as CaseData[];
        setCases(saved.map((item) => ({ ...item, uploadedFiles: item.uploadedFiles || [], customProofs: item.customProofs || [], customReliefs: item.customReliefs || [], followUpAnswers: item.followUpAnswers || {}, status: normalizeCaseStatus(item.status) })));
      } catch {
        setCases([]);
      }
      setLoaded(true);
    }, 0);
    return () => { cancelled = true; };
  }, []);

  function openLegalKit(caseData: CaseData) {
    try {
      localStorage.setItem("nyaymitra_case_data", JSON.stringify(caseData));
    } catch {}
    router.push("/legal-kit");
  }

  function editCase(caseData: CaseData) {
    try {
      localStorage.setItem("nyaymitra_edit_case", JSON.stringify(caseData));
    } catch {}
    router.push("/intake?edit=true");
  }

  function deleteCase(caseData: CaseData) {
    if (!window.confirm(t("labelDeleteConfirm"))) return;
    const nextCases = cases.filter((item) => item.caseId !== caseData.caseId);
    try {
      const current = localStorage.getItem("nyaymitra_case_data");
      if (current && (JSON.parse(current) as CaseData).caseId === caseData.caseId) {
        localStorage.removeItem("nyaymitra_case_data");
      }
      localStorage.setItem("nyaymitra_saved_cases", JSON.stringify(nextCases));
    } catch {}
    setCases(nextCases);
  }

  function updateStatus(caseData: CaseData, status: CaseStatus) {
    const nextCase = { ...caseData, status, updatedAt: new Date().toISOString() };
    const nextCases = cases.map((item) => item.caseId === caseData.caseId ? nextCase : item);
    try {
      const current = localStorage.getItem("nyaymitra_case_data");
      if (current && (JSON.parse(current) as CaseData).caseId === caseData.caseId) localStorage.setItem("nyaymitra_case_data", JSON.stringify(nextCase));
      localStorage.setItem("nyaymitra_saved_cases", JSON.stringify(nextCases));
    } catch {}
    setCases(nextCases);
  }

  function exportCaseJson(caseData: CaseData) {
    const exportData = { ...caseData, officialActionSuggestions: buildOfficialActionSuggestions(caseData) };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `nyaymitra-case-${caseData.caseId || "draft"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!loaded) return null;

  const totalAmount = cases.reduce((sum, item) => sum + (Number(item.amountLost) || 0), 0);
  const draftReady = cases.filter((item) => normalizeCaseStatus(item.status) === "draft-ready").length;
  const highRisk = cases.filter((item) => getRiskLevel(item) === "High Risk").length;
  const urgentCount = cases.filter((item) => getOutputModeForCase(item) === "urgent-legal-aid-route").length;
  const lawyerReviewCount = cases.filter((item) => needsLawyerReview(item)).length;
  const filteredCases = cases.filter((item) => {
      const outputMode = getOutputModeForCase(item);
      const risk = getRiskLevel(item);
      const matchesSearch = [item.caseId, item.fullName, item.caseType, item.stateOrUT, item.status, ...(item.customProofs || []), ...(item.customReliefs || [])].join(" ").toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || outputMode === filter || (filter === "high-risk" && risk === "High Risk") || (filter === "lawyer-review" && needsLawyerReview(item)) || (filter === "other" && item.caseType === "Other / Not Sure");
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-slate-950 px-5 py-8 text-white sm:px-8">
        <header className="rounded-lg bg-gradient-to-br from-teal-500 to-slate-900 p-8 shadow-2xl">
          <p className="inline-flex rounded-lg bg-white/15 px-4 py-2 text-sm font-black">{t("dashDraftTool")}</p>
          <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">{t("appName")} {t("dashboard")}</h1>
          <p className="mt-3 max-w-3xl text-lg text-slate-100">{t("dashManage")}</p>
          <p className="mt-3 rounded-lg bg-white/10 p-4 text-sm font-semibold text-slate-100">{t("dashStartFreshNote")}</p>
          <p className="mt-4 rounded-lg bg-slate-950/70 p-4 text-sm font-semibold">{t("disclaimer")}</p>
        </header>

        {cases.length === 0 ? (
          <section className="mt-8 rounded-lg bg-white p-10 text-center text-slate-950 shadow-2xl">
            <h2 className="text-3xl font-black">{t("dashNoCases")}</h2>
            <p className="mt-3 text-slate-600">{t("dashStartPrompt")}</p>
            <Link href="/intake" className="mt-6 inline-flex rounded-lg bg-teal-600 px-6 py-3 font-black text-white">{t("startCase")}</Link>
          </section>
        ) : (
          <>
            <section className="mt-8 grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <Stat title={t("statTotalCases")} value={String(cases.length)} />
              <Stat title={t("statDraftReady")} value={String(draftReady)} />
              <Stat title={t("statHighRisk")} value={String(highRisk)} />
              <Stat title={t("statTotalAmount")} value={`₹${totalAmount.toLocaleString("en-IN")}`} />
              <Stat title={t("statLawyerReview")} value={String(lawyerReviewCount)} />
              <Stat title={t("statUrgentRoute")} value={String(urgentCount)} />
            </section>

            <section className="mt-8 grid gap-4 rounded-lg bg-white p-5 text-slate-950 shadow-2xl md:grid-cols-2">
              <label className="block"><span className="text-sm font-black text-teal-700">{t("labelSearch")}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("filterSearchPlaceholder")} className="mt-2 w-full rounded-lg border border-slate-200 p-3 outline-none focus:border-teal-500" /></label>
              <label className="block"><span className="text-sm font-black text-teal-700">{t("labelFilter")}</span><select value={filter} onChange={(event) => setFilter(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 p-3 outline-none focus:border-teal-500"><option value="all">{t("filterAll")}</option><option value="full-preparation-kit">{t("filterFull")}</option><option value="limited-guidance-kit">{t("filterLimited")}</option><option value="urgent-legal-aid-route">{t("filterUrgent")}</option><option value="high-risk">{t("filterHighRisk")}</option><option value="lawyer-review">{t("filterLawyerReview")}</option><option value="other">{t("filterOther")}</option></select></label>
            </section>

            <section className="mt-8 grid gap-5 lg:grid-cols-2">
              {filteredCases.map((caseData) => {
                const risk = getRiskLevel(caseData);
                const quality = calculateCaseQualityScore(caseData);
                const outputMode = getOutputModeForCase(caseData);
                const lawyerReview = needsLawyerReview(caseData);

                return (
                  <article key={caseData.caseId} className="rounded-lg bg-white p-6 text-slate-950 shadow-2xl">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div><p className="text-sm font-black text-teal-700">{caseData.caseId}</p><h2 className="mt-1 text-2xl font-black">{caseData.fullName || t("labelUnnamedCase")}</h2><p className="text-sm font-semibold text-slate-500">{caseData.caseType}</p>{caseData.aiAnalysis?.classification?.caseType && <p className="mt-1 text-sm font-bold text-amber-700">{t("labelAiSuggested")} {caseData.aiAnalysis.classification.caseType}</p>}</div>
                      <div className="flex flex-wrap gap-2"><Badge text={risk} tone={risk === "High Risk" ? "red" : risk === "Medium Risk" ? "amber" : "teal"} /><Badge text={outputModeLabel(outputMode)} tone={outputMode === "urgent-legal-aid-route" ? "red" : outputMode === "limited-guidance-kit" ? "amber" : "teal"} />{lawyerReview && <Badge text={t("statLawyerReview")} tone="red" />}<Badge text={caseStatusLabel(normalizeCaseStatus(caseData.status), language)} tone="slate" /></div>
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <Info label={t("labelIncidentDate")} value={caseData.incidentDate || "Not set"} />
                      <Info label={t("labelStateUT")} value={caseData.stateOrUT || "Not provided"} />
                      <Info label={t("labelAmountLost")} value={`₹${Number(caseData.amountLost || 0).toLocaleString("en-IN")}`} />
                      <Info label={t("labelQualityScore")} value={`${quality.score}/100 (${quality.label})`} />
                      <Info label={t("labelLastUpdated")} value={caseData.updatedAt ? new Date(caseData.updatedAt).toLocaleString() : "Not set"} />
                      <Info label={t("labelReliefWanted")} value={[...caseData.relief.filter((item) => item !== "Other relief / outcome"), ...(caseData.customReliefs || [])].join(", ") || "Not selected"} />
                      <Info label={t("labelProofFiles")} value={`${caseData.proofs.filter((item) => item !== "Other proof / document").length} standard + ${(caseData.customProofs || []).length} custom, ${caseData.uploadedFiles.length} files`} />
                      <Info label={t("labelCustomReliefs")} value={`${(caseData.customReliefs || []).length} added`} />
                    </div>
                    <label className="mt-5 block"><span className="text-sm font-black text-teal-700">{t("labelStatusUpdate")}</span><select value={normalizeCaseStatus(caseData.status)} onChange={(event) => updateStatus(caseData, normalizeCaseStatus(event.target.value))} className="mt-2 w-full rounded-lg border border-slate-200 p-3 font-bold outline-none focus:border-teal-500">{caseStatuses.map((status) => <option key={status} value={status}>{caseStatusLabel(status, language)}</option>)}</select></label>
                    <div className="mt-5 grid gap-3 sm:grid-cols-4">
                      <button type="button" onClick={() => openLegalKit(caseData)} className="rounded-lg bg-teal-600 px-4 py-3 font-bold text-white">{t("openLegalKit")}</button>
                      <button type="button" onClick={() => editCase(caseData)} className="rounded-lg bg-slate-950 px-4 py-3 font-bold text-white">{t("editIntake")}</button>
                      <button type="button" onClick={() => exportCaseJson(caseData)} className="rounded-lg bg-teal-50 px-4 py-3 font-bold text-teal-800">{t("labelExportJson")}</button>
                      <button type="button" onClick={() => deleteCase(caseData)} className="rounded-lg bg-red-50 px-4 py-3 font-bold text-red-700">{t("deleteCase")}</button>
                    </div>
                  </article>
                );
              })}
            </section>
          </>
        )}
      </div>
  );
}

function getRiskLevel(data: CaseData) { return data.aiAnalysis?.classification?.riskLevel || (getOutputModeForCase(data) === "urgent-legal-aid-route" ? "High Risk" : calculateRiskLevel(data.amountLost)); }
function needsLawyerReview(data: CaseData) { return getOutputModeForCase(data) === "urgent-legal-aid-route" || Boolean(data.aiAnalysis?.classification?.lawyerReviewRecommended); }
function Stat({ title, value }: { title: string; value: string }) { return <div className="rounded-lg bg-white p-5 text-slate-950 shadow-xl"><p className="text-sm font-black uppercase tracking-[0.16em] text-teal-700">{title}</p><p className="mt-2 text-3xl font-black">{value}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p><p className="mt-1 font-bold">{value}</p></div>; }
function Badge({ text, tone }: { text: string; tone: "red" | "amber" | "teal" | "slate" }) { const color = tone === "red" ? "bg-red-100 text-red-800" : tone === "amber" ? "bg-amber-100 text-amber-800" : tone === "teal" ? "bg-teal-100 text-teal-800" : "bg-slate-100 text-slate-700"; return <span className={`rounded-lg px-3 py-1 text-xs font-black ${color}`}>{text}</span>; }
