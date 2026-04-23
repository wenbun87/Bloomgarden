import { useState } from "react";
import { Check, Flame, X } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { todayUtc } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type StreakRow = {
  key: string;
  label: string;
  tint: string;
  cellClass: string;              // dark fill: actual log day
  lightCellClass?: string;        // light wash: qualifying period, non-log day
  periodType?: "week" | "month";  // how to expand the light wash from `qualifiedPeriods`
  qualifiedPeriods?: Set<string>; // period starts where the target/condition was met
  qualified: Set<string>;         // actual log days (dark cells)
};

type Props = {
  rows: StreakRow[];
  className?: string;
};

type View = "week" | "year";

const WEEK_DAYS = 7;
const YEAR_COLUMNS = 53;

function addDaysUtc(ymd: string, delta: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function weekStartOf(ymd: string): string {
  const d = new Date(ymd + "T00:00:00Z");
  const dow = d.getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function monthStartOf(ymd: string): string {
  const d = new Date(ymd + "T00:00:00Z");
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

function currentStreak(set: Set<string>, today: string): number {
  const yesterday = addDaysUtc(today, -1);
  const start = set.has(today) ? today : set.has(yesterday) ? yesterday : null;
  if (!start) return 0;
  let count = 0;
  let cursor = start;
  while (set.has(cursor)) {
    count += 1;
    cursor = addDaysUtc(cursor, -1);
  }
  return count;
}

export function StreakGridWidget({ rows, className }: Props) {
  const [view, setView] = useState<View>("year");
  const today = todayUtc();

  return (
    <WidgetCard
      title="Streaks"
      subtitle={view === "week" ? "Last 7 days" : "Last 365 days"}
      className={className}
      action={
        <div className="flex gap-1 rounded-pill bg-black/5 p-0.5 text-[10px]">
          {(["week", "year"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-pill px-2 py-0.5 capitalize transition",
                view === v
                  ? "bg-white shadow-sm"
                  : "text-[var(--color-muted)]",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      }
    >
      {view === "week" ? (
        <WeekGrid rows={rows} today={today} />
      ) : (
        <YearGrid rows={rows} today={today} />
      )}
    </WidgetCard>
  );
}

function WeekGrid({ rows, today }: { rows: StreakRow[]; today: string }) {
  const days = Array.from({ length: WEEK_DAYS }, (_, i) =>
    addDaysUtc(today, -(WEEK_DAYS - 1 - i)),
  );

  function weekday(ymd: string): string {
    const d = new Date(ymd + "T00:00:00Z");
    return d
      .toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" })
      .slice(0, 1)
      .toUpperCase();
  }

  function dayNum(ymd: string): string {
    return ymd.slice(8);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-y-1 text-sm">
        <thead>
          <tr>
            <th className="w-32 text-left text-[10px] font-normal uppercase tracking-wider text-[var(--color-muted)]"></th>
            {days.map((d) => (
              <th
                key={d}
                className={cn(
                  "min-w-[24px] px-0.5 text-center text-[9px] font-normal tracking-wider",
                  d === today
                    ? "text-[var(--color-ink)]"
                    : "text-[var(--color-muted)]",
                )}
              >
                <div className="uppercase">{weekday(d)}</div>
                <div className="tabular-nums">{dayNum(d)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const streak = currentStreak(row.qualified, today);
            return (
              <tr key={row.key}>
                <td
                  className={cn(
                    "rounded-l-pill bg-white/60 px-3 py-2 text-sm font-medium whitespace-nowrap",
                    row.tint,
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="truncate">{row.label}</span>
                    {streak >= 2 && (
                      <span className="flex shrink-0 items-center gap-0.5 text-[10px] tabular-nums text-amber-600">
                        <Flame size={10} />
                        {streak}
                      </span>
                    )}
                  </div>
                </td>
                {days.map((d, idx) => {
                  const hit = row.qualified.has(d);
                  const isLast = idx === days.length - 1;
                  return (
                    <td
                      key={d}
                      className={cn(
                        "bg-white/60 p-0.5 text-center",
                        isLast && "rounded-r-pill",
                      )}
                    >
                      <div
                        className={cn(
                          "mx-auto flex h-5 w-5 items-center justify-center rounded-pill",
                          hit
                            ? "bg-green-100 text-green-700"
                            : "text-[var(--color-muted)]/40",
                        )}
                      >
                        {hit ? <Check size={10} /> : <X size={10} />}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function YearGrid({ rows, today }: { rows: StreakRow[]; today: string }) {
  const todayDate = new Date(today + "T00:00:00Z");
  const todayDow = todayDate.getUTCDay();
  const todayRow = (todayDow + 6) % 7;
  const trailingFromLastCol = 6 - todayRow;
  const totalCells = YEAR_COLUMNS * 7;
  const firstDate = addDaysUtc(
    today,
    -(totalCells - 1 - trailingFromLastCol),
  );

  const grid: string[][] = Array.from({ length: 7 }, () => []);
  for (let col = 0; col < YEAR_COLUMNS; col++) {
    for (let row = 0; row < 7; row++) {
      const idx = col * 7 + row;
      grid[row].push(addDaysUtc(firstDate, idx));
    }
  }

  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  for (let col = 0; col < YEAR_COLUMNS; col++) {
    const d = new Date(grid[0][col] + "T00:00:00Z");
    const m = d.getUTCMonth();
    if (m !== lastMonth) {
      monthLabels.push({
        col,
        label: d.toLocaleDateString(undefined, {
          month: "short",
          timeZone: "UTC",
        }),
      });
      lastMonth = m;
    }
  }

  function inLightPeriod(row: StreakRow, ymd: string): boolean {
    if (!row.qualifiedPeriods || row.qualifiedPeriods.size === 0) return false;
    if (row.periodType === "week") {
      return row.qualifiedPeriods.has(weekStartOf(ymd));
    }
    if (row.periodType === "month") {
      return row.qualifiedPeriods.has(monthStartOf(ymd));
    }
    return false;
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const streak = currentStreak(row.qualified, today);
        const count = [...row.qualified].filter(
          (d) => d >= firstDate && d <= today,
        ).length;
        const pct = Math.round((count / 365) * 100);

        return (
          <div key={row.key}>
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className={cn("text-sm font-medium", row.tint)}>
                  {row.label}
                </span>
                {streak >= 2 && (
                  <span className="flex items-center gap-0.5 text-[10px] tabular-nums text-amber-600">
                    <Flame size={10} />
                    {streak}
                  </span>
                )}
              </div>
              <span className="text-[10px] tabular-nums text-[var(--color-muted)]">
                {count} days · {pct}%
              </span>
            </div>

            <div
              className="grid gap-[3px]"
              style={{
                gridTemplateColumns: `repeat(${YEAR_COLUMNS}, minmax(0, 1fr))`,
                gridTemplateRows: "repeat(7, minmax(0, 1fr))",
                gridAutoFlow: "column",
                aspectRatio: `${YEAR_COLUMNS} / 7`,
              }}
            >
              {Array.from({ length: YEAR_COLUMNS }).flatMap((_, col) =>
                Array.from({ length: 7 }, (__, r) => {
                  const d = grid[r][col];
                  const inRange = d >= firstDate && d <= today;
                  const hit = inRange && row.qualified.has(d);
                  const light = inRange && !hit && inLightPeriod(row, d);
                  return (
                    <div
                      key={`${col}-${r}`}
                      title={inRange ? d : ""}
                      className={cn(
                        "rounded-[3px]",
                        !inRange && "bg-transparent",
                        inRange && hit && row.cellClass,
                        inRange && !hit && light && row.lightCellClass,
                        inRange && !hit && !light && "bg-black/[0.06]",
                      )}
                    />
                  );
                }),
              )}
            </div>
            {monthLabels.length > 0 && (
              <div
                className="mt-1 grid text-[9px] text-[var(--color-muted)]"
                style={{
                  gridTemplateColumns: `repeat(${YEAR_COLUMNS}, minmax(0, 1fr))`,
                  columnGap: "3px",
                }}
              >
                {Array.from({ length: YEAR_COLUMNS }, (_, c) => {
                  const lbl = monthLabels.find((m) => m.col === c);
                  return (
                    <span
                      key={c}
                      className="whitespace-nowrap"
                      style={{ gridColumn: c + 1 }}
                    >
                      {lbl?.label ?? ""}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
