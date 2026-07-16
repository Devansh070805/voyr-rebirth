"use client";

import { useState, useEffect, useCallback } from "react";
import {
  PiBookmarkSimpleFill,
  PiHeartFill,
  PiMapPinFill,
  PiPlusBold,
} from "react-icons/pi";
import AppShell from "../components/AppShell";
import ProtectedRoute from "../auth/ProtectedRoute";
import { useApi } from "../auth/context";

interface SavedItem {
  id: string;
  title: string;
  type: "Hotel" | "Activity" | "Experience" | "Destination";
  location: string;
  price: string;
  image: string;
  savedAt: string;
}

const TYPE_COLORS: Record<string, string> = {
  Hotel: "bg-blue-50 text-blue-600",
  Activity: "bg-emerald-50 text-emerald-600",
  Experience: "bg-amber-50 text-amber-600",
  Destination: "bg-violet-50 text-violet-600",
};

function SavedContent() {
  const { apiFetch } = useApi();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [filter, setFilter] = useState<string>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      const res = await apiFetch("/saved-trips");
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      } else {
        setError("Failed to load saved items");
      }
    } catch {
      setError("Unable to connect to server");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const removeItem = async (id: string) => {
    try {
      const res = await apiFetch(`/saved-trips/${id}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }
    } catch {
      // Handle error visually if needed
    }
  };

  const types = ["All", ...new Set(items.map((i) => i.type))];
  const filtered = filter === "All" ? items : items.filter((i) => i.type === filter);

  return (
    <AppShell activePage="Saved">
      <div className="px-10 py-10">
        <div className="mb-8">
          <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
            <PiBookmarkSimpleFill className="h-7 w-7 text-violet-600" /> Saved
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Hotels, activities, and experiences you&apos;ve bookmarked.
          </p>
        </div>

        {/* Filter tabs */}
        {items.length > 0 && (
          <div className="mb-6 flex gap-2">
            {types.map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  filter === type
                    ? "bg-violet-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {type}
                {type !== "All" && (
                  <span className="ml-1.5 text-xs opacity-70">
                    ({items.filter((i) => i.type === type).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
              <p className="mt-4 text-sm text-slate-400">Loading your saved items...</p>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-600">
            {error}
            <button
              onClick={fetchItems}
              className="ml-3 font-semibold underline hover:text-red-700"
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50">
              <PiBookmarkSimpleFill className="h-8 w-8 text-violet-300" />
            </div>
            <h3 className="mt-4 font-bold text-slate-500">
              {filter === "All" ? "Nothing saved yet" : `No saved ${filter.toLowerCase()}s`}
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Ask the AI to suggest hotels or activities, then save your favorites.
            </p>
            <a
              href="/chat"
              className="mt-6 flex items-center gap-2 rounded-lg bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-violet-700"
            >
              <PiPlusBold className="h-4 w-4" /> Explore with AI
            </a>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="relative">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="h-40 w-full object-cover"
                  />
                  <button
                    onClick={() => removeItem(item.id)}
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-red-500 shadow-sm hover:bg-white transition-colors"
                    title="Remove from saved"
                  >
                    <PiHeartFill className="h-4 w-4" />
                  </button>
                  <span
                    className={`absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm ${
                      TYPE_COLORS[item.type] || "bg-slate-50 text-slate-600"
                    }`}
                  >
                    {item.type}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <PiMapPinFill className="h-3 w-3" /> {item.location}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-bold text-violet-600">{item.price}</span>
                    <a
                      href="/chat"
                      className="text-xs font-semibold text-slate-500 hover:text-violet-600 transition-colors"
                    >
                      Add to trip
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

export default function SavedPage() {
  return (
    <ProtectedRoute>
      <SavedContent />
    </ProtectedRoute>
  );
}
