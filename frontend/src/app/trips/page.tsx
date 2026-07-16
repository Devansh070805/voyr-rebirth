"use client";

import { useState, useEffect, useCallback } from "react";
import {
  PiIdentificationCardFill,
  PiSuitcaseRollingFill,
  PiMapPinFill,
  PiCalendarBlankFill,
  PiArrowRightBold,
  PiPlusBold,
  PiTrashFill,
} from "react-icons/pi";
import AppShell from "../components/AppShell";
import ProtectedRoute from "../auth/ProtectedRoute";
import type { ConversationListItem } from "@/types/chat";
import { formatDate, getDestinationImage } from "../lib/utils";
import { useApi } from "../auth/context";
import { getConversationStatusLabel, getConversationStatusStyle } from "../lib/conversation-status";
import { visaCheckerHref } from "../lib/destination-codes";


function TripsContent() {
  const { apiFetch } = useApi();
  const [trips, setTrips] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrips = useCallback(async () => {
    try {
      const res = await apiFetch("/conversations?limit=50");
      if (res.ok) {
        const data = await res.json();
        setTrips(data);
      } else {
        setError("Failed to load trips");
      }
    } catch {
      setError("Unable to connect to server");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const handleDelete = async (id: string) => {
    try {
      const res = await apiFetch(`/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Failed to delete trip");
        return;
      }
      setTrips((prev) => prev.filter((t) => t.id !== id));
    } catch {
      setError("Unable to delete trip. Check your connection.");
    }
  };

  return (
    <AppShell activePage="My Trips" conversations={trips.map((t) => ({
      id: t.id,
      title: t.title,
      destination: t.destination,
      updated_at: t.updated_at,
    }))}>
      <div className="px-10 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
              <PiSuitcaseRollingFill className="h-7 w-7 text-violet-600" /> My Trips
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              All your planned and upcoming trips in one place.
            </p>
          </div>
          <a
            href="/chat"
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-200 hover:bg-violet-700 transition-colors"
          >
            <PiPlusBold className="h-4 w-4" /> New Trip
          </a>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
              <p className="mt-4 text-sm text-slate-400">Loading your trips...</p>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-600">
            {error}
            <button
              onClick={fetchTrips}
              className="ml-3 font-semibold underline hover:text-red-700"
            >
              Retry
            </button>
          </div>
        ) : trips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50">
              <PiSuitcaseRollingFill className="h-8 w-8 text-violet-300" />
            </div>
            <h3 className="mt-4 font-bold text-slate-500">No trips yet</h3>
            <p className="mt-2 text-sm text-slate-400">
              Start planning your first trip with our AI assistant.
            </p>
            <a
              href="/chat"
              className="mt-6 flex items-center gap-2 rounded-lg bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-violet-700"
            >
              <PiPlusBold className="h-4 w-4" /> Plan a Trip
            </a>
          </div>
        ) : (
          <div className="grid gap-5">
            {trips.map((trip) => (
              <div
                key={trip.id}
                className="group flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <img
                  src={getDestinationImage(trip.destination)}
                  alt={trip.destination || "Trip"}
                  className="h-36 w-48 object-cover"
                />
                <div className="flex flex-1 items-center justify-between px-6 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <h2 className="truncate text-lg font-bold text-slate-900">
                        {trip.title}
                      </h2>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${getConversationStatusStyle(trip.status)}`}
                      >
                        {getConversationStatusLabel(trip.status)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                      {trip.destination && (
                        <span className="flex items-center gap-1.5">
                          <PiMapPinFill className="h-4 w-4" /> {trip.destination}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <PiCalendarBlankFill className="h-4 w-4" /> {formatDate(trip.updated_at)}
                      </span>
                      <span className="text-xs text-slate-400">
                        {trip.message_count} messages
                      </span>
                    </div>
                    {trip.last_message && (
                      <p className="mt-2 truncate text-sm text-slate-400">
                        {trip.last_message.slice(0, 80)}
                        {trip.last_message.length > 80 ? "..." : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {trip.destination && (
                      <a
                        href={visaCheckerHref(trip.destination)}
                        className="rounded-lg p-2 text-slate-300 opacity-0 transition-all hover:bg-violet-50 hover:text-violet-600 group-hover:opacity-100"
                        title="Check visa"
                      >
                        <PiIdentificationCardFill className="h-4 w-4" />
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(trip.id)}
                      className="rounded-lg p-2 text-slate-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                      title="Delete trip"
                    >
                      <PiTrashFill className="h-4 w-4" />
                    </button>
                    <a
                      href={`/chat?id=${trip.id}`}
                      className="rounded-lg p-2 text-slate-300 transition-colors hover:text-violet-600"
                    >
                      <PiArrowRightBold className="h-5 w-5" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function TripsPage() {
  return (
    <ProtectedRoute>
      <TripsContent />
    </ProtectedRoute>
  );
}
