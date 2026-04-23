import * as React from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ title, hint, action, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-8 text-center",
        className,
      )}
    >
      <p className="text-sm font-medium text-[var(--color-ink)]">{title}</p>
      {hint && <p className="text-xs text-[var(--color-muted)]">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
