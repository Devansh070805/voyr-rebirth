"use client";

import { Suspense, useState, useRef, useEffect, FormEvent, KeyboardEvent, ClipboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../auth/context";
import { PiArrowLeftBold, PiShieldCheckFill } from "react-icons/pi";

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const returnUrl = searchParams.get("returnUrl") || "/chat";
  const { verifyOtp, login } = useAuth();

  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect to login if no email
  useEffect(() => {
    if (!email) {
      router.replace("/login");
    }
  }, [email, router]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const focusInput = (index: number) => {
    inputRefs.current[index]?.focus();
  };

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    setError("");

    // Auto-advance to next input
    if (digit && index < 5) {
      focusInput(index + 1);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      focusInput(index - 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 0) return;

    const newOtp = [...otp];
    for (let i = 0; i < 6; i++) {
      newOtp[i] = pasted[i] || "";
    }
    setOtp(newOtp);
    setError("");

    // Focus the next empty input or the last one
    const nextEmpty = newOtp.findIndex((d) => !d);
    focusInput(nextEmpty === -1 ? 5 : nextEmpty);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const code = otp.join("");
    if (code.length !== 6) {
      setError("Please enter the complete 6-digit code");
      return;
    }

    setIsSubmitting(true);
    try {
      await verifyOtp(email, code);
      router.push(returnUrl.startsWith("/") ? returnUrl : "/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed. Please try again.");
      // Clear OTP on error
      setOtp(["", "", "", "", "", ""]);
      focusInput(0);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await login(email);
      setResendCooldown(60);
      setError("");
      setOtp(["", "", "", "", "", ""]);
      focusInput(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend OTP");
    }
  };

  if (!email) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex justify-center animate-fade-in">
          <div className="inline-flex items-center gap-2.5">
            <img
              src="/images/Voyr-logo.png"
              alt="Voyr"
              className="block h-12 w-auto shrink-0"
            />
            <div className="text-left leading-tight">
              <div className="text-xl font-bold tracking-tight text-slate-950">Voyr</div>
              <div className="text-[10px] font-medium text-slate-400">AI Travel Planner</div>
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
          <button
            onClick={() => router.push("/login")}
            className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700"
            aria-label="Back to login"
          >
            <PiArrowLeftBold className="h-4 w-4" /> Back
          </button>

          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-600">
              <PiShieldCheckFill className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Verify your email</h1>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            We&apos;ve sent a 6-digit code to{" "}
            <span className="font-semibold text-slate-700">{email}</span>.
            Enter it below to sign in.
          </p>

          <form onSubmit={handleSubmit} className="mt-8">
            <label className="block text-sm font-semibold text-slate-700">
              Verification code
            </label>
            <div className="mt-3 flex gap-3" role="group" aria-label="OTP input">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  disabled={isSubmitting}
                  className="h-14 w-full rounded-xl border border-slate-200 bg-white text-center text-xl font-bold text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:opacity-60"
                  aria-label={`Digit ${index + 1}`}
                />
              ))}
            </div>

            {error && (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || otp.join("").length !== 6}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-4 text-sm font-bold text-white shadow-lg shadow-violet-200 hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:opacity-60"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Verifying...
                </span>
              ) : (
                "Verify & Sign In"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              Didn&apos;t receive the code?{" "}
              <button
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className="font-semibold text-violet-600 hover:text-violet-700 disabled:text-slate-400"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
              </button>
            </p>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          By continuing, you agree to Voyr&apos;s Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
