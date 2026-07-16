"use client";

import { PiCheckCircleFill, PiPackageFill } from "react-icons/pi";

interface PackageCreatedCardProps {
  destination: string;
  nights: number;
  people: number;
  package_id?: string;
}

export default function PackageCreatedCard({
  destination,
  nights,
  people,
  package_id,
}: PackageCreatedCardProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50 shadow-sm animate-bounce-in">
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
          <PiPackageFill className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-emerald-900">Package Created</h3>
            <PiCheckCircleFill className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="mt-0.5 text-sm text-emerald-700">
            {destination} — {nights} nights for {people} {people === 1 ? "person" : "people"}
          </p>
          {package_id && (
            <p className="mt-1 text-xs text-emerald-500">
              Package ID: {package_id}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
