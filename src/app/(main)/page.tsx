"use client";

import Link from "next/link";
import { translate, useLanguage } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default function Home() {
  const { language } = useLanguage();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  const features = [
    [t("feature1Title"), t("feature1Desc")],
    [t("feature2Title"), t("feature2Desc")],
    [t("feature3Title"), t("feature3Desc")],
    [t("feature4Title"), t("feature4Desc")],
    [t("feature5Title"), t("feature5Desc")],
    [t("feature6Title"), t("feature6Desc")],
  ];

  const steps = [t("step1"), t("step2"), t("step3"), t("step4")];
  const legalProblems = [t("legalProblem1"), t("legalProblem2"), t("legalProblem3"), t("legalProblem4"), t("legalProblem5"), t("legalProblem6"), t("legalProblem7"), t("legalProblem8"), t("legalProblem9")];

  return (
    <>
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,#14b8a633,transparent_34%),linear-gradient(135deg,#06152f_0%,#0f2745_52%,#0f766e_100%)] px-5 py-16 text-white sm:px-8 sm:py-20 lg:py-24">
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-50 to-transparent" />
        <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="inline-flex rounded-lg border border-teal-200/30 bg-white/10 px-4 py-2 text-sm font-bold text-teal-50 backdrop-blur">{t("heroBadge")}</p>
            <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl lg:text-7xl">
              {t("appName")}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-100 sm:text-xl sm:leading-9">
              {t("heroDescription")}
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link href="/intake" className="rounded-lg bg-teal-400 px-6 py-3.5 text-center text-base font-black text-slate-950 shadow-2xl shadow-teal-950/30 transition hover:-translate-y-1 hover:bg-teal-300 min-h-[48px] min-w-[48px] flex items-center justify-center">
                {t("startCase")}
              </Link>
              <a href="#safety" className="rounded-lg border border-white/25 bg-white/10 px-6 py-3.5 text-center text-base font-bold text-white backdrop-blur transition hover:bg-white/20 min-h-[48px] min-w-[48px] flex items-center justify-center">
                {t("heroReadSafety")}
              </a>
            </div>
          </div>
          <div className="rounded-lg border border-white/15 bg-white/10 p-4 shadow-2xl shadow-slate-950/30 backdrop-blur-xl sm:p-5">
            <div className="rounded-lg bg-white p-5 text-slate-950 sm:p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 sm:pb-5">
                <div>
                  <p className="text-sm font-bold text-teal-700">{t("snapshotLabel")}</p>
                  <h3 className="text-xl font-black sm:text-2xl">{t("snapshotTitle")}</h3>
                </div>
                <span className="rounded-lg bg-teal-50 px-3 py-1 text-xs font-black text-teal-800">{t("snapshotDraft")}</span>
              </div>
              <div className="mt-5 space-y-3 sm:mt-6 sm:space-y-4">
                {[
                  t("snapshotBullet1"),
                  t("snapshotBullet2"),
                  t("snapshotBullet3"),
                ].map((item) => (
                  <div key={item} className="flex gap-3 rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-700 sm:p-4">
                    <span className="mt-0.5 size-5 rounded-full bg-teal-500 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-teal-700">{t("homeSectionFeaturesEyebrow")}</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">{t("homeSectionFeaturesTitle")}</h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">{t("homeSectionFeaturesDesc")}</p>
        </div>
        <div className="mx-auto mt-8 grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {legalProblems.map((item) => <div key={item} className="rounded-lg bg-slate-950 p-4 text-base font-black text-white shadow-xl sm:p-5 sm:text-lg">{item}</div>)}
        </div>
        <div className="mx-auto mt-10 grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(([title, text]) => (
            <article key={title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60 transition hover:-translate-y-1 hover:shadow-2xl sm:p-6">
              <div className="mb-4 size-10 rounded-lg bg-gradient-to-br from-teal-100 to-cyan-100 sm:mb-5 sm:size-12" />
              <h3 className="text-lg font-black text-slate-950 sm:text-xl">{title}</h3>
              <p className="mt-2 leading-6 text-slate-600 sm:mt-3 sm:leading-7">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="bg-white px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-teal-700">{t("homeSectionProcessEyebrow")}</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">{t("homeSectionProcessTitle")}</h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">{t("homeSectionProcessDesc")}</p>
        </div>
        <div className="mx-auto mt-10 grid max-w-6xl gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step} className="rounded-lg bg-slate-950 p-5 text-white shadow-xl shadow-slate-950/15 sm:p-6">
              <p className="text-sm font-black text-teal-300">{t("homeStepLabel")} {index + 1}</p>
              <h3 className="mt-3 text-xl font-black sm:mt-4 sm:text-2xl">{step}</h3>
            </div>
          ))}
        </div>
      </section>

      <section id="safety" className="px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-5xl rounded-lg border border-teal-100 bg-gradient-to-br from-white to-teal-50 p-6 shadow-2xl shadow-teal-900/10 sm:p-8 sm:p-12">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-teal-700">{t("safetyEyebrow")}</p>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl sm:mt-4 sm:text-5xl">{t("safetyTitle")}</h2>
          <p className="mt-4 text-base leading-7 text-slate-700 sm:mt-5 sm:text-lg sm:leading-8">
            {t("safetyDescription")}
          </p>
          <Link href="/intake" className="mt-6 inline-flex rounded-lg bg-slate-950 px-6 py-3.5 font-black text-white shadow-xl shadow-slate-950/20 transition hover:-translate-y-1 hover:bg-teal-700 min-h-[48px] min-w-[48px] flex items-center justify-center sm:mt-8 sm:px-8 sm:py-4">
            {t("safetyStartButton")}
          </Link>
        </div>
      </section>
    </>
  );
}