import { useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type LightboxItem = {
  id: string;
  url: string;
  caption?: React.ReactNode;
  actions?: React.ReactNode;
};

type Props = {
  items: LightboxItem[];
  index: number | null;
  onIndexChange: (i: number) => void;
  onClose: () => void;
};

export function GalleryLightbox({ items, index, onIndexChange, onClose }: Props) {
  const open = index !== null && index >= 0 && index < items.length;

  const go = useCallback(
    (delta: number) => {
      if (index === null || items.length === 0) return;
      const next = (index + delta + items.length) % items.length;
      onIndexChange(next);
    },
    [index, items.length, onIndexChange]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, go, onClose]);

  if (!open) return null;
  const item = items[index!];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-center justify-between gap-3 p-3 text-white">
        <span className="text-xs tabular-nums opacity-80">
          {index! + 1} / {items.length}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="text-white hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-2">
        {items.length > 1 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); go(-1); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 hover:text-white"
            aria-label="Previous"
          >
            <ChevronLeft className="h-7 w-7" />
          </Button>
        )}
        <img
          src={item.url}
          alt=""
          className="max-h-[80vh] max-w-[92vw] object-contain"
          onClick={(e) => e.stopPropagation()}
        />
        {items.length > 1 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); go(1); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 hover:text-white"
            aria-label="Next"
          >
            <ChevronRight className="h-7 w-7" />
          </Button>
        )}
      </div>

      {(item.caption || item.actions) && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 p-4 text-white"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-sm opacity-80">{item.caption}</div>
          <div className="flex gap-2">{item.actions}</div>
        </div>
      )}
    </div>
  );
}
