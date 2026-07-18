"use client";

import { useEffect, useState } from "react";
import { PiXBold, PiMapPinFill, PiStarFill, PiArrowSquareOutFill, PiWarningCircleFill, PiInfoFill } from "react-icons/pi";

interface OTARate {
  code: string;
  name: string;
  rate: number;
}

interface HeatmapData {
  average_price_days: string[];
  cheap_price_days: string[];
  high_price_days: string[];
}

interface HotelDetails {
  rates: OTARate[];
  heatmap: HeatmapData | null;
}

interface HotelDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  hotel: {
    name: string;
    image?: string;
    location?: string;
    category: string;
    rating: number;
    hotel_key?: string;
    currency: string;
    url?: string;
  } | null;
}

const OTA_COLORS: Record<string, string> = {
  HotelsCom2: "bg-red-50 text-red-700",
  Expedia: "bg-blue-50 text-blue-700",
  BookingCom: "bg-indigo-50 text-indigo-700",
  Agoda: "bg-orange-50 text-orange-700",
  Priceline: "bg-sky-50 text-sky-700",
};

export default function HotelDetailsModal({ isOpen, onClose, hotel }: HotelDetailsModalProps) {
  const [details, setDetails] = useState<HotelDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && hotel?.hotel_key) {
      setLoading(true);
      setError("");
      setDetails(null);

      const fetchDetails = async () => {
        try {
          const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "/api";
          const res = await fetch(`${apiBaseUrl}/hotels/details/${hotel.hotel_key}`);
          if (!res.ok) throw new Error("Failed to load details");
          const data = await res.json();
          setDetails(data);
        } catch (err) {
          setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
          setLoading(false);
        }
      };

      fetchDetails();
    }
  }, [isOpen, hotel?.hotel_key]);

  if (!hotel) return null;

  const formatRate = (rate: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: hotel.currency, maximumFractionDigits: 0 }).format(rate);

  // Heatmap generation
  const today = new Date();
  const next30Days = Array.from({ length: 30 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d.toISOString().split("T")[0]; // YYYY-MM-DD
  });

  const getDayStatus = (dateStr: string) => {
    if (!details?.heatmap) return "unknown";
    if (details.heatmap.cheap_price_days.includes(dateStr)) return "cheap";
    if (details.heatmap.average_price_days.includes(dateStr)) return "average";
    if (details.heatmap.high_price_days.includes(dateStr)) return "high";
    return "unknown";
  };

  const statusColors = {
    cheap: "bg-emerald-100 text-emerald-700 border-emerald-200",
    average: "bg-amber-100 text-amber-700 border-amber-200",
    high: "bg-red-100 text-red-700 border-red-200",
    unknown: "bg-slate-50 text-slate-400 border-slate-100",
  };

  const statusLabels = {
    cheap: "Best Value",
    average: "Average",
    high: "High Demand",
    unknown: "No Data",
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex min-h-full items-center justify-center p-4 text-center">
        <div className="w-full max-w-5xl transform overflow-hidden rounded-2xl bg-white text-left align-middle shadow-2xl transition-all relative">
          {/* Hero Image */}
          <div className="relative h-64 w-full bg-slate-100">
            {hotel.image ? (
              <img src={hotel.image} alt={hotel.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400">No image available</div>
            )}
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full bg-black/20 p-2 text-white backdrop-blur-md transition-colors hover:bg-black/40 z-10"
            >
              <PiXBold className="h-5 w-5" />
            </button>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 pt-12">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-violet-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-sm">
                  {hotel.category}
                </span>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: Math.min(5, Math.round(hotel.rating || 4)) }).map((_, i) => (
                    <PiStarFill key={i} className="h-4 w-4 text-amber-400" />
                  ))}
                </div>
              </div>
              <h3 className="mt-2 text-2xl font-bold leading-tight text-white">
                {hotel.name}
              </h3>
              {hotel.location && (
                <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-200">
                  <PiMapPinFill className="h-4 w-4 shrink-0 text-violet-400" /> {hotel.location}
                </p>
              )}
            </div>
          </div>

                <div className="p-6">
                  {/* Content Grid */}
                  <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                    
                    {/* Left Column: Live Rates */}
                    <div>
                      <h4 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                        <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                        Live OTA Rates
                      </h4>
                      <p className="mt-1 text-xs text-slate-500">Real-time prices from top booking sites</p>

                      <div className="mt-4 space-y-3">
                        {loading && (
                          <div className="space-y-2">
                            {[1, 2, 3].map((i) => (
                              <div key={i} className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
                            ))}
                          </div>
                        )}
                        {error && (
                          <div className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-600">
                            <PiWarningCircleFill className="h-5 w-5 shrink-0" /> {error}
                          </div>
                        )}
                        {!loading && !error && details?.rates && details.rates.length > 0 ? (
                          details.rates.sort((a, b) => a.rate - b.rate).map((rate, idx) => (
                            <div key={rate.code} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 shadow-sm transition-colors hover:border-violet-100 hover:bg-violet-50/50">
                              <span className={`rounded-md px-2 py-1 text-xs font-bold ${OTA_COLORS[rate.code] || "bg-slate-100 text-slate-700"}`}>
                                {rate.name}
                              </span>
                              <div className="text-right">
                                <div className="text-sm font-bold text-slate-900">{formatRate(rate.rate)}</div>
                                {idx === 0 && <div className="text-[10px] font-bold uppercase text-emerald-600">Best Deal</div>}
                              </div>
                            </div>
                          ))
                        ) : (
                          !loading && <p className="text-sm text-slate-500">No live rates available.</p>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Heatmap */}
                    <div>
                      <h4 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                        Price Heatmap
                      </h4>
                      <p className="mt-1 text-xs text-slate-500">30-day forecast based on historical data</p>

                      <div className="mt-4">
                        {loading ? (
                          <div className="h-40 w-full animate-pulse rounded-xl bg-slate-100" />
                        ) : (
                          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                            <div className="flex flex-wrap gap-2">
                              {next30Days.map((dateStr) => {
                                const dateObj = new Date(dateStr);
                                const status = getDayStatus(dateStr);
                                const colorClass = statusColors[status as keyof typeof statusColors];
                                
                                return (
                                  <div
                                    key={dateStr}
                                    className={`flex h-12 w-10 flex-col items-center justify-center rounded-lg border ${colorClass} shadow-sm transition-transform hover:scale-110 cursor-default`}
                                    title={`${dateStr} - ${statusLabels[status as keyof typeof statusLabels]}`}
                                  >
                                    <span className="text-[10px] font-semibold uppercase opacity-60">
                                      {dateObj.toLocaleDateString("en-US", { weekday: "short" })}
                                    </span>
                                    <span className="text-sm font-bold leading-none">
                                      {dateObj.getDate()}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            
                            {/* Heatmap Legend */}
                            <div className="mt-4 flex items-center justify-center gap-4 border-t border-slate-200 pt-3">
                              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                                <div className="h-2.5 w-2.5 rounded-sm bg-emerald-400" /> Cheap
                              </div>
                              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                                <div className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Avg
                              </div>
                              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                                <div className="h-2.5 w-2.5 rounded-sm bg-red-400" /> High
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <PiInfoFill className="h-4 w-4" /> Data provided by Xotelo
                    </div>
                    {hotel.url && (
                      <a
                        href={hotel.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-slate-800"
                      >
                        View on TripAdvisor <PiArrowSquareOutFill className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
      </div>
    </div>
  );
}
