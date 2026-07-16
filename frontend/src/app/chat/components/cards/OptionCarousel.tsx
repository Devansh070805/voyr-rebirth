"use client";

interface OptionCarouselProps {
  children: React.ReactNode;
}

export default function OptionCarousel({ children }: OptionCarouselProps) {
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  );
}
