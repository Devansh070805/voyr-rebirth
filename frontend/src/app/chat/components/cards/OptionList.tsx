"use client";

interface OptionListProps {
  children: React.ReactNode;
}

export default function OptionList({ children }: OptionListProps) {
  return <div className="divide-y divide-slate-100">{children}</div>;
}
