"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FeaturesGlobeSection } from "@/components/FeaturesGlobeSection";
import {
  PiCaretDownBold,
  PiGlobeFill,
  PiLightningFill,
  PiCalendarBlankFill,
  PiUsersFill,
  PiMapPinFill,
  PiWalletFill,
  PiChatCircleDotsFill,
  PiCreditCardFill,
  PiBriefcaseFill,
  PiArrowRightBold,
  PiMinusBold,
  PiPlusBold,
  PiIdentificationCardFill,
} from "react-icons/pi";


const destinations = [
  { name: "Bali, Indonesia", code: "ID", price: "₹29,999", tag: "Bestseller", image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=900&q=80" },
  { name: "Maldives", code: "MV", price: "₹49,999", image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80" },
  { name: "Dubai, UAE", code: "AE", price: "₹33,999", image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=900&q=80" },
  { name: "Switzerland", code: "CH", price: "₹79,999", image: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=900&q=80" },
];

const steps = [
  { icon: <PiChatCircleDotsFill className="h-8 w-8" />, iconClass: "text-slate-600", title: "Tell Us Your Preferences", body: "Share your destination, dates, budget and travel style." },
  { icon: <PiLightningFill className="h-8 w-8" />, iconClass: "text-amber-500", title: "AI Builds Your Itinerary", body: "Our AI creates a personalized itinerary just for you." },
  { icon: <PiCreditCardFill className="h-8 w-8" />, iconClass: "text-orange-500", title: "Review & Book", body: "Customize if needed and secure your booking." },
  { icon: <PiBriefcaseFill className="h-8 w-8" />, iconClass: "text-slate-700", title: "Pack Your Bags", body: "Get your vouchers and enjoy a hassle-free trip." },
];

const budgetOptions = [
  { label: "Any budget", value: "" },
  { label: "Under ₹30,000", value: "under 30000" },
  { label: "₹30,000 – ₹60,000", value: "30000-60000" },
  { label: "₹60,000 – ₹1,00,000", value: "60000-100000" },
  { label: "₹1,00,000 – ₹2,00,000", value: "100000-200000" },
  { label: "₹2,00,000 – ₹5,00,000", value: "200000-500000" },
  { label: "₹5,00,000 – ₹10,00,000", value: "500000-1000000" },
  { label: "Above ₹10,00,000", value: "above 1000000" },
];

const travelerAvatars = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=80&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=80&q=80",
];

function Logo() {
  return (
    <div className="flex items-center gap-3">
       <img src="/images/Voyr-logo.png" alt="Voyr" className="h-12 w-auto" />
       <div>
        <div className="text-2xl font-bold tracking-tight text-slate-950">Voyr</div>
        <div className="text-xs font-medium text-slate-500">Travel Beyond Limits</div>
      </div>
    </div>
  );
}


function TravelerPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm transition-all duration-200 hover:border-violet-300 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
      >
        <div className="flex items-center gap-3">
          <PiUsersFill className="h-5 w-5 text-slate-400" />
          <span className="text-slate-700">{value} {value === 1 ? "Traveler" : "Travelers"}</span>
        </div>
        <PiCaretDownBold className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-20 mt-2 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">Adults</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onChange(Math.max(1, value - 1))}
                disabled={value <= 1}
                className="btn-press flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-all duration-150 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600 disabled:opacity-30"
              >
                <PiMinusBold className="h-3 w-3" />
              </button>
              <span className="w-5 text-center text-sm font-bold text-slate-900">{value}</span>
              <button
                type="button"
                onClick={() => onChange(Math.min(20, value + 1))}
                disabled={value >= 20}
                className="btn-press flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-all duration-150 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600 disabled:opacity-30"
              >
                <PiPlusBold className="h-3 w-3" />
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="btn-press mt-2 w-full rounded-lg bg-violet-600 py-1.5 text-xs font-bold text-white transition-all duration-200 hover:bg-violet-700"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}


const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function DatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectedMonth = value ? parseInt(value.split("-")[1], 10) - 1 : -1;
  const selectedYear = value ? parseInt(value.split("-")[0], 10) : -1;

  const handleSelect = (monthIdx: number) => {
    const m = String(monthIdx + 1).padStart(2, "0");
    onChange(`${viewYear}-${m}`);
    setOpen(false);
  };

  const displayText = value
    ? `${MONTHS[selectedMonth]} ${selectedYear}`
    : "";

  const isPast = (monthIdx: number) => {
    if (viewYear > now.getFullYear()) return false;
    if (viewYear < now.getFullYear()) return true;
    return monthIdx < now.getMonth();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm transition-all duration-200 hover:border-violet-300 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
      >
        <div className="flex items-center gap-3">
          <PiCalendarBlankFill className="h-5 w-5 text-slate-400" />
          <span className={value ? "text-slate-700" : "text-slate-400"}>
            {displayText || "Select month"}
          </span>
        </div>
        <PiCaretDownBold className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-xl border border-slate-200 bg-white p-4 shadow-xl animate-scale-in">
          {/* Year navigation */}
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewYear((y) => Math.max(now.getFullYear(), y - 1))}
              disabled={viewYear <= now.getFullYear()}
              className="btn-press flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
            >
              <PiCaretDownBold className="h-3.5 w-3.5 rotate-90" />
            </button>
            <span className="text-sm font-bold text-slate-800">{viewYear}</span>
            <button
              type="button"
              onClick={() => setViewYear((y) => Math.min(now.getFullYear() + 2, y + 1))}
              disabled={viewYear >= now.getFullYear() + 2}
              className="btn-press flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
            >
              <PiCaretDownBold className="h-3.5 w-3.5 -rotate-90" />
            </button>
          </div>
          {/* Month grid */}
          <div className="grid grid-cols-3 gap-1.5">
            {MONTHS.map((m, idx) => {
              const past = isPast(idx);
              const selected = selectedYear === viewYear && selectedMonth === idx;
              return (
                <button
                  key={m}
                  type="button"
                  disabled={past}
                  onClick={() => handleSelect(idx)}
                  className={`btn-press rounded-lg py-2 text-xs font-semibold transition-all duration-150 ${
                    selected
                      ? "bg-violet-600 text-white shadow-sm shadow-violet-200"
                      : past
                        ? "text-slate-300 cursor-not-allowed"
                        : "text-slate-600 hover:bg-violet-50 hover:text-violet-700"
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
          {value && (
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className="mt-3 w-full text-center text-xs font-semibold text-slate-400 transition-colors hover:text-red-500"
            >
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  );
}


function BudgetPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = budgetOptions.find((o) => o.value === value) || budgetOptions[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm transition-all duration-200 hover:border-violet-300 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
      >
        <div className="flex items-center gap-3">
          <PiWalletFill className="h-5 w-5 text-slate-400" />
          <span className={value ? "text-slate-700" : "text-slate-400"}>{selected.label}</span>
        </div>
        <PiCaretDownBold className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl animate-scale-in">
          {budgetOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`flex w-full px-4 py-3 text-left text-sm transition-colors hover:bg-violet-50 ${
                value === opt.value ? "bg-violet-50 font-semibold text-violet-700" : "text-slate-600"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


function TripForm() {
  const router = useRouter();
  const [destination, setDestination] = useState("");
  const [dates, setDates] = useState("");
  const [travelers, setTravelers] = useState(2);
  const [budget, setBudget] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    // Build a natural language message from the form values
    const parts: string[] = [];

    if (destination.trim()) {
      parts.push(`I want to plan a trip to ${destination.trim()}`);
    } else {
      parts.push("I want to plan a trip");
    }

    parts.push(`for ${travelers} ${travelers === 1 ? "person" : "people"}`);

    if (dates) {
      const [y, m] = dates.split("-");
      const monthName = ["January","February","March","April","May","June","July","August","September","October","November","December"][parseInt(m, 10) - 1];
      parts.push(`in ${monthName} ${y}`);
    }

    if (budget) {
      const budgetLabel = budgetOptions.find((o) => o.value === budget)?.label || budget;
      parts.push(`with a budget of ${budgetLabel}`);
    }

    const message = parts.join(" ") + ". Please suggest an itinerary with a budget breakdown.";

    // Navigate to chat with the pre-filled message as a query param
    router.push(`/chat?message=${encodeURIComponent(message)}`);
  };

  const handleDestinationClick = (name: string) => {
    setDestination(name);
    inputRef.current?.focus();
  };

  return (
    <>
      <div className="mt-10 max-w-6xl rounded-2xl border border-slate-200 bg-white/95 shadow-2xl shadow-slate-300/40 backdrop-blur-xl animate-slide-up stagger-8">
        <div className="flex border-b border-slate-200 px-6">
          <button className="flex items-center gap-2 border-b-2 border-violet-600 px-4 py-5 text-sm font-bold text-violet-600">
            <PiLightningFill className="h-4 w-4" /> Create with AI
          </button>
          <a href="/chat" className="px-8 py-5 text-sm font-semibold text-slate-600 hover:text-slate-950 transition-colors">Build Your Own</a>
        </div>

        <div className="grid gap-5 px-6 py-7 lg:grid-cols-[1.5fr_1fr_1fr_1.2fr_auto]">
          {/* Destination */}
          <label className="block">
            <span className="mb-3 block text-sm font-bold text-slate-700">Where to?</span>
            <div className="relative">
              <PiMapPinFill className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Bali, Thailand"
                className="w-full rounded-xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-sm text-slate-700 placeholder:text-slate-400 transition-all duration-200 hover:border-violet-300 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
              />
            </div>
          </label>

          {/* Dates */}
          <div>
            <span className="mb-3 block text-sm font-bold text-slate-700">When?</span>
            <DatePicker value={dates} onChange={setDates} />
          </div>

          {/* Travelers */}
          <div>
            <span className="mb-3 block text-sm font-bold text-slate-700">Travelers</span>
            <TravelerPicker value={travelers} onChange={setTravelers} />
          </div>

          {/* Budget */}
          <div>
            <span className="mb-3 block text-sm font-bold text-slate-700">Budget</span>
            <BudgetPicker value={budget} onChange={setBudget} />
          </div>

          {/* Submit */}
          <div>
            <span className="invisible mb-3 block text-sm font-bold">Submit</span>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="btn-press flex h-[54px] min-w-48 items-center justify-center gap-2 rounded-xl bg-violet-600 px-7 text-sm font-bold text-white shadow-xl shadow-violet-200 transition-all duration-200 hover:bg-violet-700 hover:shadow-2xl hover:shadow-violet-300 hover:scale-[1.02] disabled:opacity-60"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Creating...
                </span>
              ) : (
                <>
                  <PiLightningFill className="h-4 w-4" /> Create My Trip
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 px-8 pb-7 text-sm text-slate-500">
          <div className="flex -space-x-2">
            {travelerAvatars.map((src) => (
              <img key={src} src={src} alt="Traveler" className="h-8 w-8 rounded-full border-2 border-white object-cover" />
            ))}
          </div>
          <span>10,000+ travelers have planned their dream trips with AI</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 px-2">
        <span className="text-xs font-semibold text-slate-400">Popular:</span>
        {["Bali", "Maldives", "Dubai", "Thailand", "Switzerland", "Japan"].map((d) => (
          <button
            key={d}
            onClick={() => handleDestinationClick(d)}
            className="btn-press rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition-all duration-200 hover:border-violet-300 hover:text-violet-600 hover:shadow-md"
          >
            {d}
          </button>
        ))}
      </div>
    </>
  );
}


export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-950">
      {/* Header */}
       <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/85 backdrop-blur-xl">
         <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 lg:px-10">
          <Logo />
          <nav className="hidden items-center gap-10 text-sm font-medium text-slate-700 lg:flex">
            <a className="flex items-center gap-1 hover:text-violet-600" href="#destinations">Destinations <PiCaretDownBold className="h-4 w-4" /></a>
            <a className="hover:text-violet-600" href="#experiences">Experiences</a>
            <a className="hover:text-violet-600" href="#packages">Packages</a>
            <a className="hover:text-violet-600" href="#about">About Us</a>
            <a className="hover:text-violet-600" href="#support">Support</a>
            <a className="hover:text-violet-600" href="/partner">B2B Partners</a>
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-sm font-medium text-slate-500 md:flex">
              <PiGlobeFill className="h-4 w-4" /> INR
            </span>
            <a href="/login" className="interactive rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300">Log in</a>
            <a href="/login" className="interactive rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-200 hover:bg-violet-700 hover:shadow-xl hover:-translate-y-0.5">Sign up</a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <img
              src="/images/hero-section-background.jpg"
              alt="Travel background"
              className="h-full w-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/85 to-white/5" />
            <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-white to-transparent" />
          </div>

          {/* Plane — before content div so text naturally stacks on top */}
          <img
            src="/images/hero-section-floater-left-side-plane.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute left-[40%] top-[16%] w-[126px] animate-float hidden lg:block"
          />

          <div className="relative mx-auto max-w-7xl px-6 pb-36 pt-20 lg:px-10 lg:pt-49">
            <div className="max-w-2xl">
              <h1 className="text-6xl font-semibold leading-relaxed tracking-tight text-slate-950 md:text-7xl animate-slide-up">
                Your Dream Trip,
                <span className="block animate-slide-up stagger-2 bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent py-4">Designed by AI</span>
              </h1>
              <p className="mt-4 max-w-xl text-xl leading-8 text-slate-700 animate-fade-in stagger-6">
                Tell us your preferences and our AI creates a custom itinerary tailored to your style and budget.
              </p>
            </div>

            {/* Interactive Trip Creation Form */}
            <TripForm />
          </div>
        </section>

        <FeaturesGlobeSection />

         <section id="destinations" className="mx-auto max-w-7xl px-6 py-[168px] lg:px-10">
            <div className="mb-9 flex items-end justify-between">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-violet-600">Popular Destinations</p>
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl">Explore Top Destinations</h2>
            </div>
            <a href="/chat" className="hidden items-center gap-2 text-sm font-semibold text-violet-600 md:flex">View all destinations <PiArrowRightBold className="h-4 w-4" /></a>
          </div>

          <div className="relative grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {destinations.map((d, idx) => (
              <article key={d.name} className="group relative h-72 overflow-hidden rounded-xl shadow-xl shadow-slate-200 card-hover animate-slide-up" style={{ animationDelay: `${idx * 100}ms` }}>
                  <img src={d.image} alt={d.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                {d.tag && <div className="absolute left-5 top-5 rounded-full bg-violet-600 px-4 py-2 text-xs font-bold text-white">{d.tag}</div>}
                <div className="absolute bottom-5 left-5 right-5 text-white">
                  <h3 className="text-xl font-bold">{d.name}</h3>
                  <p className="mt-1 text-sm text-white/85">Starting from {d.price}</p>
                  <a
                    href={`/travel-visa?destination=${d.code}`}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/30 transition-colors"
                  >
                    <PiIdentificationCardFill className="h-4 w-4" /> Check Visa
                  </a>
                </div>
              </article>
            ))}
            <button className="absolute -right-7 top-1/2 hidden h-16 w-16 -translate-y-1/2 items-center justify-center rounded-full bg-white text-violet-600 shadow-2xl shadow-slate-300 lg:flex">
              <PiArrowRightBold className="h-6 w-6" />
            </button>
          </div>
        </section>

         <section className="mx-auto max-w-7xl px-6 py-17 lg:px-10">
          <div className="text-center">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.25em] text-violet-600">How It Works</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl">Plan. Book. Travel. Relax.</h2>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step.title} className="relative rounded-2xl border border-slate-200 bg-white p-8 shadow-sm card-hover animate-slide-up" style={{ animationDelay: `${index * 120}ms` }}>
                <div className="absolute -top-4 left-6 flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white shadow-lg shadow-violet-200">{index + 1}</div>
                <div className={`mb-8 ${step.iconClass}`}>{step.icon}</div>
                <h3 className="text-lg font-bold text-slate-950">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-500">{step.body}</p>
                {index !== steps.length - 1 && <PiArrowRightBold className="absolute -right-6 top-1/2 hidden h-5 w-5 text-slate-300 lg:block" />}
              </div>
            ))}
          </div>
        </section>

         <section className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
          <div className="grid items-center gap-8 rounded-2xl bg-slate-50 px-9 py-8 shadow-sm md:grid-cols-[1.2fr_repeat(5,1fr)]">
            <p className="text-sm font-medium leading-6 text-slate-600">Trusted by 10,000+ travelers and powered by industry-leading partners</p>
            {["Razorpay", "AWS", "Cloudflare", "Resend"].map((logo) => (
              <div key={logo} className="text-center text-lg font-bold tracking-tight text-slate-400">{logo}</div>
            ))}
          </div>
        </section>

         <section className="mx-auto max-w-7xl px-6 pb-32 pt-14 lg:px-10">
           <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-9 py-8 text-white shadow-2xl shadow-violet-200 md:px-12">
            <div className="absolute bottom-0 left-1/2 hidden -translate-x-1/2 opacity-10 md:block">
              <div className="flex items-center gap-5 text-7xl text-white">
                 <img src="/images/Voyr-logo.png" alt="Voyr" className="h-17 w-auto" />
                <PiLightningFill className="h-12 w-12" />
                <PiMapPinFill className="h-10 w-10" />
              </div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <img src="/images/illustration.png" alt="Travel illustration" className="w-[336px] h-auto object-contain" />
            </div>
            <div className="relative z-10 grid items-center gap-8 md:grid-cols-2">
              <div>
                <h2 className="max-w-md text-4xl font-extrabold leading-tight tracking-tight">Ready to plan your next adventure?</h2>
                <p className="mt-5 max-w-md text-base leading-7 text-white/85">Join thousands of happy travelers and let our AI design your perfect trip.</p>
              </div>
              <div className="flex flex-col gap-4 md:items-end">
                <a href="/chat" className="btn-press flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-white px-7 py-4 text-sm font-bold text-violet-600 shadow-lg transition-all duration-200 hover:bg-violet-50 hover:shadow-xl hover:scale-[1.02]">
                  Start Planning with AI <PiLightningFill className="h-4 w-4" />
                </a>
                <a href="/chat" className="btn-press w-full max-w-xs rounded-xl border border-white/60 px-7 py-4 text-center text-sm font-bold text-white transition-all duration-200 hover:bg-white/10 hover:border-white">Explore Packages</a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2">
                 <img src="/images/Voyr-logo.png" alt="Voyr" className="h-9 w-auto" />
                <span className="text-lg font-bold text-slate-900">Voyr</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-500">AI-powered travel planning that creates personalized itineraries tailored to your style.</p>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Product</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
                <li><a href="/chat" className="hover:text-violet-600 transition-colors">AI Planner</a></li>
                <li><a href="#destinations" className="hover:text-violet-600 transition-colors">Destinations</a></li>
                <li><a href="#" className="hover:text-violet-600 transition-colors">Pricing</a></li>
                <li><a href="/partner" className="hover:text-violet-600 transition-colors">B2B Partner Portal</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Company</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
                <li><a href="#" className="hover:text-violet-600 transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-violet-600 transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-violet-600 transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-violet-600 transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Legal</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
                <li><a href="#" className="hover:text-violet-600 transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-violet-600 transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-violet-600 transition-colors">Refund Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-slate-100 pt-6 flex items-center justify-between text-xs text-slate-400">
            <span>&copy; 2026 Voyr. All rights reserved.</span>
            <span>Made with AI in India</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
