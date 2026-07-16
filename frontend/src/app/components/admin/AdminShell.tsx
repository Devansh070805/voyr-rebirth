"use client";

import Link from "next/link";

export type AdminSection = "visa" | "ops" | "listings" | "pricing" | "partners";

const SECTION_BADGE: Record<AdminSection, { label: string; className: string }> = {
  visa: { label: "Visa", className: "bg-amber-100 text-amber-700" },
  ops: { label: "Ops", className: "bg-rose-100 text-rose-700" },
  listings: { label: "Listings", className: "bg-violet-100 text-violet-700" },
  pricing: { label: "Pricing", className: "bg-emerald-100 text-emerald-700" },
  partners: { label: "B2B", className: "bg-violet-100 text-violet-700" },
};

export default function AdminShell({
  section,
  title,
  subtitle,
  children,
}: {
  section: AdminSection;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const badge = SECTION_BADGE[section];

  return (
    <main className="min-h-screen bg-slate-50 font-sans text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-3 lg:px-10">
          <Link href="/" className="flex items-center gap-3">
            <img src="/images/Voyr-logo.png" alt="Voyr" className="h-9 w-auto" />
            <div>
              <div className="text-xl font-bold tracking-tight text-slate-950">Voyr</div>
              <div className="text-xs font-medium text-slate-500">Admin</div>
            </div>
          </Link>
          <nav className="flex flex-wrap items-center gap-4 text-sm font-medium">
            <Link
              href="/travel-visa/admin"
              className={
                section === "visa"
                  ? "font-bold text-violet-600"
                  : "text-slate-500 hover:text-violet-600"
              }
            >
              Visa data
            </Link>
            <Link
              href="/admin/listings"
              className={
                section === "listings"
                  ? "font-bold text-violet-600"
                  : "text-slate-500 hover:text-violet-600"
              }
            >
              Listings
            </Link>
            <Link
              href="/admin/pricing"
              className={
                section === "pricing"
                  ? "font-bold text-violet-600"
                  : "text-slate-500 hover:text-violet-600"
              }
            >
              Pricing
            </Link>
            <Link
              href="/admin/partners"
              className={
                section === "partners"
                  ? "font-bold text-violet-600"
                  : "text-slate-500 hover:text-violet-600"
              }
            >
              B2B partners
            </Link>
            <Link
              href="/admin/ops"
              className={
                section === "ops"
                  ? "font-bold text-violet-600"
                  : "text-slate-500 hover:text-violet-600"
              }
            >
              Operations
            </Link>
            <Link href="/travel-visa" className="text-slate-500 hover:text-violet-600">
              Visa checker
            </Link>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${badge.className}`}>
              {badge.label}
            </span>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-950">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        {children}
      </div>
    </main>
  );
}
