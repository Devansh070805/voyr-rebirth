"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApi } from "../../auth/context";
import ProtectedRoute from "../../auth/ProtectedRoute";

export default function PartnerGate({ children }: { children: React.ReactNode }) {
  const { apiFetch } = useApi();
  const [state, setState] = useState<"loading" | "allowed" | "denied">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/partner/access");
        if (cancelled) return;
        if (res.ok) {
          const body = (await res.json()) as { has_access?: boolean };
          setState(body.has_access ? "allowed" : "denied");
        } else {
          setState("denied");
        }
      } catch {
        if (!cancelled) setState("denied");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  return (
    <ProtectedRoute>
      {state === "loading" && (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
          Verifying partner access…
        </main>
      )}
      {state === "denied" && (
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
          <h1 className="text-xl font-bold text-slate-900">B2B access required</h1>
          <p className="max-w-md text-sm text-slate-600">
            Your account does not have active B2B partner access. Contact your Voyr account
            manager to request portal access.
          </p>
          <div className="flex gap-4">
            <Link href="/" className="text-sm font-semibold text-violet-600 hover:underline">
              Consumer site
            </Link>
            <Link href="/partner" className="text-sm font-semibold text-slate-500 hover:underline">
              Partner home
            </Link>
          </div>
        </main>
      )}
      {state === "allowed" && children}
    </ProtectedRoute>
  );
}
