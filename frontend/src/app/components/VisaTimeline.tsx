"use client";

import React from "react";
import { PiCheckCircleFill, PiClockFill, PiFileFill, PiFingerprintBold, PiMoneyFill, PiPaperclipFill } from "react-icons/pi";

interface TimelineStep {
  label: string;
  description: string;
  icon: React.ReactNode;
  days?: number;
}

interface VisaTimelineProps {
  visaType: string;
  processingMin: number | null;
  processingMax: number | null;
  feeAmount: number | null;
  feeCurrency: string;
}

export default function VisaTimeline({ visaType, processingMin, processingMax, feeAmount, feeCurrency }: VisaTimelineProps) {
  const hasDocs = processingMin != null && processingMax != null;

  const steps: TimelineStep[] = [
    {
      label: "Prepare Documents",
      description: "Gather all required documents as listed below",
      icon: <PiFileFill className="h-5 w-5" />,
      days: hasDocs ? 1 : undefined,
    },
    {
      label: "Submit Application",
      description: feeAmount
        ? `Complete online form and pay ${feeCurrency} ${feeAmount}`
        : "Complete online form and submit",
      icon: <PiPaperclipFill className="h-5 w-5" />,
      days: hasDocs ? 1 : undefined,
    },
    {
      label: "Biometrics / Interview",
      description: "Attend biometrics appointment at visa center if required",
      icon: <PiFingerprintBold className="h-5 w-5" />,
      days: hasDocs && processingMin > 0 ? Math.ceil(processingMin * 0.3) : undefined,
    },
    {
      label: "Processing",
      description: hasDocs
        ? `Visa application is processed by immigration authorities (typically ${processingMin}-${processingMax} days)`
        : "Visa application is processed by immigration authorities",
      icon: <PiClockFill className="h-5 w-5" />,
      days: hasDocs ? processingMax! - Math.ceil(processingMin! * 0.3) : undefined,
    },
    {
      label: "Receive Visa",
      description: "Collect your approved visa and verify all details are correct",
      icon: <PiCheckCircleFill className="h-5 w-5" />,
    },
  ];

  let cumulativeDays = 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
          <PiClockFill className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h3 className="font-bold text-slate-950">Visa Timeline</h3>
          <p className="text-sm text-slate-500">
            {hasDocs
              ? `Estimated total: ${processingMin}-${processingMax} business days for ${visaType}`
              : `Processing timeline for ${visaType}`}
          </p>
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-[27px] top-4 bottom-4 w-0.5 bg-violet-100" />

        <div className="space-y-6">
          {steps.map((step, idx) => {
            const dayStart = cumulativeDays;
            cumulativeDays += step.days || 0;
            const dayEnd = cumulativeDays;

            return (
              <div key={idx} className="relative flex items-start gap-4">
                <div className="relative z-10 flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-full border-2 border-violet-200 bg-violet-50 text-violet-600">
                  {step.icon}
                </div>
                <div className="flex-1 pt-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-800">{step.label}</h4>
                    {step.days != null && (
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-600">
                        Day {dayStart + 1}-{dayEnd}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-500 leading-relaxed">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {hasDocs && (
        <div className="mt-6 rounded-xl bg-slate-50 p-4 flex items-center gap-3">
          <PiMoneyFill className="h-5 w-5 text-slate-500" />
          <p className="text-sm text-slate-600">
            <strong>Total estimated time:</strong> {processingMin}-{processingMax} business days
            {feeAmount && <> • Fee: {feeCurrency} {feeAmount}</>}
          </p>
        </div>
      )}
    </div>
  );
}
