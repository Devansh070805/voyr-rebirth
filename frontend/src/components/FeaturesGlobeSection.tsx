"use client";

import dynamic from "next/dynamic";
import {
  PiHeadsetFill,
  PiLightningFill,
  PiShieldCheckFill,
  PiWalletFill,
} from "react-icons/pi";
import { globeArcs, voyrGlobeConfig } from "@/data/globe-arcs";

const World = dynamic(() => import("@/components/ui/globe").then((m) => m.World), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-48 w-48 animate-pulse rounded-full border border-violet-200 bg-white" />
    </div>
  ),
});

const FEATURES = [
  {
    icon: PiLightningFill,
    title: "AI-Powered Itineraries",
    body: "Smart recommendations tailored just for you",
  },
  {
    icon: PiShieldCheckFill,
    title: "Best Price Guarantee",
    body: "We ensure you get the best value always",
  },
  {
    icon: PiWalletFill,
    title: "Secure Payments",
    body: "100% secure payment and booking",
  },
  {
    icon: PiHeadsetFill,
    title: "24/7 Support",
    body: "We're here for you, anytime, anywhere",
  },
] as const;

export function FeaturesGlobeSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24 lg:px-10">
      <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <div className="relative mx-auto h-[22rem] w-full max-w-xl sm:h-[26rem] lg:mx-0 lg:h-[32rem]">
          <div className="absolute inset-0">
            <World data={globeArcs} globeConfig={voyrGlobeConfig} />
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent" />
        </div>

        <div className="flex flex-col gap-4">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-violet-600">
            Why Voyr
          </p>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-950 md:text-4xl">
            Travel smarter, everywhere
          </h2>
          <p className="mb-2 max-w-md text-base leading-7 text-slate-500">
            From AI planning to secure checkout, every part of your journey is built for confidence.
          </p>

          <div className="mt-2 flex flex-col gap-3">
            {FEATURES.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="group flex items-start gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all duration-300 hover:border-violet-200 hover:shadow-md animate-slide-up"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-200 transition-transform duration-300 group-hover:scale-105">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="text-base font-bold text-slate-950">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{item.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
