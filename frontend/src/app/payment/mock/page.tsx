"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PiCreditCardFill, PiSpinnerGapFill } from "react-icons/pi";
import ProtectedRoute from "../../auth/ProtectedRoute";
import { useApi } from "../../auth/context";

function MockCheckoutContent() {
  const { apiFetch } = useApi();
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("payment_id");
  const [loading, setLoading] = useState<"paid" | "failed" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const complete = async (status: "paid" | "failed") => {
    if (!paymentId) return;
    setLoading(status);
    setError(null);
    try {
      const res = await apiFetch("/payment/mock/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_id: paymentId, status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || "Could not complete mock payment");
      }
      router.push(`/payment/return?payment_id=${encodeURIComponent(paymentId)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(null);
    }
  };

  if (!paymentId) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-slate-600">Missing payment_id in URL.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-amber-50/40 px-4 py-16">
      <div className="mx-auto max-w-md rounded-2xl border border-amber-200 bg-white p-8 shadow-lg">
        <div className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-amber-800">
          Mock checkout — no real charge
        </div>
        <PiCreditCardFill className="mx-auto mt-4 h-12 w-12 text-violet-500" />
        <h1 className="mt-4 text-center text-xl font-bold text-slate-900">Simulate payment</h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          Payment ID: <span className="font-mono text-xs">{paymentId}</span>
        </p>
        {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}
        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => complete("paid")}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading === "paid" ? <PiSpinnerGapFill className="animate-spin" /> : null}
            Mark as paid
          </button>
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => complete("failed")}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {loading === "failed" ? <PiSpinnerGapFill className="animate-spin" /> : null}
            Mark as failed
          </button>
          <Link href="/chat" className="text-center text-sm text-violet-600 hover:underline">
            Back to chat
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function MockPaymentPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <main className="flex min-h-screen items-center justify-center">
            <PiSpinnerGapFill className="h-8 w-8 animate-spin text-violet-500" />
          </main>
        }
      >
        <MockCheckoutContent />
      </Suspense>
    </ProtectedRoute>
  );
}
