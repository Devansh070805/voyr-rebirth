"use client";

import Link from "next/link";
import { PiSignInFill } from "react-icons/pi";

export default function ChatGuestBanner({ returnPath }: { returnPath?: string }) {
  const loginHref = returnPath
    ? `/login?returnUrl=${encodeURIComponent(returnPath)}`
    : "/login";

  return (
    <div
      className="flex items-center justify-between gap-4 border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-sm text-amber-900"
      role="status"
    >
      <span>
        Sign in to save trips, sync across devices, and complete checkout.
      </span>
      <Link
        href={loginHref}
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
      >
        <PiSignInFill className="h-3.5 w-3.5" /> Sign in
      </Link>
    </div>
  );
}
