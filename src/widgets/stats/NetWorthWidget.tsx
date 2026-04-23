import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LineChart, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog } from "@/components/ui/Dialog";
import { supabase } from "@/lib/supabase";
import type { Account, NetWorthPoint } from "@/hooks/useAccounts";
import { cn } from "@/lib/utils";

type Props = {
  userId: string;
  accounts: Account[];
  history: NetWorthPoint[];
  onChanged: () => void;
  className?: string;
};

const TYPE_LABEL: Record<Account["type"], string> = {
  cash: "Cash",
  investment: "Investments",
  retirement: "Retirement",
  property: "Property",
  crypto: "Crypto",
  debt: "Debt",
  other: "Other",
};

const TYPE_ORDER: Account["type"][] = [
  "cash",
  "investment",
  "retirement",
  "property",
  "crypto",
  "debt",
  "other",
];

export function NetWorthWidget({
  userId,
  accounts,
  history,
  onChanged,
  className,
}: Props) {
  const [editing, setEditing] = useState<Account | "new" | null>(null);
  const [projectionOpen, setProjectionOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [monthly, setMonthly] = useState(
    () => localStorage.getItem("nw:monthly") ?? "500",
  );
  const [rate, setRate] = useState(
    () => localStorage.getItem("nw:rate") ?? "7",
  );
  const [years, setYears] = useState(
    () => localStorage.getItem("nw:years") ?? "30",
  );
  useEffect(() => {
    localStorage.setItem("nw:monthly", monthly);
    localStorage.setItem("nw:rate", rate);
    localStorage.setItem("nw:years", years);
  }, [monthly, rate, years]);
  const [analysis, setAnalysis] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ok"; analysis: string; suggestions: string[] }
    | { kind: "error"; msg: string }
  >({ kind: "idle" });

  async function runAnalysis() {
    setAnalysis({ kind: "loading" });
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) return setAnalysis({ kind: "error", msg: "Not signed in." });

    const monthly = parseFloat(localStorage.getItem("nw:monthly") ?? "500");
    const rate = parseFloat(localStorage.getItem("nw:rate") ?? "7");
    const years = parseInt(localStorage.getItem("nw:years") ?? "30", 10);
    const r = rate / 100 / 12;
    const n = years * 12;
    const currentTotal = accounts.reduce((s, a) => s + Number(a.balance), 0);
    const fv =
      r === 0
        ? currentTotal + monthly * n
        : currentTotal * Math.pow(1 + r, n) +
          monthly * ((Math.pow(1 + r, n) - 1) / r);

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_WORKER_URL}/analysis/net-worth`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accounts: accounts.map((a) => ({
              name: a.name,
              type: a.type,
              balance: Number(a.balance),
            })),
            total: currentTotal,
            projection: { monthly, rate_pct: rate, years, future_value: fv },
          }),
        },
      );
      if (!resp.ok) {
        const msg = await resp.text();
        return setAnalysis({ kind: "error", msg });
      }
      const data = (await resp.json()) as {
        analysis: string;
        suggestions: string[];
      };
      setAnalysis({
        kind: "ok",
        analysis: data.analysis,
        suggestions: data.suggestions,
      });
    } catch (err) {
      setAnalysis({
        kind: "error",
        msg: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Debt accounts subtract from net worth. Users enter balances as positive.
  const total = useMemo(
    () =>
      accounts.reduce(
        (sum, a) =>
          sum + (a.type === "debt" ? -Number(a.balance) : Number(a.balance)),
        0,
      ),
    [accounts],
  );

  const byType = useMemo(() => {
    const m = new Map<Account["type"], number>();
    for (const a of accounts) {
      m.set(a.type, (m.get(a.type) ?? 0) + Number(a.balance));
    }
    return m;
  }, [accounts]);

  const chartData = useMemo(
    () =>
      history.map((h) => ({
        ts: new Date(h.captured_at).getTime(),
        total: h.total,
      })),
    [history],
  );

  return (
    <WidgetCard
      title="Net worth"
      className={className}
      action={
        <button
          onClick={() => setEditing("new")}
          className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:brightness-90"
        >
          <Plus size={12} />
          Account
        </button>
      }
    >
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-3xl font-semibold tabular-nums">
            {total.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          </p>
          <p className="text-xs text-[var(--color-muted)]">Total (all accounts)</p>
        </div>
        {chartData.length >= 2 && (
          <div className="h-16 w-32 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="nw-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--color-accent)"
                      stopOpacity={0.5}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--color-accent)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const v = payload[0].value as number;
                    return (
                      <div className="rounded-card border border-[var(--color-border)] bg-white px-2 py-1 text-xs shadow-sm">
                        {v.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}
                      </div>
                    );
                  }}
                />
                <XAxis dataKey="ts" hide />
                <YAxis hide domain={["auto", "auto"]} />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="var(--color-accent)"
                  strokeWidth={1.5}
                  fill="url(#nw-grad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {byType.size > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2 text-xs">
          {TYPE_ORDER.map((t) => {
            const v = byType.get(t);
            if (!v) return null;
            const isDebt = t === "debt";
            return (
              <li
                key={t}
                className="rounded-pill bg-white/60 px-2 py-0.5 text-[var(--color-muted)]"
              >
                {TYPE_LABEL[t]}:{" "}
                <span
                  className={cn(
                    "tabular-nums",
                    isDebt ? "text-red-600" : "text-[var(--color-ink)]",
                  )}
                >
                  {isDebt ? "−" : ""}
                  {v.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <ul className="mt-3 divide-y divide-[var(--color-border)]">
        {accounts.length === 0 && (
          <li className="py-4 text-center text-xs text-[var(--color-muted)]">
            No accounts yet. Add one to start tracking.
          </li>
        )}
        {accounts.map((a) => (
          <li
            key={a.id}
            className="group flex items-center gap-3 py-1.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.name}</p>
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                {TYPE_LABEL[a.type]}
              </p>
            </div>
            <span
              className={cn(
                "tabular-nums text-sm",
                a.type === "debt" && "text-red-600",
              )}
            >
              {a.type === "debt" ? "−" : ""}
              {Number(a.balance).toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}
            </span>
            <button
              onClick={() => setEditing(a)}
              aria-label="Edit"
              className="opacity-0 transition group-hover:opacity-100 text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            >
              <Pencil size={12} />
            </button>
          </li>
        ))}
      </ul>

      {accounts.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-[var(--color-border)] pt-3">
          <button
            type="button"
            onClick={() => {
              if (!analysisOpen && analysis.kind === "idle") runAnalysis();
              setAnalysisOpen((v) => !v);
            }}
            className="flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            <Sparkles size={11} />
            {analysisOpen ? "Hide analysis" : "Analyze portfolio"}
          </button>
          {analysisOpen && (
            <div className="mt-3 space-y-3 rounded-card border border-[var(--color-border)] bg-white/60 p-3">
              {analysis.kind === "loading" && (
                <p className="text-xs text-[var(--color-muted)]">Thinking…</p>
              )}
              {analysis.kind === "error" && (
                <p className="text-xs text-red-600">{analysis.msg}</p>
              )}
              {analysis.kind === "ok" && (
                <>
                  <p className="text-xs leading-relaxed text-[var(--color-ink)]">
                    {analysis.analysis}
                  </p>
                  {analysis.suggestions.length > 0 && (
                    <ul className="space-y-1.5">
                      {analysis.suggestions.map((s, i) => (
                        <li
                          key={i}
                          className="rounded-card border border-[var(--color-border)] bg-[var(--color-accent-soft)]/40 px-3 py-1.5 text-xs"
                        >
                          {s}
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={runAnalysis}
                    className="text-[10px] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                  >
                    Re-run
                  </button>
                </>
              )}
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => setProjectionOpen((v) => !v)}
              className="flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            >
              <LineChart size={11} />
              {projectionOpen ? "Hide projection" : "Project retirement"}
            </button>
            {projectionOpen && (
              <ProjectionPanel
                startingValue={total}
                monthly={monthly}
                setMonthly={setMonthly}
                rate={rate}
                setRate={setRate}
                years={years}
                setYears={setYears}
              />
            )}
          </div>
        </div>
      )}

      {editing && (
        <AccountDialog
          userId={userId}
          account={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}

    </WidgetCard>
  );
}

function ProjectionPanel({
  startingValue,
  monthly,
  setMonthly,
  rate,
  setRate,
  years,
  setYears,
}: {
  startingValue: number;
  monthly: string;
  setMonthly: (v: string) => void;
  rate: string;
  setRate: (v: string) => void;
  years: string;
  setYears: (v: string) => void;
}) {
  const projection = useMemo(() => {
    const pmt = parseFloat(monthly) || 0;
    const r = (parseFloat(rate) || 0) / 100 / 12;
    const n = (parseInt(years, 10) || 0) * 12;
    if (r === 0) return startingValue + pmt * n;
    const growth = Math.pow(1 + r, n);
    return startingValue * growth + pmt * ((growth - 1) / r);
  }, [monthly, rate, years, startingValue]);

  return (
    <div className="mt-3 space-y-3 rounded-card border border-[var(--color-border)] bg-white/60 p-3">
      <div className="grid grid-cols-3 gap-2">
        <SmallField
          label="Monthly"
          value={monthly}
          onChange={setMonthly}
          step="1"
        />
        <SmallField
          label="Return %"
          value={rate}
          onChange={setRate}
          step="0.1"
        />
        <SmallField label="Years" value={years} onChange={setYears} step="1" />
      </div>
      <div className="rounded-card bg-[var(--color-accent-soft)] p-3 text-center">
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
          Projected in {parseInt(years, 10) || 0} years
        </p>
        <p className="tabular-nums text-xl font-semibold">
          {projection.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
      </div>
    </div>
  );
}

function SmallField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step: string;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full rounded-pill border border-[var(--color-border)] bg-white px-3 text-sm tabular-nums outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
      />
    </label>
  );
}

function AccountDialog({
  userId,
  account,
  onClose,
  onSaved,
}: {
  userId: string;
  account: Account | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<Account["type"]>(account?.type ?? "cash");
  const [balance, setBalance] = useState(
    account?.balance?.toString() ?? "0",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(balance);
    if (!name.trim() || !Number.isFinite(amount)) return;
    setBusy(true);
    setError(null);
    if (account) {
      const { error: upErr } = await supabase
        .from("accounts")
        .update({ name: name.trim(), type, balance: amount })
        .eq("id", account.id);
      if (upErr) {
        setBusy(false);
        return setError(upErr.message);
      }
    } else {
      const { error: insErr } = await supabase
        .from("accounts")
        .insert({ user_id: userId, name: name.trim(), type, balance: amount });
      if (insErr) {
        setBusy(false);
        return setError(insErr.message);
      }
    }
    setBusy(false);
    onSaved();
  }

  async function remove() {
    if (!account) return;
    if (!confirm(`Delete ${account.name}?`)) return;
    setBusy(true);
    const { error: delErr } = await supabase
      .from("accounts")
      .delete()
      .eq("id", account.id);
    setBusy(false);
    if (delErr) return setError(delErr.message);
    onSaved();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={account ? "Edit account" : "Add account"}
    >
      <form onSubmit={save} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
            Name
          </span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Checking, index ISA, pension…"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
            Type
          </span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as Account["type"])}
            className="h-10 w-full rounded-pill border border-[var(--color-border)] bg-white/80 px-4 text-sm"
          >
            <option value="cash">Cash</option>
            <option value="investment">Investments</option>
            <option value="retirement">Retirement</option>
            <option value="property">Property</option>
            <option value="crypto">Crypto</option>
            <option value="debt">Debt (reduces net worth)</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
            Balance
          </span>
          <Input
            type="number"
            step="0.01"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            required
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center justify-between">
          {account ? (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="flex items-center gap-1 text-xs text-red-600 hover:brightness-90"
            >
              <Trash2 size={12} />
              Delete
            </button>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

