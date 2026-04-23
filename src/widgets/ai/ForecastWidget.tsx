import { ArrowDown, ArrowUp, Cloud } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { EmptyState } from "@/components/EmptyState";
import type { MarketBrief } from "@/hooks/useBriefs";
import { cn } from "@/lib/utils";

const INDEX_LABEL: Record<string, string> = {
  sp500: "S&P 500",
  nasdaq: "Nasdaq",
  dow: "Dow",
  vix: "VIX",
};

type Props = { brief: MarketBrief | null; className?: string };

export function ForecastWidget({ brief, className }: Props) {
  if (!brief) {
    return (
      <WidgetCard
        title="The Forecast"
        className={className}
        action={<Cloud size={14} className="text-[var(--color-muted)]" />}
      >
        <EmptyState
          title="No brief yet today"
          hint="The Forecast refreshes after US market close."
        />
      </WidgetCard>
    );
  }

  const { indices_json: indices, movers_json: movers, summary } = brief;

  return (
    <WidgetCard
      title="The Forecast"
      className={className}
      action={
        <span className="text-xs text-[var(--color-muted)]">{brief.date}</span>
      }
    >
      <p className="mt-1 text-xs text-[var(--color-muted)]">{summary}</p>

      <ul className="mt-3 grid grid-cols-4 gap-1">
        {Object.entries(INDEX_LABEL).map(([key, label]) => {
          const idx = indices[key];
          if (!idx) return <li key={key} />;
          const up = idx.change_pct >= 0;
          return (
            <li
              key={key}
              className="rounded-card border border-[var(--color-border)] bg-white/70 p-2 text-center"
            >
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                {label}
              </p>
              <p className="tabular-nums text-sm font-medium">
                {idx.price.toFixed(2)}
              </p>
              <p
                className={cn(
                  "tabular-nums text-[10px]",
                  up ? "text-green-600" : "text-red-600",
                )}
              >
                {up ? "+" : ""}
                {idx.change_pct.toFixed(2)}%
              </p>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <MoverList
          title="Warming"
          items={movers.gainers}
          icon={<ArrowUp size={10} className="text-green-600" />}
        />
        <MoverList
          title="Cooling"
          items={movers.losers}
          icon={<ArrowDown size={10} className="text-red-600" />}
        />
      </div>

      <p className="mt-3 text-[10px] italic text-[var(--color-muted)]">
        Not financial advice.
      </p>
    </WidgetCard>
  );
}

function MoverList({
  title,
  items,
  icon,
}: {
  title: string;
  items: { symbol: string; change_pct: number; price: number }[];
  icon: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
        {icon}
        {title}
      </p>
      <ul className="space-y-0.5">
        {items.map((m) => (
          <li key={m.symbol} className="flex items-center justify-between">
            <span className="font-medium">{m.symbol}</span>
            <span className="tabular-nums">
              {m.change_pct >= 0 ? "+" : ""}
              {m.change_pct.toFixed(2)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
