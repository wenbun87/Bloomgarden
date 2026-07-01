import { useEffect, useState } from "react";
import { Check, Flame, Trash2, X } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog } from "@/components/ui/Dialog";
import { supabase } from "@/lib/supabase";
import { todayUtc } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type StreakRow = {
  key: string;
  label: string;
  tint: string;
  cellClass: string;
  lightCellClass?: string;
  periodType?: "week" | "month";
  qualifiedPeriods?: Set<string>;
  qualified: Set<string>;
  // Tappable rows expose their habit kind so the popup knows what RPC to call.
  // Omit (undefined) for fully read-only rows.
  tappable?:
    | { kind: "builtin"; category: "exercise" | "hobby" | "mental_health" | "sleep" }
    | { kind: "custom"; habitId: string }
    | { kind: "social" }
    | { kind: "deposit"; depositKind: "savings" | "investment" };
};

type Props = {
  rows: StreakRow[];
  onChanged?: () => void;
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

export function StreakGridWidget({ rows, onChanged, className }: Props) {
  const [view, setView] = useState<View>("week");
  const today = todayUtc();
  const [editing, setEditing] = useState<{
    row: StreakRow;
    date: string;
  } | null>(null);

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
        <WeekGrid
          rows={rows}
          today={today}
          onCellClick={(row, date) => {
            if (row.tappable) setEditing({ row, date });
          }}
        />
      ) : (
        <YearGrid rows={rows} today={today} />
      )}

      {editing && (
        <EditDayDialog
          row={editing.row}
          date={editing.date}
          onClose={() => setEditing(null)}
          onChanged={() => {
            setEditing(null);
            onChanged?.();
          }}
        />
      )}
    </WidgetCard>
  );
}

function WeekGrid({
  rows,
  today,
  onCellClick,
}: {
  rows: StreakRow[];
  today: string;
  onCellClick: (row: StreakRow, date: string) => void;
}) {
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
      <p className="mb-2 text-[10px] text-[var(--color-muted)]">
        Tap any day to backtrack. Daily habits log a day; social toggles the
        week; savings & investing open the day's deposits.
      </p>
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
                  const tappable = !!row.tappable;
                  return (
                    <td
                      key={d}
                      className={cn(
                        "bg-white/60 p-0.5 text-center",
                        isLast && "rounded-r-pill",
                      )}
                    >
                      <button
                        type="button"
                        disabled={!tappable}
                        onClick={() => tappable && onCellClick(row, d)}
                        className={cn(
                          "mx-auto flex h-5 w-5 items-center justify-center rounded-pill transition",
                          hit
                            ? "bg-green-100 text-green-700"
                            : "text-[var(--color-muted)]/40",
                          tappable &&
                            "cursor-pointer hover:ring-2 hover:ring-[var(--color-accent)]/40",
                          !tappable && "cursor-default",
                        )}
                      >
                        {hit ? <Check size={10} /> : <X size={10} />}
                      </button>
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

function pretty(d: string): string {
  return new Date(d + "T00:00:00Z").toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function EditDayDialog({
  row,
  date,
  onClose,
  onChanged,
}: {
  row: StreakRow;
  date: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  if (!row.tappable) return null;
  const kind = row.tappable.kind;

  if (kind === "social") {
    return (
      <SocialWeekDialog
        row={row}
        date={date}
        onClose={onClose}
        onChanged={onChanged}
      />
    );
  }
  if (kind === "deposit") {
    return (
      <DepositDayDialog
        row={row}
        date={date}
        depositKind={row.tappable.depositKind}
        onClose={onClose}
        onChanged={onChanged}
      />
    );
  }
  return (
    <DailyToggleDialog
      row={row}
      date={date}
      onClose={onClose}
      onChanged={onChanged}
    />
  );
}

function DailyToggleDialog({
  row,
  date,
  onClose,
  onChanged,
}: {
  row: StreakRow;
  date: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLogged = row.qualified.has(date);

  async function toggle() {
    const t = row.tappable;
    if (!t || (t.kind !== "builtin" && t.kind !== "custom")) return;
    setBusy(true);
    setError(null);
    let err;
    if (isLogged) {
      const rpc =
        t.kind === "builtin"
          ? supabase.rpc("unlog_habit", {
              category_in: t.category,
              date_in: date,
            })
          : supabase.rpc("unlog_custom_habit", {
              habit_id_in: t.habitId,
              date_in: date,
            });
      ({ error: err } = await rpc);
    } else {
      const rpc =
        t.kind === "builtin"
          ? supabase.rpc("log_habit", {
              category_in: t.category,
              // Sleep qualifies on hours, not minutes. The other built-ins
              // qualify on minutes >= 30.
              minutes_in: t.category === "sleep" ? null : 30,
              value_in: t.category === "sleep" ? { hours: 7 } : null,
              date_in: date,
            })
          : supabase.rpc("log_custom_habit", {
              habit_id_in: t.habitId,
              date_in: date,
            });
      ({ error: err } = await rpc);
    }
    setBusy(false);
    if (err) return setError(err.message);
    onChanged();
  }

  return (
    <Dialog open onClose={onClose} title={row.label}>
      <div className="space-y-3">
        <p className="text-sm">
          <span className="text-[var(--color-muted)]">{pretty(date)}</span>
          <span className="block">
            {isLogged ? "Currently logged." : "Not logged."}
          </span>
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            Cancel
          </button>
          <Button
            onClick={toggle}
            disabled={busy}
            variant={isLogged ? "ghost" : "primary"}
          >
            {busy
              ? "Saving…"
              : isLogged
                ? "Remove log"
                : "Log this day"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function SocialWeekDialog({
  row,
  date,
  onClose,
  onChanged,
}: {
  row: StreakRow;
  date: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMarked = row.qualified.has(date);

  async function toggle() {
    setBusy(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("set_social_for_date", {
      date_in: date,
      on_flag: !isMarked,
    });
    setBusy(false);
    if (rpcErr) return setError(rpcErr.message);
    onChanged();
  }

  return (
    <Dialog open onClose={onClose} title={`Social — ${pretty(date)}`}>
      <div className="space-y-3">
        <p className="text-sm text-[var(--color-muted)]">
          {isMarked
            ? "Currently logged as a social day."
            : "Not logged as social yet."}
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            Cancel
          </button>
          <Button
            onClick={toggle}
            disabled={busy}
            variant={isMarked ? "ghost" : "primary"}
          >
            {busy
              ? "Saving…"
              : isMarked
                ? "Remove this day"
                : "Log this day"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

type DepositRow = { id: string; amount: number };

function DepositDayDialog({
  row,
  date,
  depositKind,
  onClose,
  onChanged,
}: {
  row: StreakRow;
  date: string;
  depositKind: "savings" | "investment";
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const tableName =
    depositKind === "savings" ? "savings_deposits" : "investment_deposits";

  async function loadDeposits() {
    setLoadingList(true);
    const { data, error: err } = await supabase
      .from(tableName)
      .select("id, amount")
      .eq("date", date)
      .order("created_at", { ascending: true });
    setLoadingList(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDeposits(
      ((data ?? []) as { id: string; amount: number | string }[]).map((r) => ({
        id: r.id,
        amount: Number(r.amount),
      })),
    );
  }

  useEffect(() => {
    loadDeposits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, depositKind]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const n = parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) return;
    setBusy(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("log_deposit_for_date", {
      kind_in: depositKind,
      amount_in: n,
      date_in: date,
    });
    setBusy(false);
    if (rpcErr) return setError(rpcErr.message);
    setAmount("");
    await loadDeposits();
    onChanged();
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("delete_deposit", {
      kind_in: depositKind,
      id_in: id,
    });
    setBusy(false);
    if (rpcErr) return setError(rpcErr.message);
    await loadDeposits();
    onChanged();
  }

  return (
    <Dialog open onClose={onClose} title={`${row.label} — ${pretty(date)}`}>
      <div className="space-y-3">
        {loadingList ? (
          <p className="text-xs text-[var(--color-muted)]">Loading…</p>
        ) : deposits.length === 0 ? (
          <p className="text-xs text-[var(--color-muted)]">
            No deposits logged on this day yet.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-line)]">
            {deposits.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="tabular-nums">
                  {d.amount.toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={() => remove(d.id)}
                  disabled={busy}
                  aria-label="Delete deposit"
                  className="text-[var(--color-muted)] hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={add} className="flex gap-2">
          <Input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={
              depositKind === "savings" ? "Amount saved" : "Amount invested"
            }
            className="flex-1"
          />
          <Button type="submit" disabled={busy || !amount.trim()}>
            {busy ? "…" : "Add"}
          </Button>
        </form>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            Done
          </button>
        </div>
      </div>
    </Dialog>
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
