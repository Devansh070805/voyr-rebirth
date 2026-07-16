"use client";

import { useCallback, useEffect, useState } from "react";
import { useApi } from "../../auth/context";
import type { CuratedListingRow, ListingTabKey } from "./types";

export function useListingsAdminTab(tab: ListingTabKey) {
  const { adminFetch } = useApi();
  const [data, setData] = useState<CuratedListingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch(`/admin/listings?type=${tab}`);
      if (!res.ok) throw new Error("Failed to load listings");
      const json = await res.json();
      setData((json.listings as CuratedListingRow[]) || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [adminFetch, tab]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload, setError };
}
