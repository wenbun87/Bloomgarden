import * as React from "react";
import { cn } from "@/lib/utils";

type Props = {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
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
        "min-w-0 overflow-hidden rounded-card border border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-[0_1px_0_rgba(0,0,0,0.03),0_4px_16px_rgba(60,40,20,0.04)]",
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
              <h3 className="text-[13px] font-bold tracking-tight text-[var(--color-ink)]">
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
