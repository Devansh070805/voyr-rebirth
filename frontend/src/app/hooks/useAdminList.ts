"use client";

import { useCallback, useEffect, useState } from "react";
import { useApi } from "../auth/context";

export function useAdminList<T>(path: string) {
  const { adminFetch } = useApi();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch(path);
      if (!res.ok) throw new Error("Failed to load data");
      const json = await res.json();
      setData(Array.isArray(json) ? json : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [adminFetch, path]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload, setError };
}
