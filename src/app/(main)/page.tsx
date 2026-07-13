"use client";

import Link from "next/link";
import { SectionHeading } from "@/components/section-heading";
import { type Language, translate, useLanguage } from "@/lib/i18n";

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
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,#14b8a633,transparent_34%),linear-gradient(135deg,#06152f_0%,#0f2745_52%,#0f766e_100%)] px-5 py-20 text-white sm:px-8 lg:py-28">
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-50 to-transparent" />
        <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="inline-flex rounded-lg border border-teal-200/30 bg-white/10 px-4 py-2 text-sm font-bold text-teal-50 backdrop-blur">{t("heroBadge")}</p>
            <h1 className="mt-7 text-5xl font-black tracking-tight sm:text-7xl">
              {t("appName")}
            </h1>
            <p className="mt-6 max-w-2xl text-xl leading-9 text-slate-100">
              {t("heroDescription")}
            </p>
            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <Link href="/intake" className="rounded-lg bg-teal-400 px-8 py-4 text-center text-base font-black text-slate-950 shadow-2xl shadow-teal-950/30 transition hover:-translate-y-1 hover:bg-teal-300">
                {t("startCase")}
              </Link>
              <a href="#safety" className="rounded-lg border border-white/25 bg-white/10 px-8 py-4 text-center text-base font-bold text-white backdrop-blur transition hover:bg-white/20">
                {t("heroReadSafety")}
              </a>
            </div>
          </div>
          <div className="rounded-lg border border-white/15 bg-white/10 p-5 shadow-2xl shadow-slate-950/30 backdrop-blur-xl">
            <div className="rounded-lg bg-white p-6 text-slate-950">
              <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                <div>
                  <p className="text-sm font-bold text-teal-700">{t("snapshotLabel")}</p>
                  <h3 className="text-2xl font-black">{t("snapshotTitle")}</h3>
                </div>
                <span className="rounded-lg bg-teal-50 px-3 py-1 text-xs font-black text-teal-800">{t("snapshotDraft")}</span>
              </div>
              <div className="mt-6 space-y-4">
                {[
                  t("snapshotBullet1"),
                  t("snapshotBullet2"),
                  t("snapshotBullet3"),
                ].map((item) => (
                  <div key={item} className="flex gap-3 rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-700">
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
        <SectionHeading eyebrow={t("homeSectionFeaturesEyebrow")} title={t("homeSectionFeaturesTitle")} description={t("homeSectionFeaturesDesc")} />
        <div className="mx-auto mt-10 grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {legalProblems.map((item) => <div key={item} className="rounded-lg bg-slate-950 p-5 text-lg font-black text-white shadow-xl">{item}</div>)}
        </div>
        <div className="mx-auto mt-12 grid max-w-7xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(([title, text]) => (
            <article key={title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 transition hover:-translate-y-1 hover:shadow-2xl">
              <div className="mb-5 size-12 rounded-lg bg-gradient-to-br from-teal-100 to-cyan-100" />
              <h3 className="text-xl font-black text-slate-950">{title}</h3>
              <p className="mt-3 leading-7 text-slate-600">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="bg-white px-5 py-20 sm:px-8">
        <SectionHeading eyebrow={t("homeSectionProcessEyebrow")} title={t("homeSectionProcessTitle")} description={t("homeSectionProcessDesc")} />
        <div className="mx-auto mt-12 grid max-w-6xl gap-5 md:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step} className="rounded-lg bg-slate-950 p-6 text-white shadow-xl shadow-slate-950/15">
              <p className="text-sm font-black text-teal-300">{t("homeStepLabel")} {index + 1}</p>
              <h3 className="mt-4 text-2xl font-black">{step}</h3>
            </div>
          ))}
        </div>
      </section>

      <section id="safety" className="px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-5xl rounded-lg border border-teal-100 bg-gradient-to-br from-white to-teal-50 p-8 shadow-2xl shadow-teal-900/10 sm:p-12">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-teal-700">{t("safetyEyebrow")}</p>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">{t("safetyTitle")}</h2>
          <p className="mt-5 text-lg leading-8 text-slate-700">
            {t("safetyDescription")}
          </p>
          <Link href="/intake" className="mt-8 inline-flex rounded-lg bg-slate-950 px-8 py-4 font-black text-white shadow-xl shadow-slate-950/20 transition hover:-translate-y-1 hover:bg-teal-700">
            {t("safetyStartButton")}
          </Link>
        </div>
      </section>
    </>
  );
}