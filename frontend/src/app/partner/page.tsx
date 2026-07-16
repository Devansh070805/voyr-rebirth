"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth/context";
import { PiBriefcaseFill, PiArrowRightBold, PiShieldCheckFill, PiChatCircleDotsFill } from "react-icons/pi";

export default function PartnerLandingPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, hasB2BAccess } = useAuth();

  if (!isLoading && isAuthenticated && hasB2BAccess) {
    router.replace("/partner/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 lg:px-10">
          <Link href="/partner" className="flex items-center gap-3">
            <img src="/images/Voyr-logo.png" alt="Voyr" className="h-12 w-auto" />
            <div>
              <div className="text-2xl font-bold tracking-tight text-slate-950">Voyr</div>
              <div className="text-xs font-medium text-slate-500">B2B Partner Portal</div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Consumer site
            </Link>
            <Link
              href="/login?returnUrl=/partner/dashboard"
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-200 hover:bg-violet-700"
            >
              Partner sign in
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-slate-100">
          <div className="absolute inset-x-0 top-0 h-[159.72%]">
            <img
              src="/images/hero-section-background.jpg"
              alt=""
              aria-hidden
              className="h-full w-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-white/40" />
          </div>
          <div className="relative mx-auto max-w-7xl px-6 pt-24 pb-[9.583rem] lg:px-10 lg:pt-32 lg:pb-[12.778rem]">
            <div className="max-w-2xl">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-violet-100 px-4 py-1.5 text-sm font-semibold text-violet-700">
                <PiBriefcaseFill className="h-4 w-4" />
                Wholesale travel for agencies &amp; partners
              </p>
              <h1 className="text-4xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-5xl md:text-6xl">
                Partner rates,
                <span className="block bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                  same Voyr experience
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-700">
                Approved B2B partners get wholesale pricing with lower margins — admin-controlled
                access, the same AI planner, and a dedicated portal for your team.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  href="/login?returnUrl=/partner/dashboard"
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-200 hover:bg-violet-700"
                >
                  Partner sign in <PiArrowRightBold className="h-4 w-4" />
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Plan as a consumer
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10">
          <div className="text-center">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-violet-600">
              For travel partners
            </p>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-950">How B2B access works</h2>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {[
              {
                icon: PiShieldCheckFill,
                title: "Admin-managed access",
                body: "Only Voyr admins can grant or revoke partner portal access.",
              },
              {
                icon: PiBriefcaseFill,
                title: "B2B margin rules",
                body: "Wholesale pricing uses separate margin rules configured in admin pricing.",
              },
              {
                icon: PiChatCircleDotsFill,
                title: "Same AI planner",
                body: "Partners use the same trip planner with B2B rates applied automatically.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-950">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
