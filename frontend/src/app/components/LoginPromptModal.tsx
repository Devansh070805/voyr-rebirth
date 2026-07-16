"use client";

import Link from "next/link";
import { PiXBold, PiSignInFill } from "react-icons/pi";

export default function LoginPromptModal({
  open,
  onClose,
  returnPath,
}: {
  open: boolean;
  onClose: () => void;
  returnPath: string;
}) {
  if (!open) return null;

  const loginHref = `/login?returnUrl=${encodeURIComponent(returnPath)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        role="dialog"
        aria-labelledby="login-prompt-title"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="login-prompt-title" className="text-lg font-bold text-slate-900">
            Sign in to continue
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <PiXBold className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Create an account or sign in to chat with Voyr AI, save your itinerary, and book trips.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href={loginHref}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-700"
          >
            <PiSignInFill className="h-4 w-4" /> Sign in
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
