"use client";

import Link from "next/link";
import PartnerGate from "../../components/partner/PartnerGate";
import PartnerShell from "../../components/partner/PartnerShell";
import { useAuth } from "../../auth/context";
import { PiChatCircleDotsFill, PiReceiptFill, PiTrendDownFill } from "react-icons/pi";

export default function PartnerDashboardPage() {
  const { partner, customerSegment } = useAuth();

  return (
    <PartnerGate>
      <PartnerShell
        title="Partner dashboard"
        subtitle={
          partner
            ? `Signed in as ${partner.name} (${partner.company_code}) · ${customerSegment.toUpperCase()} rates`
            : undefined
        }
      >
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/partner/chat"
            className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50 transition hover:border-violet-200 hover:shadow-md"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
              <PiChatCircleDotsFill className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-950">Plan a trip</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Use the AI travel planner with B2B wholesale rates applied to all options.
            </p>
          </Link>

          <Link
            href="/partner/bookings"
            className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50 transition hover:border-violet-200 hover:shadow-md"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
              <PiReceiptFill className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-950">Bookings</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              View confirmed bookings and trip history for your partner account.
            </p>
          </Link>

          <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
              <PiTrendDownFill className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-950">Wholesale pricing</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Your account uses B2B margin rules — lower markups than the consumer site. Rates are
              set by Voyr admin in Pricing &amp; margins.
            </p>
          </div>
        </div>
      </PartnerShell>
    </PartnerGate>
  );
}
