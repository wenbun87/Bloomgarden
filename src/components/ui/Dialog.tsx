import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

export function Dialog({ open, onClose, title, className, children }: Props) {
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <button
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 bg-black/30 backdrop-blur-sm"
      />
      <div className="relative z-10 flex min-h-full items-center justify-center p-4">
        <div
          className={cn(
            "relative w-full max-w-md rounded-card border border-white/60 bg-white shadow-card",
            className,
          )}
        >
          {title && (
            <header className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-3">
              <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              >
                <X size={16} />
              </button>
            </header>
          )}
          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
