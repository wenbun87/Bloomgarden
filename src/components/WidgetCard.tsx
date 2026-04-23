import * as React from "react";
import { cn } from "@/lib/utils";

type Props = {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;   // small muted text above the title (e.g. "daily")
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

export function WidgetCard({
  title,
  subtitle,
  action,
  className,
  children,
}: Props) {
  return (
    <section
      className={cn(
        "min-w-0 overflow-hidden rounded-card border border-white/60 bg-surface backdrop-blur-card shadow-card p-5",
        className,
      )}
    >
      {(title || action || subtitle) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {subtitle && (
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                {subtitle}
              </p>
            )}
            {title && (
              <h3 className="font-display text-sm font-semibold tracking-tight text-[var(--color-ink)]">
                {title}
              </h3>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className="text-sm text-[var(--color-ink)]">{children}</div>
    </section>
  );
}
