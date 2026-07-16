"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  PiCheckCircleFill,
  PiXCircleFill,
  PiSpinnerGapFill,
  PiArrowLeftFill,
  PiCreditCardFill,
} from "react-icons/pi";
import ProtectedRoute from "../../auth/ProtectedRoute";
import { useApi } from "../../auth/context";
import { clearPendingPayment, getPendingPayment } from "../../lib/payment-pending";

const POLL_MS = 4000;
const TERMINAL_STATUSES = new Set(["paid", "failed"]);

interface PaymentRecord {
  id: string;
  quote_id: string;
  status: string;
  amount: number;
  provider: string;
}

function PaymentReturnContent() {
  const { apiFetch } = useApi();
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("payment_id") || searchParams.get("paymentId");
  const urlStatus = searchParams.get("status");

  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pending = getPendingPayment();
  const conversationId = searchParams.get("conversation_id") || pending?.conversation_id;

  const terminalRef = useRef(false);

  const fetchPayment = useCallback(async (): Promise<PaymentRecord | null> => {
    if (!paymentId) return null;
    const res = await apiFetch(`/payment/${paymentId}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || "Could not load payment status");
    }
    return res.json() as Promise<PaymentRecord>;
  }, [apiFetch, paymentId]);

  useEffect(() => {
    if (!paymentId) {
      setError("Missing payment reference in the return URL.");
      setInitialLoading(false);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const record = await fetchPayment();
        if (cancelled || !record) return;
        setPayment(record);
        setError(null);
        if (TERMINAL_STATUSES.has(record.status)) {
          terminalRef.current = true;
          clearPendingPayment();
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load payment");
        }
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    };

    poll();
    const interval = setInterval(() => {
      if (terminalRef.current) return;
      poll();
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [paymentId, fetchPayment]);

  const isPaid = payment?.status === "paid" || urlStatus === "success" || urlStatus === "paid";
  const isFailed =
    payment?.status === "failed" || urlStatus === "failed" || urlStatus === "failure";
  const isTerminal = isPaid || isFailed;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-violet-50/40 px-4 py-16">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-200/50">
        {initialLoading ? (
          <div className="flex flex-col items-center py-8 text-center">
            <PiSpinnerGapFill className="h-10 w-10 animate-spin text-violet-500" />
            <p className="mt-4 text-sm font-medium text-slate-600">Confirming your payment…</p>
          </div>
        ) : error && !payment ? (
          <div className="text-center">
            <PiXCircleFill className="mx-auto h-12 w-12 text-red-500" />
            <h1 className="mt-4 text-xl font-bold text-slate-900">Payment status unknown</h1>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
          </div>
        ) : isPaid ? (
          <div className="text-center">
            <PiCheckCircleFill className="mx-auto h-14 w-14 text-emerald-500" />
            <h1 className="mt-4 text-2xl font-extrabold text-slate-900">Payment successful</h1>
            <p className="mt-2 text-sm text-slate-600">
              Your booking is confirmed. Check your trip chat and bookings page for updates.
            </p>
          </div>
        ) : isFailed ? (
          <div className="text-center">
            <PiXCircleFill className="mx-auto h-12 w-12 text-red-500" />
            <h1 className="mt-4 text-xl font-bold text-slate-900">Payment failed</h1>
            <p className="mt-2 text-sm text-slate-600">
              The payment did not complete. Try checkout again from your trip.
            </p>
          </div>
        ) : (
          <div className="text-center">
            <PiCreditCardFill className="mx-auto h-12 w-12 text-violet-500" />
            <h1 className="mt-4 text-xl font-bold text-slate-900">Payment processing</h1>
            <p className="mt-2 text-sm text-slate-600">
              Status: <span className="font-semibold">{payment?.status ?? "pending"}</span>.
              {!isTerminal && " This page updates automatically."}
            </p>
          </div>
        )}

        {payment && (
          <dl className="mt-6 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Payment ID</dt>
              <dd className="font-mono text-xs">{payment.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Quote</dt>
              <dd className="font-mono text-xs">{payment.quote_id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Amount</dt>
              <dd className="font-semibold">{payment.amount}</dd>
            </div>
          </dl>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {conversationId && (
            <Link
              href={`/chat?id=${conversationId}`}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white hover:bg-violet-700"
            >
              <PiArrowLeftFill className="h-4 w-4" />
              Back to trip
            </Link>
          )}
          <Link
            href="/bookings"
            className="flex flex-1 items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            View bookings
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function PaymentReturnPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center text-slate-500">
            Loading…
          </div>
        }
      >
        <PaymentReturnContent />
      </Suspense>
    </ProtectedRoute>
  );
}
