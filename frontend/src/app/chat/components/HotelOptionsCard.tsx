"use client";

import { useState } from "react";
import { PiStarFill, PiMapPinFill, PiBuildingsFill, PiArrowSquareOutFill, PiTagFill } from "react-icons/pi";
import OptionCardShell from "./cards/OptionCardShell";
import SelectButton from "./cards/SelectButton";
import HotelDetailsModal from "./HotelDetailsModal";
import { optionKey, type CuratedOptionMeta } from "./cards/option-utils";

interface OTARate {
  code: string;
  name: string;
  rate: number;
}

interface HotelOption extends CuratedOptionMeta {
  name: string;
  category: string;
  price_per_night: number;
  currency: string;
  rating: number;
  highlights: string[];
  location?: string;
  hotel_id?: number;
  vendor?: string;
  hotel_key?: string;
  image?: string;
  url?: string;
  rates?: OTARate[];
}

interface HotelOptionsCardProps {
  destination: string;
  options: HotelOption[];
  onSelect?: (hotel: HotelOption) => void;
  selectedId?: string;
  selectingId?: string | null;
}

const CATEGORY_STYLES: Record<string, { badge: string; border: string }> = {
  Budget: { badge: "bg-emerald-100 text-emerald-700", border: "border-emerald-200" },
  "Mid-Range": { badge: "bg-blue-100 text-blue-700", border: "border-blue-200" },
  Premium: { badge: "bg-violet-100 text-violet-700", border: "border-violet-200" },
  Luxury: { badge: "bg-amber-100 text-amber-700", border: "border-amber-200" },
  "Voyr Pick": { badge: "bg-violet-100 text-violet-700", border: "border-violet-200" },
};

function getBadgeStyle(category: string) {
  return CATEGORY_STYLES[category]?.badge || "bg-slate-100 text-slate-700";
}

function formatRate(rate: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(rate);
}

const OTA_COLORS: Record<string, string> = {
  HotelsCom2: "bg-red-50 text-red-700",
  Expedia: "bg-blue-50 text-blue-700",
  BookingCom: "bg-indigo-50 text-indigo-700",
  Agoda: "bg-orange-50 text-orange-700",
  Priceline: "bg-sky-50 text-sky-700",
};

export default function HotelOptionsCard({
  destination,
  options,
  onSelect,
  selectedId,
  selectingId,
}: HotelOptionsCardProps) {
  const [selectedHotelForModal, setSelectedHotelForModal] = useState<HotelOption | null>(null);

  return (
    <div className="mt-4">
      <div className="mb-4">
        <h3 className="font-bold text-slate-900 flex items-center gap-2 text-lg">
          <PiBuildingsFill className="h-6 w-6 text-violet-500" />
          Hotels in {destination}
        </h3>
        <p className="mt-1 text-sm text-slate-500">Live prices from multiple booking sites</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {options.map((hotel, idx) => {
          const id = optionKey(hotel);
          const selected = selectedId === id;
          const loading = selectingId === id;

          // Sort rates cheapest first
          const sortedRates = hotel.rates
            ? [...hotel.rates].sort((a, b) => a.rate - b.rate).slice(0, 4)
            : null;
          const cheapestRate = sortedRates?.[0];

          return (
            <OptionCardShell
              key={id}
              option={hotel}
              selected={selected}
              loading={loading}
              animationDelay={idx * 50}
            >
              {/* Hotel image */}
              {hotel.image && (
                <div 
                  className="mb-3 -mx-4 -mt-4 h-48 overflow-hidden rounded-t-xl cursor-pointer group"
                  onClick={() => setSelectedHotelForModal(hotel)}
                >
                  <img
                    src={hotel.image}
                    alt={hotel.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                </div>
              )}

              {/* Category + stars */}
              <div className="flex items-start justify-between">
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${getBadgeStyle(hotel.category)}`}>
                  {hotel.category}
                </span>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: Math.min(5, Math.round(hotel.rating || 4)) }).map((_, i) => (
                    <PiStarFill key={i} className="h-3.5 w-3.5 text-amber-400" />
                  ))}
                </div>
              </div>

              {/* Name */}
              <h4 
                className="mt-2 font-bold text-slate-900 leading-tight cursor-pointer hover:text-violet-600 transition-colors"
                onClick={() => setSelectedHotelForModal(hotel)}
              >
                {hotel.name}
              </h4>

              {/* Location */}
              {hotel.location && (
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                  <PiMapPinFill className="h-3 w-3 shrink-0" /> {hotel.location}
                </p>
              )}

              {/* Price */}
              <div className="mt-4">
                {cheapestRate ? (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold text-slate-900">
                      {formatRate(cheapestRate.rate, hotel.currency)}
                    </span>
                    <span className="text-xs text-slate-400">/ night</span>
                    <span className="ml-1 flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      <PiTagFill className="h-2.5 w-2.5" />
                      Best deal
                    </span>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold text-slate-900">
                      {formatRate(hotel.price_per_night, hotel.currency)}
                    </span>
                    <span className="text-xs text-slate-400">/ night</span>
                  </div>
                )}
              </div>

              {/* OTA Rate Comparison */}
              {sortedRates && sortedRates.length > 1 && (
                <div className="mt-4 space-y-1.5 rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Compare top prices</p>
                  {sortedRates.slice(0, 3).map((rate) => (
                    <div key={rate.code} className="flex items-center justify-between">
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${OTA_COLORS[rate.code] || "bg-slate-200 text-slate-700"}`}>
                        {rate.name}
                      </span>
                      <span className="text-xs font-semibold text-slate-700">
                        {formatRate(rate.rate, hotel.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Highlights */}
              {hotel.highlights && hotel.highlights.length > 0 && (
                <ul className="mt-4 space-y-1">
                  {hotel.highlights.slice(0, 3).map((h) => (
                    <li key={h} className="flex items-start gap-1.5 text-xs text-slate-500">
                      <span className="mt-0.5 text-violet-400">•</span> {h}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4">
                <SelectButton
                  label="Choose this hotel"
                  selectedLabel="Hotel selected"
                  selected={selected}
                  loading={loading}
                  onClick={onSelect ? () => onSelect(hotel) : undefined}
                />
              </div>
            </OptionCardShell>
          );
        })}
      </div>

      <HotelDetailsModal
        isOpen={!!selectedHotelForModal}
        onClose={() => setSelectedHotelForModal(null)}
        hotel={selectedHotelForModal}
      />
    </div>
  );
}

