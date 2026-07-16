"use client";

import { useState, useEffect, useCallback } from "react";
import {
  PiCalendarCheckFill,
  PiReceiptFill,
  PiPackageFill,
} from "react-icons/pi";
import AppShell from "../components/AppShell";
import type { ConversationListItem } from "@/types/chat";
import { formatDate } from "../lib/utils";
import { useApi } from "../auth/context";
import {
  getConversationStatusLabel,
  getConversationStatusStyle,
  isBookingPipelineStatus,
} from "../lib/conversation-status";

export function BookingsContent({ embedded = false }: { embedded?: boolean }) {
  const { apiFetch } = useApi();
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    try {
      const res = await apiFetch("/conversations?limit=50");
      if (res.ok) {
        const data: ConversationListItem[] = await res.json();
        const withProgress = data.filter(
          (c) => c.destination && (isBookingPipelineStatus(c.status) || c.status === "active"),
        );
        setConversations(
          withProgress.sort((a, b) => {
            const order = (s: string) =>
              isBookingPipelineStatus(s) ? 0 : 1;
            return order(a.status) - order(b.status);
          }),
        );
      } else {
        setError("Failed to load bookings");
      }
    } catch {
      setError("Unable to connect to server");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const chatBase = embedded ? "/partner/chat" : "/chat";

  const inner = (
    <div className={embedded ? "" : "px-10 py-10"}>
      {!embedded && (
        <div className="mb-8">
          <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
            <PiCalendarCheckFill className="h-7 w-7 text-violet-600" /> Bookings
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Trips with packages, quotes, or checkout in progress.
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
            <p className="mt-4 text-sm text-slate-400">Loading bookings...</p>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-600">
          {error}
          <button onClick={fetchBookings} className="ml-3 font-semibold underline hover:text-red-700">
            Retry
          </button>
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50">
            <PiPackageFill className="h-8 w-8 text-violet-300" />
          </div>
          <h3 className="mt-4 font-bold text-slate-500">No bookings in progress</h3>
          <p className="mt-2 text-sm text-slate-400">
            Chat with Voyr, then use Book Trip to create a package and checkout.
          </p>
          <a
            href={chatBase}
            className="mt-6 flex items-center gap-2 rounded-lg bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-violet-700"
          >
            Plan a Trip
          </a>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Trip
                </th>
                <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Destination
                </th>
                <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Last Updated
                </th>
                <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Status
                </th>
                <th className="px-6 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {conversations.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-6 py-4 font-semibold text-slate-800">{c.title}</td>
                  <td className="px-6 py-4 text-slate-500">{c.destination || "—"}</td>
                  <td className="px-6 py-4 text-slate-500">{formatDate(c.updated_at)}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getConversationStatusStyle(c.status)}`}
                    >
                      {getConversationStatusLabel(c.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <a
                      href={`${chatBase}?id=${c.id}`}
                      className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700"
                    >
                      <PiReceiptFill className="h-3.5 w-3.5" /> Open trip
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  if (embedded) return inner;

  return (
    <AppShell activePage="Bookings" conversations={conversations}>
      {inner}
    </AppShell>
  );
}
