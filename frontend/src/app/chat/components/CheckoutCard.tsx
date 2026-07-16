"use client";

import { PiCreditCardFill, PiArrowSquareOutFill, PiCheckCircleFill } from "react-icons/pi";
import { savePendingPayment } from "../../lib/payment-pending";

interface CheckoutCardProps {
  quote_id: string;
  checkout_url?: string;
  payment_id?: string;
  return_url?: string;
  conversation_id?: string;
  success?: boolean;
  error?: string;
}

export default function CheckoutCard({
  quote_id,
  checkout_url,
  payment_id,
  return_url,
  conversation_id,
  success = true,
  error,
}: CheckoutCardProps) {
  const handleCheckout = () => {
    if (!checkout_url) return;
    if (payment_id) {
      savePendingPayment({
        payment_id,
        quote_id,
        conversation_id: conversation_id ?? null,
      });
    }
    window.open(checkout_url, "_blank", "noopener,noreferrer");
  };

  if (!success || error) {
    return (
      <div className="mt-4 overflow-hidden rounded-xl border border-red-200 bg-red-50 shadow-sm">
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <PiCreditCardFill className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-red-900">Checkout Failed</h3>
            <p className="mt-0.5 text-sm text-red-700">{error || "Unable to start checkout"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-indigo-50 shadow-sm animate-bounce-in">
      <div className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100">
            <PiCreditCardFill className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-violet-900">Checkout Ready</h3>
              <PiCheckCircleFill className="h-5 w-5 text-violet-500" />
            </div>
            <p className="mt-0.5 text-sm text-violet-700">Your payment session is ready</p>
          </div>
        </div>

        {checkout_url && (
          <button
            type="button"
            onClick={handleCheckout}
            className="btn-press mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-violet-200 transition-all duration-200 hover:bg-violet-700 hover:shadow-lg hover:shadow-violet-300 hover:scale-[1.02]"
          >
            <PiCreditCardFill className="h-4 w-4" />
            Proceed to Payment
            <PiArrowSquareOutFill className="h-4 w-4" />
          </button>
        )}

        {return_url && (
          <a
            href={return_url}
            className="mt-3 block text-center text-xs font-semibold text-violet-600 underline hover:text-violet-800"
          >
            After payment, view status
          </a>
        )}

        <div className="mt-3 flex items-center justify-between text-xs text-violet-400">
          {payment_id && <span>Payment ID: {payment_id}</span>}
          <span>Quote: {quote_id}</span>
        </div>
      </div>
    </div>
  );
}
