"use client";

import { useState } from "react";
import { PiMoneyFill } from "react-icons/pi";
import AdminGate from "../../components/admin/AdminGate";
import AdminShell from "../../components/admin/AdminShell";
import MarginPreviewPanel from "./MarginPreviewPanel";
import MarginRuleForm from "./MarginRuleForm";
import { usePricingAdminTab } from "./usePricingAdminTab";

export default function PricingAdminPage() {
  const { rules, loading, error, setError, saveRule, deleteRule, runPreview } = usePricingAdminTab();
  const [editingId, setEditingId] = useState<string | null>(null);

  const editingRule = editingId
    ? rules.find((r) => r.id === editingId)
    : editingId === ""
      ? null
      : undefined;

  return (
    <AdminGate>
      <AdminShell
        section="pricing"
        title="Pricing & margins"
        subtitle="Configure margin rules and preview sell prices before publishing listings."
      >
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold text-slate-900">
                <PiMoneyFill className="text-violet-500" /> Margin rules
              </h2>
              <button
                type="button"
                onClick={() => setEditingId("")}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700"
              >
                Add rule
              </button>
            </div>

            {(editingId === "" || editingRule) && (
              <MarginRuleForm
                editingRule={editingRule}
                onSave={async (form) => {
                  await saveRule(form);
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
                onError={setError}
              />
            )}

            {loading ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : rules.length === 0 ? (
              <p className="text-sm text-slate-400">No margin rules yet.</p>
            ) : (
              <div className="space-y-2">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-semibold">{rule.provider}</span>
                      {rule.listing_type && (
                        <span className="ml-2 text-slate-500">· {rule.listing_type}</span>
                      )}
                      <span className="ml-2 text-violet-600">
                        {rule.margin_type === "percent"
                          ? `${rule.margin_value}%`
                          : `+${rule.margin_value}`}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(rule.id)}
                        className="text-xs font-bold text-violet-600"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await deleteRule(rule.id);
                          } catch (e) {
                            setError(e instanceof Error ? e.message : "Delete failed");
                          }
                        }}
                        className="text-xs font-bold text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <MarginPreviewPanel onPreview={runPreview} onError={setError} />
        </div>
      </AdminShell>
    </AdminGate>
  );
}
