"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { PiArrowLeftBold, PiClockFill, PiFileTextFill, PiFlagFill, PiGlobeFill, PiIdentificationCardFill,
  PiSealWarningFill, PiShieldCheckFill,
} from "react-icons/pi";
import Link from "next/link";
import VisaTimeline from "../../components/VisaTimeline";
import { useApi } from "../../auth/context";

interface Country {
  iso_code: string;
  name: string;
  flag_emoji: string | null;
  region: string | null;
  subregion: string | null;
  is_popular_destination: boolean;
  requires_eta: boolean;
  eta_url: string | null;
  official_visa_url: string | null;
  currency: string | null;
  languages: string[] | null;
}

interface VisaDocument {
  id: number;
  destination_country: string;
  visa_type: string;
  document_type: string;
  is_required: boolean;
  description: string | null;
  notes: string | null;
  sort_order: number;
}

interface VisaFee {
  id: number;
  destination_country: string;
  visa_type: string;
  fee_amount: number | null;
  fee_currency: string;
  processing_time_days_min: number | null;
  processing_time_days_max: number | null;
  notes: string | null;
}

export default function DestinationVisaClient() {
  const { apiFetch } = useApi();
  const params = useParams();
  const destinationCode = params.destination as string;

  const [country, setCountry] = useState<Country | null>(null);
  const [documents, setDocuments] = useState<VisaDocument[]>([]);
  const [fees, setFees] = useState<VisaFee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await apiFetch(`/travel-visa/destinations/${destinationCode}`);
        if (!res.ok) throw new Error("Country not found");

        const data = await res.json();
        setCountry(data.country);
        setDocuments(data.documents || []);
        setFees(data.fees || []);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    if (destinationCode) {
      fetchData();
    }
  }, [destinationCode, apiFetch]);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
          <p className="mt-4 text-sm text-slate-500">Loading destination info...</p>
        </div>
      </main>
    );
  }

  if (error || !country) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
            <PiSealWarningFill className="h-6 w-6 text-rose-600" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-950">Destination Not Found</h2>
          <p className="mt-2 text-sm text-slate-500">{error || "Unable to load destination info"}</p>
          <Link
            href="/travel-visa"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white"
          >
            <PiArrowLeftBold className="h-4 w-4" />
            Back to Visa Checker
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <Link href="/" className="flex items-center gap-3">
            <img src="/images/Voyr-logo.png" alt="Voyr" className="h-9 w-auto" />
            <div>
              <div className="text-xl font-bold tracking-tight text-slate-950">Voyr</div>
              <div className="text-xs font-medium text-slate-500">Travel Visa Assistant</div>
            </div>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-700 lg:flex">
            <Link className="hover:text-violet-600" href="/travel-visa">Visa Check</Link>
            <Link className="hover:text-violet-600" href="/chat">AI Planner</Link>
            <Link className="hover:text-violet-600" href="/trips">My Trips</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
          <Link href="/travel-visa" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-violet-600 mb-6">
            <PiArrowLeftBold className="h-4 w-4" />
            Back to Visa Checker
          </Link>
          <div className="flex items-center gap-4">
            <PiFlagFill className="h-10 w-10 text-violet-600" />
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 lg:text-4xl">
                {country.name}
              </h1>
              {country.region && (
                <p className="mt-1 text-sm text-slate-500">
                  {country.subregion ? `${country.subregion}, ` : ""}{country.region}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          {/* Main Content */}
          <div className="space-y-8">
            {/* Quick Info */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950 mb-4">Quick Information</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {country.currency && (
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Currency</p>
                    <p className="mt-1 text-lg font-bold text-slate-950">{country.currency}</p>
                  </div>
                )}
                {country.languages && country.languages.length > 0 && (
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Languages</p>
                    <p className="mt-1 text-lg font-bold text-slate-950">{country.languages.slice(0, 2).join(", ")}</p>
                  </div>
                )}
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">eTA Required</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">{country.requires_eta ? "Yes" : "No"}</p>
                </div>
              </div>
            </div>

            {/* Documents */}
            {documents.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-5">
                  <h2 className="text-lg font-bold text-slate-950">Required Documents</h2>
                  <p className="mt-1 text-sm text-slate-500">Documents typically needed for visa application</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {documents.map((doc) => (
                    <div key={doc.id} className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${doc.is_required ? "bg-amber-100" : "bg-slate-100"}`}>
                          {doc.is_required ? (
                            <PiFileTextFill className="h-3 w-3 text-amber-600" />
                          ) : (
                            <PiFileTextFill className="h-3 w-3 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-950">{doc.document_type}</span>
                            {doc.is_required ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">Required</span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">Optional</span>
                            )}
                          </div>
                          {doc.description && (
                            <p className="mt-1 text-sm text-slate-600">{doc.description}</p>
                          )}
                          {doc.notes && (
                            <p className="mt-1 text-xs text-slate-400">{doc.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fees */}
            {fees.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-5">
                  <h2 className="text-lg font-bold text-slate-950">Visa Fees & Processing Time</h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {fees.map((fee) => (
                    <div key={fee.id} className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-950">{fee.visa_type}</span>
                        {fee.fee_amount && (
                          <span className="text-lg font-bold text-violet-600">
                            {fee.fee_currency} {fee.fee_amount.toLocaleString()}
                          </span>
                        )}
                      </div>
                      {(fee.processing_time_days_min || fee.processing_time_days_max) && (
                        <p className="mt-1 text-sm text-slate-500">
                          Processing time: {fee.processing_time_days_min || "?"}-{fee.processing_time_days_max || "?"} days
                        </p>
                      )}
                      {fee.notes && (
                        <p className="mt-1 text-xs text-slate-400">{fee.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Visa Processing Timeline */}
            {fees.length > 0 && fees[0].visa_type && (
              <VisaTimeline
                visaType={fees[0].visa_type}
                processingMin={fees[0].processing_time_days_min}
                processingMax={fees[0].processing_time_days_max}
                feeAmount={fees[0].fee_amount}
                feeCurrency={fees[0].fee_currency}
              />
            )}

          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Official Links */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-bold text-slate-950 mb-4">Official Resources</h3>
              <div className="space-y-3">
                {country.official_visa_url && (
                  <a
                    href={country.official_visa_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-700"
                  >
                    <PiGlobeFill className="h-5 w-5" />
                    Official Visa Portal
                  </a>
                )}
                {country.eta_url && (
                  <a
                    href={country.eta_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <PiClockFill className="h-5 w-5 text-violet-600" />
                    Apply for eTA
                  </a>
                )}
              </div>
            </div>

            {/* Check Visa */}
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-6">
              <h3 className="font-bold text-slate-950 mb-2">Check Your Requirements</h3>
              <p className="text-sm text-slate-600 mb-4">
                Select your passport country to see specific visa requirements for {country.name}.
              </p>
              <Link
                href={`/travel-visa?destination=${country.iso_code}`}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-700"
              >
                <PiIdentificationCardFill className="h-5 w-5" />
                Check Visa Requirements
              </Link>
            </div>

            {/* Disclaimer */}
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="flex gap-3">
                <PiShieldCheckFill className="h-5 w-5 shrink-0 text-slate-400 mt-0.5" />
                <p className="text-xs text-slate-500">
                  Information is provided for reference only. Always verify with official government sources before traveling.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
