"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  PiAirplaneTiltFill,
  PiArrowRightBold,
  PiCheckCircleFill,
  PiClockFill,
  PiFlagFill,
  PiGlobeFill,
  PiMagnifyingGlassBold,
  PiIdentificationCardFill,
  PiSealWarningFill,
  PiShieldCheckFill,
  PiWarningCircleFill,
} from "react-icons/pi";
import Link from "next/link";
import CorrectionForm from "../components/CorrectionForm";
import { useApi } from "../auth/context";

import type { VisaStatus, VisaCheckResponse } from "@voyr/shared";

const ANIMATION_BASE = 400;
const ANIMATION_STEP = 100;
function stagger(delays: number, offset = 0): string {
  return `${ANIMATION_BASE + delays * ANIMATION_STEP + offset}ms`;
}

// Visa status styling
const VISA_STATUS_STYLES: Record<VisaStatus, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
  visa_free: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    icon: <PiCheckCircleFill className="h-5 w-5" />,
  },
  visa_on_arrival: {
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
    icon: <PiAirplaneTiltFill className="h-5 w-5" />,
  },
  eta_required: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-200",
    icon: <PiClockFill className="h-5 w-5" />,
  },
  evisa_available: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    icon: <PiGlobeFill className="h-5 w-5" />,
  },
  visa_required: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    icon: <PiIdentificationCardFill className="h-5 w-5" />,
  },
  visa_free_restricted: {
    bg: "bg-lime-50",
    text: "text-lime-700",
    border: "border-lime-200",
    icon: <PiCheckCircleFill className="h-5 w-5" />,
  },
  admission_refused: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    icon: <PiSealWarningFill className="h-5 w-5" />,
  },
  covid_ban: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    icon: <PiWarningCircleFill className="h-5 w-5" />,
  },
  unknown: {
    bg: "bg-slate-50",
    text: "text-slate-700",
    border: "border-slate-200",
    icon: <PiWarningCircleFill className="h-5 w-5" />,
  },
};

// Popular destinations for quick selection

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
  { code: "SA", name: "Saudi Arabia" },
];

export default function TravelVisaPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-sm font-semibold text-slate-400">Loading visa checker...</div>}>
      <TravelVisaContent />
    </Suspense>
  );
}

function TravelVisaContent() {
  const { apiFetch } = useApi();
  const searchParams = useSearchParams();
  const [passportCountry, setPassportCountry] = useState("IN");
  const [destinationCountry, setDestinationCountry] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [visaResult, setVisaResult] = useState<VisaCheckResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckVisa = async (destination: string) => {
    if (!passportCountry || !destination) {
      setError("Please select both passport and destination countries");
      return;
    }

    setIsLoading(true);
    setError(null);
    setDestinationCountry(destination);

    try {
      const res = await apiFetch("/travel-visa/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passport_country: passportCountry,
          destination_country: destination,
          purpose: "tourism",
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error?.message || "Visa check failed");
      }

      setVisaResult(await res.json());
    } catch (err) {
      setError((err as Error).message);
      setVisaResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-check visa when destination param is passed via URL
  useEffect(() => {
    const destParam = searchParams.get("destination");
    if (destParam) {
      handleCheckVisa(destParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter countries based on search
  const filteredDestinations = useMemo(() => {
    if (!searchQuery) return POPULAR_DESTINATIONS;
    const query = searchQuery.toLowerCase();
    return POPULAR_DESTINATIONS.filter(
      (c) => c.name.toLowerCase().includes(query) || c.code.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const statusStyle = visaResult ? VISA_STATUS_STYLES[visaResult.visa_status] : null;

  return (
    <main className="flex min-h-screen flex-col bg-white text-slate-950">
      {/* Header */}
      <header className="shrink-0 border-b border-slate-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2 lg:px-10">
          <Link href="/" className="flex items-center gap-2">
            <img src="/images/Voyr-logo.png" alt="Voyr" className="h-8 w-auto" />
            <span className="text-base font-bold tracking-tight text-slate-950">Voyr</span>
          </Link>
          <nav className="flex items-center gap-3 text-xs font-medium text-slate-700 flex-wrap justify-end">
            <Link className="text-violet-600" href="/travel-visa">Single Check</Link>
            <Link className="hover:text-violet-600 transition-colors" href="/travel-visa/compare">Compare</Link>
            <Link className="hover:text-violet-600 transition-colors" href="/chat">AI Planner</Link>
            <Link className="hover:text-violet-600 transition-colors" href="/trips">My Trips</Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col overflow-hidden px-4 pb-4 sm:px-6 lg:px-10">
        <div className="shrink-0 py-3 sm:py-4 animate-slide-up-sm" style={{ animationDelay: '0ms' }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-violet-600 sm:text-xs">Free Visa Checker</p>
          <h1 className="mt-1 text-base font-extrabold tracking-tight text-slate-950 sm:text-lg md:text-xl">
            Check Your Visa Requirements Instantly
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Select your passport and destination to see visa requirements, processing times, and official sources.
          </p>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-hidden md:flex-row md:gap-4">
           <div className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto pb-2 md:w-[340px] animate-slide-up-sm" style={{ animationDelay: '100ms' }}>
              {/* Passport Selection */}
              <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <h2 className="mb-2 text-xs font-semibold text-slate-950">Your Passport</h2>
                <div className="grid grid-cols-2 gap-1.5">
                  {COMMON_PASSPORTS.map((country) => (
                    <button
                      key={country.code}
                      onClick={() => setPassportCountry(country.code)}
                      className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-xs font-medium transition-all duration-150 active:scale-[0.97] ${
                        passportCountry === country.code
                          ? "border-violet-300 bg-violet-50 text-violet-700 shadow-sm"
                          : "border-slate-200 hover:border-violet-200 hover:bg-slate-50 hover:shadow-sm"
                      }`}
                    >
                      <PiFlagFill className="h-4 w-4 shrink-0 text-violet-400" />
                      <span className="text-xs">{country.name}</span>
                    </button>
                  ))}
               </div>
             </div>

              {/* Destination Selection */}
              <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm flex-1 flex flex-col min-h-0">
                <h2 className="mb-2 text-xs font-semibold text-slate-950">Destination</h2>
                
                {/* Search */}
                <div className="relative mb-2">
                  <PiMagnifyingGlassBold className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search destinations..."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs outline-none transition focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-200"
                  />
                </div>

                {/* Destination Grid */}
                <div className="grid grid-cols-2 gap-1.5 overflow-y-auto">
                  {filteredDestinations.map((country) => (
                    <button
                      key={country.code}
                      onClick={() => handleCheckVisa(country.code)}
                      disabled={isLoading}
                      className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-xs font-medium transition-all duration-150 active:scale-[0.97] ${
                        destinationCountry === country.code
                          ? "border-violet-300 bg-violet-50 text-violet-700 shadow-sm"
                          : "border-slate-200 hover:border-violet-200 hover:bg-slate-50 hover:shadow-sm"
                      } ${isLoading ? "opacity-50 cursor-wait" : ""}`}
                    >
                      <PiFlagFill className="h-4 w-4 shrink-0 text-violet-400" />
                      <span className="truncate text-xs">{country.name}</span>
                    </button>
                  ))}
                </div>
            </div>
          </div>

           {/* Right Panel - Results */}
           <div className="flex flex-1 flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm min-h-[300px] md:min-h-0 animate-fade-in" style={{ animationDelay: '200ms' }}>
              {isLoading ? (
                <div className="flex flex-1 items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-[3px] border-violet-100 border-t-violet-600" />
                    <p className="mt-3 text-xs text-slate-500 animate-pulse-soft">Checking visa requirements...</p>
                  </div>
                </div>
             ) : error ? (
                <div className="flex flex-1 items-center justify-center p-4 animate-shake">
                  <div className="text-center">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-rose-100">
                      <PiSealWarningFill className="h-5 w-5 text-rose-600" />
                    </div>
                    <h3 className="mt-3 text-sm font-bold text-slate-950">Unable to Check</h3>
                    <p className="mt-1 text-xs text-slate-500">{error}</p>
                  </div>
                </div>
              ) : visaResult ? (
                <div className="flex flex-col gap-3 p-4 overflow-y-auto animate-slide-up-sm" style={{ animationDelay: '100ms' }}>
                  {/* Status Header */}
                  <div className={`rounded-lg ${statusStyle?.bg} ${statusStyle?.border} border p-3 animate-fade-in`} style={{ animationDelay: '150ms' }}>
                    <div className="flex items-start gap-2">
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${statusStyle?.text}`}
                      >
                        {statusStyle?.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <PiFlagFill className="h-6 w-6 shrink-0 text-violet-500" />
                          <h2 className="text-xl font-bold text-slate-950 truncate">
                            {visaResult.destination_country.name}
                          </h2>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full ${statusStyle?.bg} ${statusStyle?.text} ${statusStyle?.border} border px-3 py-1 text-xs font-bold`}>
                            {visaResult.visa_status_label}
                          </span>
                          {visaResult.max_stay_label && (
                            <span className="text-sm text-slate-600">
                              Up to <strong>{visaResult.max_stay_label}</strong>
                            </span>
                          )}
                          {visaResult.visa_type && (
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 border border-slate-200">
                              {visaResult.visa_type}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {visaResult.notes && (
                    <div className="rounded-lg bg-slate-50 p-3 animate-fade-in" style={{ animationDelay: '250ms' }}>
                      <p className="text-sm text-slate-600">{visaResult.notes}</p>
                    </div>
                  )}

                  {/* Recommendations */}
                  <div className="animate-fade-in" style={{ animationDelay: '350ms' }}>
                    <h3 className="mb-2 text-base font-semibold text-slate-950">What You Need to Do</h3>
                    <ul className="space-y-2">
                      {visaResult.recommendations.map((rec, idx) => (                          <li key={idx} className="flex items-start gap-3 text-sm text-slate-600 animate-slide-up-sm" style={{ animationDelay: stagger(idx) }}>
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-600">
                            {idx + 1}
                          </span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Official Source */}
                  {visaResult.official_source_url && (
                    <div className="animate-fade-in" style={{ animationDelay: stagger(visaResult.recommendations?.length || 0, 100) }}>
                      <a
                        href={visaResult.official_source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="group inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all duration-150 hover:bg-violet-700 hover:shadow-lg active:scale-[0.97]"
                      >
                        Visit Official Portal
                        <PiArrowRightBold className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
                      </a>
                    </div>
                  )}

                  {/* Last Verified */}
                  {visaResult.last_verified && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 animate-fade-in" style={{ animationDelay: stagger(visaResult.recommendations?.length || 0, 250) }}>
                      <PiShieldCheckFill className="h-4 w-4" />
                      Last verified: {new Date(visaResult.last_verified).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                    </div>
                  )}

                  {/* Correction Form */}
                  <div className="border-t border-slate-100 pt-4 animate-fade-in" style={{ animationDelay: stagger(visaResult.recommendations?.length || 0, 400) }}>
                    <CorrectionForm
                      passportCountry={visaResult.passport_country.iso_code}
                      destinationCountry={visaResult.destination_country.iso_code}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center p-4 sm:p-6 animate-scale-in">
                  <div className="text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 animate-pulse-soft">
                      <PiGlobeFill className="h-6 w-6 text-violet-600" />
                    </div>
                    <h3 className="mt-3 text-sm font-bold text-slate-950">Select a Destination</h3>
                    <p className="mt-1 text-xs text-slate-500 max-w-xs mx-auto">
                      Choose your destination country to see visa requirements for your passport
                    </p>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    </main>
  );
}
