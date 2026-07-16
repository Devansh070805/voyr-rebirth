"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/context";
import type { PartnerRow } from "./types";

export function usePartnersAdminTab() {
  const { adminFetch } = useAuth();
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch("/admin/partners");
      if (!res.ok) throw new Error("Failed to load partners");
      const json = await res.json();
      setPartners((json.partners as PartnerRow[]) || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setPartners([]);
    } finally {
      setLoading(false);
    }
  }, [adminFetch]);

  useEffect(() => {
    reload();
  }, [reload]);

  const createPartner = async (body: {
    name: string;
    company_code: string;
    contact_email?: string;
    notes?: string;
  }) => {
    const res = await adminFetch("/admin/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error?.message || "Create failed");
    }
    await reload();
  };

  const grantAccess = async (partnerId: string, email: string) => {
    const res = await adminFetch(`/admin/partners/${partnerId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error?.message || "Grant failed");
    }
    await reload();
  };

  const revokeAccess = async (partnerId: string, memberId: string) => {
    if (!confirm("Revoke this partner's portal access? They will revert to B2C pricing.")) return;
    const res = await adminFetch(`/admin/partners/${partnerId}/members/${memberId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Revoke failed");
    await reload();
  };

  const revokePartner = async (partnerId: string) => {
    if (!confirm("Revoke this entire partner organization and all member access?")) return;
    const res = await adminFetch(`/admin/partners/${partnerId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "revoked" }),
    });
    if (!res.ok) throw new Error("Revoke partner failed");
    await reload();
  };

  const deletePartner = async (partnerId: string) => {
    if (!confirm("Permanently delete this partner and all memberships?")) return;
    const res = await adminFetch(`/admin/partners/${partnerId}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete failed");
    await reload();
  };

  return {
    partners,
    loading,
    error,
    setError,
    reload,
    createPartner,
    grantAccess,
    revokeAccess,
    revokePartner,
    deletePartner,
  };
}
