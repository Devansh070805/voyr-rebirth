"use client";

import { useCallback, useEffect, useState } from "react";
import { useApi } from "../../auth/context";
import type { CorrectionRow, DocumentRow, FeeRow, RequirementRow, VisaTabKey } from "./types";

type TabData = RequirementRow[] | DocumentRow[] | FeeRow[] | CorrectionRow[];

function listPath(tab: VisaTabKey, passport: string): string {
  if (tab === "requirements") return `/admin/visa/admin/requirements?passport=${passport}`;
  if (tab === "documents") return "/admin/visa/admin/documents";
  if (tab === "fees") return "/admin/visa/admin/fees";
  return "/travel-visa/corrections";
}

function parseList(tab: VisaTabKey, json: Record<string, unknown>): TabData {
  if (tab === "corrections") return (json.corrections as CorrectionRow[]) || [];
  return (json[tab] as TabData) || [];
}

export function useVisaAdminTab(tab: VisaTabKey, passport: string) {
  const { adminFetch } = useApi();
  const [data, setData] = useState<TabData>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch(listPath(tab, passport));
      if (!res.ok) throw new Error("Failed to load data");
      const json = await res.json();
      setData(parseList(tab, json));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [adminFetch, tab, passport]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload, setError };
}
