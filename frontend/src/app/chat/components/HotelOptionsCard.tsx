"use client";

import { PiStarFill, PiMapPinFill, PiBuildingsFill } from "react-icons/pi";
import OptionCarousel from "./cards/OptionCarousel";
import OptionCardShell from "./cards/OptionCardShell";
import PriceTag from "./cards/PriceTag";
import SelectButton from "./cards/SelectButton";
import { optionKey, type CuratedOptionMeta } from "./cards/option-utils";

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
}

interface HotelOptionsCardProps {
  destination: string;
  options: HotelOption[];
  onSelect?: (hotel: HotelOption) => void;
  selectedId?: string;
  selectingId?: string | null;
}

const CATEGORY_STYLES: Record<string, { badge: string }> = {
  Budget: { badge: "bg-emerald-100 text-emerald-700" },
  "Mid-Range": { badge: "bg-blue-100 text-blue-700" },
  Luxury: { badge: "bg-amber-100 text-amber-700" },
  Premium: { badge: "bg-violet-100 text-violet-700" },
  "Voyr Pick": { badge: "bg-violet-100 text-violet-700" },
};

function getBadgeStyle(category: string) {
  return CATEGORY_STYLES[category]?.badge || "bg-slate-100 text-slate-700";
}

export default function HotelOptionsCard({
  destination,
  options,
  onSelect,
  selectedId,
  selectingId,
}: HotelOptionsCardProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm animate-scale-in">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="font-bold text-slate-900">
          <PiBuildingsFill className="mr-1.5 inline-block h-5 w-5 -mt-0.5 text-violet-500" />
          Hotel Options — {destination}
        </h3>
      </div>

      <OptionCarousel>
        {options.map((hotel, idx) => {
          const id = optionKey(hotel);
          const selected = selectedId === id;
          const loading = selectingId === id;
          return (
            <OptionCardShell
              key={id}
              option={hotel}
              selected={selected}
              loading={loading}
              animationDelay={idx * 80}
            >
              <div className="flex items-start justify-between">
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${getBadgeStyle(hotel.category)}`}>
                  {hotel.category}
                </span>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: Math.round(hotel.rating) }).map((_, i) => (
                    <PiStarFill key={i} className="h-3.5 w-3.5 text-amber-400" />
                  ))}
                </div>
              </div>

              <h4 className="mt-2 font-bold text-slate-900">{hotel.name}</h4>

              {hotel.location && (
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                  <PiMapPinFill className="h-3 w-3" /> {hotel.location}
                </p>
              )}

              <div className="mt-3">
                <PriceTag amount={hotel.price_per_night} currency={hotel.currency} suffix="/ night" />
              </div>

              {hotel.highlights.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {hotel.highlights.slice(0, 3).map((h) => (
                    <li key={h} className="text-xs text-slate-600">
                      • {h}
                    </li>
                  ))}
                </ul>
              )}

              <SelectButton
                label="Choose this hotel"
                selectedLabel="Hotel selected"
                selected={selected}
                loading={loading}
                onClick={onSelect ? () => onSelect(hotel) : undefined}
              />
            </OptionCardShell>
          );
        })}
      </OptionCarousel>
    </div>
  );
}
