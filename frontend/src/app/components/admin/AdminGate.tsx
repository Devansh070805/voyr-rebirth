"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApi } from "../../auth/context";
import ProtectedRoute from "../../auth/ProtectedRoute";

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const { apiFetch } = useApi();
  const [state, setState] = useState<"loading" | "allowed" | "denied">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/admin/access");
        if (cancelled) return;
        if (res.ok) {
          const body = (await res.json()) as { admin?: boolean };
          setState(body.admin ? "allowed" : "denied");
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
          Checking admin access…
        </main>
      )}
      {state === "denied" && (
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
          <h1 className="text-xl font-bold text-slate-900">Admin access required</h1>
          <p className="max-w-md text-sm text-slate-600">
            Your account is not on the admin allowlist. Set{" "}
            <code className="rounded bg-slate-100 px-1">ADMIN_EMAILS</code> on the backend for your
            signed-in email.
          </p>
          <Link href="/" className="text-sm font-semibold text-violet-600 hover:underline">
            Back home
          </Link>
        </main>
      )}
      {state === "allowed" && children}
    </ProtectedRoute>
  );
}
