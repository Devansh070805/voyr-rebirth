"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/context";
import type { MarginPreviewResult, MarginRuleRow } from "./types";

export function usePricingAdminTab() {
  const { adminFetch } = useAuth();
  const [rules, setRules] = useState<MarginRuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch("/admin/pricing/margins");
      if (!res.ok) throw new Error("Failed to load margin rules");
      const json = await res.json();
      setRules((json.rules as MarginRuleRow[]) || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [adminFetch]);

  useEffect(() => {
    reload();
  }, [reload]);

  const saveRule = async (form: FormData) => {
    const body = {
      provider: form.get("provider") || "all",
      listing_type: form.get("listing_type") || undefined,
      destination_slug: form.get("destination_slug") || undefined,
      customer_segment: form.get("customer_segment") || "b2c",
      margin_type: form.get("margin_type") || "percent",
      margin_value: Number(form.get("margin_value")),
      min_margin_amount: form.get("min_margin_amount")
        ? Number(form.get("min_margin_amount"))
        : undefined,
      is_active: form.get("is_active") === "on",
    };

    const id = form.get("id") as string;
    const res = id
      ? await adminFetch(`/admin/pricing/margins/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      : await adminFetch("/admin/pricing/margins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

    if (!res.ok) throw new Error("Save failed");
    await reload();
  };

  const deleteRule = async (id: string) => {
    if (!confirm("Delete this margin rule?")) return;
    const res = await adminFetch(`/admin/pricing/margins/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete failed");
    await reload();
  };

  const runPreview = async (form: FormData): Promise<MarginPreviewResult> => {
    const res = await adminFetch("/admin/pricing/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base_price: Number(form.get("base_price")),
        provider: form.get("preview_provider") || "all",
        listing_type: form.get("preview_listing_type") || undefined,
        destination_slug: form.get("preview_destination") || undefined,
        customer_segment: form.get("preview_segment") || "b2c",
      }),
    });
    if (!res.ok) throw new Error("Preview failed");
    const json = await res.json();
    return json.result as MarginPreviewResult;
  };

  return { rules, loading, error, setError, reload, saveRule, deleteRule, runPreview };
}
