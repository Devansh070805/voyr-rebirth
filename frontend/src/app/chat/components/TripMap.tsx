"use client";

import { PiMapPinFill } from "react-icons/pi";

interface DayLocation {
  day_number: number;
  title: string;
  description: string;
}

interface TripMapProps {
  destination: string;
  days_plan: DayLocation[];
}

export default function TripMap({ destination, days_plan }: TripMapProps) {
  // Use OpenStreetMap iframe — no API key required
  const encoded = encodeURIComponent(destination);
  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=-180%2C-90%2C180%2C90&layer=mapnik&marker=0%2C0&query=${encoded}`;
  // Use a simpler Google Maps static-like embed via the search URL
  const embedSrc = `https://maps.google.com/maps?q=${encoded}&output=embed&z=8`;

  return (
    <div className="space-y-4">
      {/* Embedded map — works with no API key via Google Maps embed */}
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
        <iframe
          title={`Map of ${destination}`}
          src={embedSrc}
          className="h-56 w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      {/* Day-by-day location list */}
      <div className="space-y-0">
        {days_plan.map((day, idx) => (
          <div key={day.day_number} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-600">
                {day.day_number}
              </div>
              {idx < days_plan.length - 1 && <div className="h-full w-0.5 bg-violet-100" />}
            </div>

            <div className="pb-4">
              <div className="flex items-center gap-1.5">
                <PiMapPinFill className="h-3 w-3 text-violet-400" />
                <span className="text-xs font-bold text-slate-800">{day.title}</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{day.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
