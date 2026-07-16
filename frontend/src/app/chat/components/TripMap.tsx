"use client";

import { useEffect, useRef, useState } from "react";
import { PiMapPinFill } from "react-icons/pi";
import "mapbox-gl/dist/mapbox-gl.css";

interface DayLocation {
  day_number: number;
  title: string;
  description: string;
}

interface TripMapProps {
  destination: string;
  days_plan: DayLocation[];
}

interface LngLat {
  lng: number;
  lat: number;
}

function offsetPin(center: LngLat, index: number, total: number): LngLat {
  const angle = (index / Math.max(total, 1)) * Math.PI * 2;
  const radius = 0.04 + (index % 3) * 0.02;
  return {
    lng: center.lng + Math.cos(angle) * radius,
    lat: center.lat + Math.sin(angle) * radius * 0.6,
  };
}

export default function TripMap({ destination, days_plan }: TripMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    if (!token || !mapContainerRef.current || days_plan.length === 0) return;

    let cancelled = false;

    async function initMap() {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        mapboxgl.accessToken = token!;

        const geoRes = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(destination)}.json?access_token=${token}&limit=1`,
        );
        const geoJson = await geoRes.json();
        const feature = geoJson.features?.[0];
        if (!feature?.center) {
          setMapError("Could not locate destination on the map.");
          return;
        }

        const center: LngLat = { lng: feature.center[0], lat: feature.center[1] };
        if (cancelled || !mapContainerRef.current) return;

        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }

        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: "mapbox://styles/mapbox/light-v11",
          center: [center.lng, center.lat],
          zoom: 5,
        });

        mapRef.current = map;

        map.on("load", () => {
          new mapboxgl.Marker({ color: "#7c3aed" })
            .setLngLat([center.lng, center.lat])
            .setPopup(new mapboxgl.Popup().setHTML(`<strong>${destination}</strong>`))
            .addTo(map);

          days_plan.forEach((day, idx) => {
            const pin = offsetPin(center, idx, days_plan.length);
            new mapboxgl.Marker({ color: "#a78bfa", scale: 0.85 })
              .setLngLat([pin.lng, pin.lat])
              .setPopup(
                new mapboxgl.Popup().setHTML(
                  `<strong>Day ${day.day_number}</strong><br/>${day.title}`,
                ),
              )
              .addTo(map);
          });

          const bounds = new mapboxgl.LngLatBounds();
          bounds.extend([center.lng, center.lat]);
          days_plan.forEach((_, idx) => {
            const pin = offsetPin(center, idx, days_plan.length);
            bounds.extend([pin.lng, pin.lat]);
          });
          map.fitBounds(bounds, { padding: 48, maxZoom: 10 });
        });
      } catch {
        setMapError("Map failed to load.");
      }
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [token, destination, days_plan]);

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
        {!token ? (
          <div className="flex h-48 items-center justify-center bg-gradient-to-br from-blue-50 via-cyan-50 to-emerald-50 px-4 text-center text-sm text-slate-500">
            Set <code className="mx-1 rounded bg-white px-1">NEXT_PUBLIC_MAPBOX_TOKEN</code> to
            enable the interactive map.
          </div>
        ) : mapError ? (
          <div className="flex h-48 items-center justify-center text-sm text-slate-500">
            {mapError}
          </div>
        ) : (
          <div ref={mapContainerRef} className="h-56 w-full" />
        )}
      </div>

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
