"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../auth/context";
import { PiSignOutBold } from "react-icons/pi";

const NAV = [
  { href: "/partner/dashboard", label: "Dashboard" },
  { href: "/partner/chat", label: "Plan trips" },
  { href: "/partner/bookings", label: "Bookings" },
];

function navActive(pathname: string, href: string) {
  return pathname === href || (href !== "/partner/dashboard" && pathname.startsWith(href));
}

export default function PartnerShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, partner, logout } = useAuth();

  return (
    <main className="min-h-screen bg-slate-50 font-sans text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-3 lg:px-10">
          <Link href="/partner" className="flex items-center gap-3">
            <img src="/images/Voyr-logo.png" alt="Voyr" className="h-9 w-auto" />
            <div>
              <div className="text-xl font-bold tracking-tight text-slate-950">Voyr</div>
              <div className="text-xs font-medium text-slate-500">B2B Partner Portal</div>
            </div>
          </Link>
          <nav className="flex flex-wrap items-center gap-4 text-sm font-medium">
            {NAV.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={
                  navActive(pathname, href)
                    ? "font-bold text-violet-600"
                    : "text-slate-500 hover:text-violet-600"
                }
              >
                {label}
              </Link>
            ))}
            <Link href="/" className="text-slate-500 hover:text-violet-600">
              Consumer site
            </Link>
            {partner && (
              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
                {partner.name}
              </span>
            )}
            {user?.email && (
              <span className="hidden text-slate-400 sm:inline">{user.email}</span>
            )}
            <button
              type="button"
              onClick={() => logout()}
              className="flex items-center gap-1 text-slate-500 hover:text-violet-600"
            >
              <PiSignOutBold className="h-4 w-4" /> Sign out
            </button>
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
