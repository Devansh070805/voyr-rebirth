"use client";

import { PiXBold } from "react-icons/pi";

interface ImagePreviewProps {
  url: string;
  onRemove: () => void;
}

export default function ImagePreview({ url, onRemove }: ImagePreviewProps) {
  return (
    <div className="relative inline-block rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <img
        src={url}
        alt="Upload preview"
        className="max-h-32 w-auto object-cover"
      />
      <button
        onClick={onRemove}
        className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800/60 text-white hover:bg-slate-800 transition-colors"
        aria-label="Remove image"
      >
        <PiXBold className="h-3 w-3" />
      </button>
    </div>
  );
}
