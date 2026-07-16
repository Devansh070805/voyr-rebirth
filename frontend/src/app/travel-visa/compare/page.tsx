"use client";

import { useState, useMemo } from "react";
import { PiArrowRightBold, PiFlagFill, PiGlobeFill, PiIdentificationCardFill } from "react-icons/pi";
import Link from "next/link";
import { useApi } from "../../auth/context";
import VisaStatusBadge from "../../components/VisaStatusBadge";
import type { VisaStatus } from "../../components/VisaStatusBadge";

type Country = { iso_code: string; name: string; flag_emoji: string | null };

type CompareResult = {
  destination_country: Country;
  visa_status: VisaStatus;
  visa_status_label: string;
  max_stay_days: number | null;
  requires_action: boolean;
};

type MultiResult = {
  passport_country: Country;
  results: CompareResult[];
  summary: {
    visa_free_count: number;
    visa_required_count: number;
    eta_required_count: number;
    visa_on_arrival_count: number;
    action_needed: string[];
  };
};

const POPULAR_DESTINATIONS = [
  { code: "TH", name: "Thailand" },
  { code: "VN", name: "Vietnam" },
  { code: "MY", name: "Malaysia" },
  { code: "SG", name: "Singapore" },
  { code: "ID", name: "Indonesia" },
  { code: "AE", name: "UAE" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "TR", name: "Turkey" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "US", name: "USA" },
  { code: "GB", name: "UK" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "IT", name: "Italy" },
];

const COMMON_PASSPORTS = [
  { code: "IN", name: "India" },
  { code: "US", name: "USA" },
  { code: "GB", name: "UK" },
  { code: "AE", name: "UAE" },
  { code: "CN", name: "China" },
];

export default function ComparePage() {
  const { apiFetch } = useApi();
  const [passport, setPassport] = useState("IN");
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<MultiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDestination = (code: string) => {
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : prev.length < 6 ? [...prev, code] : prev
    );
  };

  const handleCompare = async () => {
    if (selected.length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/travel-visa/check-multiple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passport_country: passport,
          destinations: selected,
          purpose: "tourism",
        }),
      });
      if (!res.ok) throw new Error("Comparison failed");
      setResult(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const sortedResults = useMemo(() => {
    if (!result) return [];
    return [...result.results].sort((a, b) => {
      const order: Record<string, number> = { visa_free: 0, visa_on_arrival: 1, evisa_available: 2, eta_required: 3, visa_required: 4 };
      return (order[a.visa_status] ?? 5) - (order[b.visa_status] ?? 5);
    });
  }, [result]);

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <Link href="/" className="flex items-center gap-3">
            <img src="/images/Voyr-logo.png" alt="Voyr" className="h-9 w-auto" />
            <div>
              <div className="text-xl font-bold tracking-tight text-slate-950">Voyr</div>
              <div className="text-xs font-medium text-slate-500">Visa Comparison</div>
            </div>
          </Link>
          <nav className="flex items-center gap-3 text-xs font-medium text-slate-700 flex-wrap justify-end">
            <Link className="hover:text-violet-600 transition-colors" href="/travel-visa">Single Check</Link>
            <Link className="text-violet-600" href="/travel-visa/compare">Compare</Link>
            <Link className="hover:text-violet-600 transition-colors" href="/chat">AI Planner</Link>
            <Link className="hover:text-violet-600 transition-colors" href="/trips">My Trips</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-10">
        <div className="mb-6 text-center animate-slide-up-sm" style={{ animationDelay: '0ms' }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-violet-600 sm:text-xs">Visa Tools</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">Compare Visa Requirements</h1>
          <p className="mt-2 text-sm text-slate-500">Select up to 6 destinations to compare visa rules side-by-side</p>
        </div>

        <div className="mb-8 animate-slide-up-sm" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center gap-3 mb-4">
            <PiIdentificationCardFill className="h-5 w-5 text-violet-600" />
            <span className="font-bold text-slate-800">Your Passport:</span>
            <div className="flex flex-wrap gap-2">
              {COMMON_PASSPORTS.map((p) => (
                <button
                  key={p.code}
                  onClick={() => { setPassport(p.code); setResult(null); }}
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-150 active:scale-[0.97] ${
                    passport === p.code ? "border-violet-300 bg-violet-50 text-violet-700 shadow-sm" : "border-slate-200 hover:border-violet-200 hover:shadow-sm"
                  }`}
                >
                  <PiFlagFill className="mr-1 inline-block h-4 w-4 text-violet-500" /> {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-3 mb-4">
            <PiGlobeFill className="h-5 w-5 text-sky-600 mt-1" />
            <div className="flex-1">
              <span className="font-bold text-slate-800">Destinations:</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {POPULAR_DESTINATIONS.map((d) => {
                  const isSelected = selected.includes(d.code);
                  return (
                    <button
                      key={d.code}
                      onClick={() => toggleDestination(d.code)}
                      className={`rounded-xl border px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.97] ${
                        isSelected
                          ? "border-violet-300 bg-violet-50 text-violet-700 shadow-sm"
                          : "border-slate-200 hover:border-violet-200 hover:bg-slate-50 hover:shadow-sm"
                      }`}
                    >
                      <PiFlagFill className="mr-1 inline-block h-4 w-4 text-violet-500" /> {d.name}
                    </button>
                  );
                })}
              </div>
              {selected.length > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-slate-500">{selected.length} selected</span>
                  <button onClick={() => setSelected([])} className="text-xs text-rose-500 hover:text-rose-600">Clear all</button>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleCompare}
            disabled={selected.length < 2 || loading}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200 transition-all duration-150 hover:bg-violet-700 hover:shadow-xl active:scale-[0.97] disabled:opacity-40 disabled:hover:shadow-lg disabled:active:scale-100"
          >
            {loading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-[3px] border-white border-t-transparent" />
            ) : (
              <PiArrowRightBold className="h-4 w-4" />
            )}
            {loading ? "Checking..." : `Compare ${selected.length} Destination${selected.length > 1 ? "s" : ""}`}
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600 animate-shake">{error}</div>
        )}

        {result && (
          <div className="animate-slide-up-sm" style={{ animationDelay: '200ms' }}>
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center animate-fade-in" style={{ animationDelay: '250ms' }}>
                <div className="text-2xl font-extrabold text-emerald-700">{result.summary.visa_free_count}</div>
                <div className="text-xs font-semibold text-emerald-600 mt-1">Visa Free</div>
              </div>
              <div className="rounded-xl bg-sky-50 border border-sky-200 p-4 text-center animate-fade-in" style={{ animationDelay: '300ms' }}>
                <div className="text-2xl font-extrabold text-sky-700">{result.summary.visa_on_arrival_count}</div>
                <div className="text-xs font-semibold text-sky-600 mt-1">On Arrival</div>
              </div>
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-center animate-fade-in" style={{ animationDelay: '350ms' }}>
                <div className="text-2xl font-extrabold text-blue-700">{result.summary.eta_required_count + result.summary.visa_required_count}</div>
                <div className="text-xs font-semibold text-blue-600 mt-1">Action Needed</div>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center animate-fade-in" style={{ animationDelay: '400ms' }}>
                <div className="text-2xl font-extrabold text-amber-700">{result.summary.action_needed.length}</div>
                <div className="text-xs font-semibold text-amber-600 mt-1">Need Application</div>
              </div>
              <div className="rounded-xl bg-violet-50 border border-violet-200 p-4 text-center animate-fade-in" style={{ animationDelay: '450ms' }}>
                <div className="text-2xl font-extrabold text-violet-700">{sortedResults.length}</div>
                <div className="text-xs font-semibold text-violet-600 mt-1">Total Compared</div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 sm:px-6 sm:py-4 text-left font-bold text-slate-700">Destination</th>
                    <th className="px-4 py-3 sm:px-6 sm:py-4 text-left font-bold text-slate-700">Visa Status</th>
                    <th className="px-4 py-3 sm:px-6 sm:py-4 text-left font-bold text-slate-700">Max Stay</th>
                    <th className="px-4 py-3 sm:px-6 sm:py-4 text-left font-bold text-slate-700">Action Needed</th>
                    <th className="px-4 py-3 sm:px-6 sm:py-4 text-center font-bold text-slate-700">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((r, idx) => (
                    <tr key={r.destination_country.iso_code} className="border-b border-slate-100 hover:bg-slate-50 transition-colors duration-150 animate-fade-in" style={{ animationDelay: `${500 + idx * 80}ms` }}>
                      <td className="px-4 py-3 sm:px-6 sm:py-4">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <PiFlagFill className="h-5 w-5 shrink-0 text-violet-500" />
                          <span className="text-sm font-semibold text-slate-800">{r.destination_country.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4">
                        <VisaStatusBadge status={r.visa_status} size="sm" />
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 text-sm text-slate-600">
                        {r.max_stay_days ? `${r.max_stay_days} days` : "—"}
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4">
                        {r.requires_action ? (
                          <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">Yes</span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3 sm:px-6 sm:py-4 text-center">
                        <a
                          href={`/travel-visa/${r.destination_country.iso_code}`}
                          className="text-xs font-semibold text-violet-600 hover:text-violet-700 transition-colors"
                        >
                          View →
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!result && !loading && !error && (
          <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 animate-scale-in">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 animate-pulse-soft">
                <PiGlobeFill className="h-6 w-6 text-violet-600" />
              </div>
              <p className="mt-4 text-sm text-slate-500">Select 2-6 destinations and click Compare</p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
