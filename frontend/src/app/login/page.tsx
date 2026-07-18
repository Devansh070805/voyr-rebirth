"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../auth/context";
import { PiEnvelopeSimpleFill, PiLockKeyFill, PiArrowRightBold } from "react-icons/pi";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/chat";
  const { login, register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState("Individual");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }
    if (!password.trim() || password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setIsSubmitting(true);
    try {
      let userObj;
      if (isRegistering) {
        userObj = await register(email, password, accountType);
      } else {
        userObj = await login(email, password);
      }
      
      let finalReturnUrl = returnUrl;
      if (returnUrl === "/chat" || returnUrl === "/") {
        const type = userObj?.accountType || "Individual";
        if (type === "TravelAgent") finalReturnUrl = "/dashboard/agent";
        else if (type === "Corporate") finalReturnUrl = "/dashboard/corporate";
        else finalReturnUrl = "/dashboard/individual";
      }
      
      router.push(finalReturnUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-lg">
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
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50 animate-slide-up">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            {isRegistering ? "Create an account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {isRegistering
              ? "Enter your email and a password to get started."
              : "Enter your email and password to sign in."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8">
            <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
              Email address
            </label>
            <div className="relative mt-2">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <PiEnvelopeSimpleFill className="h-5 w-5 text-slate-400" />
              </div>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:opacity-60"
              />
            </div>

            <label htmlFor="password" className="mt-4 block text-sm font-semibold text-slate-700">
              Password
            </label>
            <div className="relative mt-2">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <PiLockKeyFill className="h-5 w-5 text-slate-400" />
              </div>
              <input
                id="password"
                type="password"
                autoComplete={isRegistering ? "new-password" : "current-password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:opacity-60"
              />
            </div>

            {isRegistering && (
              <>
                <label htmlFor="accountType" className="mt-4 block text-sm font-semibold text-slate-700">
                  Account Type
                </label>
                <div className="relative mt-2">
                  <select
                    id="accountType"
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-slate-200 bg-white py-4 px-4 text-sm text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:opacity-60"
                  >
                    <option value="Individual">Individual Customer</option>
                    <option value="TravelAgent">Travel Agent</option>
                    <option value="Corporate">Corporate User</option>
                  </select>
                </div>
              </>
            )}

            {error && (
              <p id="auth-error" className="mt-3 text-sm text-red-600 animate-shake" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-press mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-4 text-sm font-bold text-white shadow-lg shadow-violet-200 transition-all duration-200 hover:bg-violet-700 hover:shadow-xl hover:shadow-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:opacity-60"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {isRegistering ? "Creating account..." : "Signing in..."}
                </span>
              ) : (
                <>
                  {isRegistering ? "Create Account" : "Sign In"} <PiArrowRightBold className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            {isRegistering ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError("");
              }}
              className="font-semibold text-violet-600 hover:text-violet-500"
            >
              {isRegistering ? "Sign in" : "Sign up"}
            </button>
          </p>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          By continuing, you agree to Voyr&apos;s Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
          Loading...
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
