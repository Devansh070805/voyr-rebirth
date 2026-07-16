"use client";

import { useState } from "react";
import {
  PiFlagBannerFill,
  PiFileFill,
  PiMoneyFill,
  PiDatabaseFill,
} from "react-icons/pi";
import AdminGate from "../../components/admin/AdminGate";
import AdminShell from "../../components/admin/AdminShell";
import { useAuth } from "../../auth/context";
import { useVisaAdminTab } from "./useVisaAdminTab";
import type {
  CorrectionRow,
  DocumentRow,
  FeeRow,
  RequirementRow,
  VisaEditRow,
  VisaTabKey,
} from "./types";
import VisaEditForm from "./VisaEditForm";
import RequirementsTab from "./RequirementsTab";
import DocumentsTab from "./DocumentsTab";
import FeesTab from "./FeesTab";
import CorrectionsTab from "./CorrectionsTab";

const PASSPORTS = ["IN", "US", "GB", "AE", "AU", "CA", "JP", "CN", "RU"];

const TABS: { key: VisaTabKey; icon: React.ReactNode; label: string }[] = [
  { key: "requirements", icon: <PiFlagBannerFill />, label: "Requirements" },
  { key: "documents", icon: <PiFileFill />, label: "Documents" },
  { key: "fees", icon: <PiMoneyFill />, label: "Fees" },
  { key: "corrections", icon: <PiDatabaseFill />, label: "Corrections" },
];

export default function VisaAdminPage() {
  const { adminFetch, user } = useAuth();
  const [tab, setTab] = useState<VisaTabKey>("requirements");
  const [passport, setPassport] = useState("IN");
  const [editing, setEditing] = useState<VisaEditRow | null>(null);
  const { data, loading, error, reload, setError } = useVisaAdminTab(tab, passport);

  const saveFromForm = async (form: FormData) => {
    if (tab === "requirements") {
      const res = await adminFetch("/admin/visa/admin/requirements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passport_country: form.get("passport_country"),
          destination_country: form.get("destination_country"),
          visa_status: form.get("visa_status"),
          visa_type: form.get("visa_type") || null,
          max_stay_days: form.get("max_stay_days") ? Number(form.get("max_stay_days")) : null,
          notes: form.get("notes") || null,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
    } else if (tab === "documents") {
      const res = await adminFetch("/admin/visa/admin/documents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.get("id") ? Number(form.get("id")) : undefined,
          destination_country: form.get("destination_country"),
          visa_type: form.get("visa_type"),
          document_type: form.get("document_type"),
          is_required: form.get("is_required") === "on",
          description: form.get("description") || null,
          sort_order: Number(form.get("sort_order") || 0),
        }),
      });
      if (!res.ok) throw new Error("Save failed");
    } else if (tab === "fees") {
      const res = await adminFetch("/admin/visa/admin/fees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination_country: form.get("destination_country"),
          visa_type: form.get("visa_type"),
          fee_amount: form.get("fee_amount") ? Number(form.get("fee_amount")) : null,
          fee_currency: form.get("fee_currency") || "USD",
          processing_time_days_min: form.get("min_days") ? Number(form.get("min_days")) : null,
          processing_time_days_max: form.get("max_days") ? Number(form.get("max_days")) : null,
          notes: form.get("notes") || null,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
    }
    setEditing(null);
    reload();
  };

  const deleteRequirement = async (p: string, d: string) => {
    if (!confirm(`Delete requirement ${p} → ${d}?`)) return;
    const res = await adminFetch(`/admin/visa/admin/requirements/${p}/${d}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete failed");
    reload();
  };

  const patchCorrection = async (id: number, status: string) => {
    const res = await adminFetch(`/travel-visa/corrections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        reviewed_by: user?.email || "admin",
      }),
    });
    if (!res.ok) throw new Error("Update failed");
    reload();
  };

  return (
    <AdminGate>
    <AdminShell section="visa" title="Visa data admin">
      <div className="mt-6 flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
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
              {t.icon} {t.label}{" "}
              <span className="text-xs opacity-60">({data.length})</span>
            </button>
          ))}
        </div>
        {tab !== "corrections" && (
          <button
            type="button"
            onClick={() => setEditing({ id: 0 })}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white hover:bg-violet-700"
          >
            Add / upsert
          </button>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {tab === "requirements" && (
        <div className="mb-4 mt-4 flex items-center gap-3">
          <span className="text-sm font-bold text-slate-600">Passport:</span>
          {PASSPORTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPassport(p)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                passport === p
                  ? "bg-violet-100 text-violet-700"
                  : "bg-white text-slate-500 border border-slate-200"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {editing && (
        <VisaEditForm
          tab={tab}
          editing={editing}
          passport={passport}
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
          {tab === "requirements" && (
            <RequirementsTab
              rows={data as RequirementRow[]}
              onEdit={setEditing}
              onDelete={async (p, d) => {
                try {
                  await deleteRequirement(p, d);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Delete failed");
                }
              }}
            />
          )}
          {tab === "documents" && (
            <DocumentsTab rows={data as DocumentRow[]} onEdit={setEditing} />
          )}
          {tab === "fees" && <FeesTab rows={data as FeeRow[]} onEdit={setEditing} />}
          {tab === "corrections" && (
            <CorrectionsTab
              rows={data as CorrectionRow[]}
              onPatch={async (id, status) => {
                try {
                  await patchCorrection(id, status);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Update failed");
                }
              }}
            />
          )}
          {data.length === 0 && (
            <div className="p-12 text-center text-sm text-slate-400">No data found</div>
          )}
        </div>
      )}
    </AdminShell>
    </AdminGate>
  );
}
