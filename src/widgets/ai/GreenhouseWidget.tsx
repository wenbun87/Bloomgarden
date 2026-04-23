import { useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Flower, TrendingDown, TrendingUp } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { EmptyState } from "@/components/EmptyState";
import type { PortfolioState } from "@/hooks/useBriefs";
import { cn } from "@/lib/utils";

type Props = { portfolio: PortfolioState | null; className?: string };

export function GreenhouseWidget({ portfolio, className }: Props) {
  const [tradesOpen, setTradesOpen] = useState(false);

  if (!portfolio) {
    return (
      <WidgetCard
        title="The Greenhouse"
        className={className}
        action={<Flower size={14} className="text-[var(--color-muted)]" />}
      >
        <EmptyState
          title="Portfolio not seeded yet"
          hint="The first rebalance runs on Sunday."
        />
      </WidgetCard>
    );
  }

  const { cash, holdings, trades, snapshots } = portfolio;
  const latestNarrative = [...snapshots]
    .reverse()
    .find((s) => s.narrative)?.narrative ?? null;

  const currentValue = useMemo(() => {
    // Prefer the latest snapshot; fall back to cash if nothing else.
    return snapshots[snapshots.length - 1]?.total_value ?? cash;
  }, [snapshots, cash]);

  const vsSp500 = useMemo(() => {
    const last = snapshots[snapshots.length - 1];
    if (!last) return null;
    const pct =
      last.sp500_value === 0
        ? 0
        : ((last.total_value - last.sp500_value) / last.sp500_value) * 100;
    return pct;
  }, [snapshots]);

  const chartData = useMemo(
    () =>
      snapshots.map((s) => ({
        ts: new Date(s.snapshot_at).getTime(),
        portfolio: s.total_value,
        sp500: s.sp500_value,
      })),
    [snapshots],
  );

  const lastTrades = trades.slice(0, 8);

  return (
    <WidgetCard
      title="The Greenhouse"
      className={className}
      action={
        <span className="text-xs text-[var(--color-muted)]">
          shared portfolio
        </span>
      }
    >
      <p className="mb-3 text-xs text-[var(--color-muted)]">
        A shared $10,000 simulated portfolio tended by AI. Every Sunday it
        rebalances using current prices and recent news, and the same
        positions are visible to every gardener.
      </p>

      {latestNarrative && (
        <div className="mb-3 rounded-card border border-[var(--color-border)] bg-[var(--color-accent-soft)]/40 p-3">
          <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
            State of the portfolio
          </p>
          <p className="text-xs leading-relaxed">{latestNarrative}</p>
        </div>
      )}

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-semibold tabular-nums">
            ${currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-[var(--color-muted)]">
            Cash ${cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            {vsSp500 !== null && (
              <span
                className={cn(
                  "ml-2 inline-flex items-center gap-0.5",
                  vsSp500 >= 0 ? "text-green-600" : "text-red-600",
                )}
              >
                {vsSp500 >= 0 ? (
                  <TrendingUp size={10} />
                ) : (
                  <TrendingDown size={10} />
                )}
                {vsSp500 >= 0 ? "+" : ""}
                {vsSp500.toFixed(1)}% vs S&P
              </span>
            )}
          </p>
        </div>
        {chartData.length >= 2 && (
          <div className="h-16 w-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-card border border-[var(--color-border)] bg-white px-2 py-1 text-xs shadow-sm">
                        {payload.map((p) => (
                          <p
                            key={p.name}
                            style={{ color: p.color }}
                            className="tabular-nums"
                          >
                            {p.name}: $
                            {(p.value as number).toLocaleString(undefined, {
                              maximumFractionDigits: 0,
                            })}
                          </p>
                        ))}
                      </div>
                    );
                  }}
                />
                <XAxis dataKey="ts" hide />
                <YAxis hide domain={["auto", "auto"]} />
                <Line
                  type="monotone"
                  name="Greenhouse"
                  dataKey="portfolio"
                  stroke="var(--color-accent)"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  name="S&P"
                  dataKey="sp500"
                  stroke="var(--color-muted)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="mt-3">
        <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
          The bed ({holdings.length} holdings)
        </p>
        {holdings.length === 0 ? (
          <p className="text-xs text-[var(--color-muted)]">All in cash.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {holdings.map((h) => (
              <li
                key={h.ticker}
                className="flex items-center justify-between py-1 text-sm"
              >
                <span className="font-medium">{h.ticker}</span>
                <span className="tabular-nums text-xs text-[var(--color-muted)]">
                  {h.shares} × ${h.avg_cost.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {lastTrades.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
            Latest reasoning
          </p>
          <ul className="space-y-2">
            {lastTrades.slice(0, tradesOpen ? lastTrades.length : 1).map((t) => (
              <li
                key={t.id}
                className="rounded-card border border-[var(--color-border)] bg-white/60 p-2 text-xs"
              >
                <p className="font-medium">
                  <span
                    className={cn(
                      "rounded-pill px-1.5 py-0.5 text-[9px] uppercase",
                      t.action === "buy"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700",
                    )}
                  >
                    {t.action}
                  </span>{" "}
                  {t.shares} {t.ticker} @ ${t.price.toFixed(2)}
                </p>
                <p className="mt-1 text-[var(--color-muted)]">{t.rationale}</p>
              </li>
            ))}
          </ul>
          {lastTrades.length > 1 && (
            <button
              onClick={() => setTradesOpen((v) => !v)}
              className="text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            >
              {tradesOpen
                ? "Show less"
                : `Show ${lastTrades.length - 1} more trade${lastTrades.length - 1 === 1 ? "" : "s"}`}
            </button>
          )}
        </div>
      )}

      <p className="mt-3 text-[10px] italic text-[var(--color-muted)]">
        Simulated portfolio for entertainment / education. Not financial advice.
      </p>
    </WidgetCard>
  );
}
