"use client";

import { useState } from "react";
import {
  PiBuildingsFill,
  PiCrosshairFill,
  PiAirplaneTiltFill,
  PiMapTrifoldFill,
  PiTicketFill,
} from "react-icons/pi";
import AdminGate from "../../components/admin/AdminGate";
import AdminShell from "../../components/admin/AdminShell";
import { useAuth } from "../../auth/context";
import { useListingsAdminTab } from "./useListingsAdminTab";
import ListingEditForm from "./ListingEditForm";
import {
  LISTING_TABS,
  EMPTY_LISTING,
  type CuratedListingRow,
  type ListingEditRow,
  type ListingTabKey,
} from "./types";

const TAB_ICONS: Record<ListingTabKey, React.ReactNode> = {
  hotel: <PiBuildingsFill />,
  activity: <PiCrosshairFill />,
  flight: <PiAirplaneTiltFill />,
  itinerary: <PiMapTrifoldFill />,
  ticket: <PiTicketFill />,
};

function rowToEdit(row: CuratedListingRow): ListingEditRow {
  return {
    id: row.id,
    listing_type: row.listing_type,
    title: row.title,
    description: row.description || "",
    destination_slug: row.destination_slug,
    payload_json: JSON.stringify(row.payload ?? {}, null, 2),
    cost_price: row.cost_price,
    sell_price: row.sell_price,
    currency: row.currency,
    priority: row.priority,
    is_active: row.is_active,
  };
}

export default function ListingsAdminPage() {
  const { adminFetch } = useAuth();
  const [tab, setTab] = useState<ListingTabKey>("hotel");
  const [editing, setEditing] = useState<ListingEditRow | null>(null);
  const { data, loading, error, reload, setError } = useListingsAdminTab(tab);

  const saveFromForm = async (form: FormData) => {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(String(form.get("payload_json") || "{}"));
    } catch {
      throw new Error("Invalid payload JSON");
    }

    const body = {
      listing_type: form.get("listing_type"),
      title: form.get("title"),
      description: form.get("description") || null,
      destination_slug: form.get("destination_slug"),
      payload,
      cost_price: Number(form.get("cost_price")),
      sell_price: Number(form.get("sell_price")),
      currency: form.get("currency") || "INR",
      priority: Number(form.get("priority") || 0),
      is_active: form.get("is_active") === "on",
    };

    const id = form.get("id") as string;
    const res = id
      ? await adminFetch(`/admin/listings/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      : await adminFetch("/admin/listings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

    if (!res.ok) throw new Error("Save failed");
    setEditing(null);
    reload();
  };

  const deleteListing = async (id: string, title: string) => {
    if (!confirm(`Delete listing "${title}"?`)) return;
    const res = await adminFetch(`/admin/listings/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete failed");
    reload();
  };

  return (
    <AdminGate>
      <AdminShell
        section="listings"
        title="Curated listings"
        subtitle="Manage hand-picked hotels, activities, flights, itineraries, and tickets."
      >
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {LISTING_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTab(t.key);
                  setEditing(null);
                }}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                  tab === t.key
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-200"
                    : "bg-white text-slate-600 border border-slate-200 hover:border-violet-200"
                }`}
              >
                {TAB_ICONS[t.key]} {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setEditing({ ...EMPTY_LISTING, listing_type: tab })}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700"
          >
            Add listing
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {editing && (
          <ListingEditForm
            tab={tab}
            editing={editing}
            onCancel={() => setEditing(null)}
            onSubmit={async (form) => {
              setError(null);
              try {
                await saveFromForm(form);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Save failed");
              }
            }}
          />
        )}

        {loading ? (
          <div className="mt-8 flex h-40 items-center justify-center text-sm text-slate-400">
            Loading…
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-4 py-3 font-bold">Title</th>
                  <th className="px-4 py-3 font-bold">Destination</th>
                  <th className="px-4 py-3 font-bold">Prices</th>
                  <th className="px-4 py-3 font-bold">Priority</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold">{row.title}</td>
                    <td className="px-4 py-3 text-slate-500">{row.destination_slug}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-400">{row.currency}</span>{" "}
                      {row.cost_price} → {row.sell_price}
                    </td>
                    <td className="px-4 py-3">{row.priority}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          row.is_active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {row.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditing(rowToEdit(row))}
                          className="text-xs font-bold text-violet-600 hover:text-violet-800"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await deleteListing(row.id, row.title);
                            } catch (e) {
                              setError(e instanceof Error ? e.message : "Delete failed");
                            }
                          }}
                          className="text-xs font-bold text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.length === 0 && (
              <div className="p-12 text-center text-sm text-slate-400">No listings found</div>
            )}
          </div>
        )}
      </AdminShell>
    </AdminGate>
  );
}
