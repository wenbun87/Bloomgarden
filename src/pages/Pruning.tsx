import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Coins,
  Gift,
  Pencil,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/EmptyState";
import { usePruneItems, type PruneItem, type PruneStatus } from "@/hooks/usePruneItems";
import { supabase } from "@/lib/supabase";
import { todayUtc } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Props = { userId: string };

const STATUS_LABEL: Record<PruneStatus, string> = {
  listed: "Listed",
  given: "Given away",
  sold: "Sold",
};

const STATUS_TINT: Record<PruneStatus, string> = {
  listed: "bg-amber-100 text-amber-800",
  given: "bg-violet-100 text-violet-800",
  sold: "bg-emerald-100 text-emerald-800",
};

type Filter = "all" | PruneStatus;

export default function Pruning({ userId }: Props) {
  const { items, loading, error, reload } = usePruneItems(userId);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);

  // Quick-add form
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [initialStatus, setInitialStatus] = useState<PruneStatus>("listed");
  const [eventDate, setEventDate] = useState(todayUtc());

  // Pin scroll position across reloads triggered by row actions (transition,
  // save edits, delete). Without this, re-sorting items into different
  // groups makes the page jump because the user's anchor item has moved.
  const pinScrollRef = useRef<number | null>(null);
  function pinScroll() {
    pinScrollRef.current = window.scrollY;
  }
  useEffect(() => {
    if (pinScrollRef.current !== null) {
      const y = pinScrollRef.current;
      pinScrollRef.current = null;
      requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "auto" }));
    }
  }, [items]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setOpError(null);
    const v = value.trim() ? Number(value) : null;
    const d = eventDate || todayUtc();
    const row = {
      user_id: userId,
      title: title.trim(),
      status: initialStatus,
      value: Number.isFinite(v as number) ? v : null,
      funds_received:
        initialStatus === "sold" && Number.isFinite(v as number) ? v : null,
      listed_at: initialStatus === "listed" ? d : null,
      given_at: initialStatus === "given" ? d : null,
      sold_at: initialStatus === "sold" ? d : null,
    };
    const { error: err } = await supabase.from("prune_items").insert(row);
    setBusy(false);
    if (err) {
      setOpError(err.message);
      return;
    }
    setTitle("");
    setValue("");
    setInitialStatus("listed");
    setEventDate(todayUtc());
    reload();
  }

  async function transition(
    item: PruneItem,
    to: PruneStatus,
    soldPrice?: number,
    soldDate?: string,
  ) {
    pinScroll();
    setBusy(true);
    setOpError(null);
    const today = todayUtc();
    const updates: Partial<PruneItem> = { status: to };
    if (to === "listed" && !item.listed_at) updates.listed_at = today;
    if (to === "given") updates.given_at = today;
    if (to === "sold") {
      updates.sold_at = soldDate || today;
      // Caller passes the confirmed sale price (from the inline prompt).
      // Falls back to existing funds_received, then value, then 0.
      updates.funds_received =
        soldPrice ?? item.funds_received ?? item.value ?? 0;
    }
    const { error: err } = await supabase
      .from("prune_items")
      .update(updates)
      .eq("id", item.id);
    setBusy(false);
    if (err) {
      setOpError(err.message);
      return;
    }
    reload();
  }

  async function setSoldFunds(item: PruneItem, fundsRaw: string) {
    const n = Number(fundsRaw);
    if (!Number.isFinite(n) || n < 0) return;
    pinScroll();
    setBusy(true);
    setOpError(null);
    const { error: err } = await supabase
      .from("prune_items")
      .update({ funds_received: n })
      .eq("id", item.id);
    setBusy(false);
    if (err) {
      setOpError(err.message);
      return;
    }
    reload();
  }

  async function saveEdits(item: PruneItem, patch: Partial<PruneItem>) {
    pinScroll();
    setBusy(true);
    setOpError(null);
    const { error: err } = await supabase
      .from("prune_items")
      .update(patch)
      .eq("id", item.id);
    setBusy(false);
    if (err) {
      setOpError(err.message);
      return false;
    }
    reload();
    return true;
  }

  async function remove(item: PruneItem) {
    if (!confirm(`Remove "${item.title}"?`)) return;
    pinScroll();
    setBusy(true);
    setOpError(null);
    const { error: err } = await supabase
      .from("prune_items")
      .delete()
      .eq("id", item.id);
    setBusy(false);
    if (err) {
      setOpError(err.message);
      return;
    }
    reload();
  }

  const filtered = useMemo(() => {
    const subset =
      filter === "all" ? items : items.filter((i) => i.status === filter);
    // When showing "all", group by status: listed → sold → given away so the
    // still-in-flux items stay at the top. Within a group, most recent
    // event-date first.
    const statusOrder = { listed: 0, sold: 1, given: 2 } as const;
    const eventDate = (i: PruneItem) =>
      i.status === "listed"
        ? i.listed_at
        : i.status === "given"
          ? i.given_at
          : i.sold_at;
    return [...subset].sort((a, b) => {
      if (filter === "all") {
        const so = statusOrder[a.status] - statusOrder[b.status];
        if (so !== 0) return so;
      }
      const da = eventDate(a) ?? a.created_at;
      const db = eventDate(b) ?? b.created_at;
      return db.localeCompare(da);
    });
  }, [items, filter]);

  // All-time counts: based on whether each *_at date is set, not on current
  // status. An item that went listed → sold counts for both "listed" and
  // "sold", so transitioning doesn't shrink the lifetime totals.
  const counts = useMemo(() => {
    const c = { listed: 0, given: 0, sold: 0, fundsReceived: 0 };
    for (const i of items) {
      if (i.listed_at) c.listed += 1;
      if (i.given_at) c.given += 1;
      if (i.sold_at) {
        c.sold += 1;
        if (i.funds_received) c.fundsReceived += i.funds_received;
      }
    }
    return c;
  }, [items]);

  // "Currently listed" — items still in flux waiting for a buyer or to be
  // given. The other stages (given, sold) are terminal so their lifetime
  // total is the same as the current count.
  const currentlyListed = useMemo(
    () => items.filter((i) => i.status === "listed").length,
    [items],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Pruning</h1>
        <p className="page-sub">
          Cut back what doesn't serve. List, give away, and sell — track the
          flow of stuff out of your life.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Listed"
          value={currentlyListed}
          tint={STATUS_TINT.listed}
        />
        <StatTile
          label="Given"
          value={counts.given}
          tint={STATUS_TINT.given}
        />
        <StatTile
          label="Sold"
          value={counts.sold}
          tint={STATUS_TINT.sold}
        />
        <StatTile
          label="Received"
          value={counts.fundsReceived.toLocaleString()}
          tint="bg-[var(--color-cream)] text-[var(--color-accent)]"
        />
      </div>

      {/* Quick add */}
      <WidgetCard title="Add an item">
        <form onSubmit={add} className="space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What is it? (e.g. old chair, books)"
            className="w-full"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Value (optional)"
              className="flex-1 min-w-[140px]"
            />
            <Input
              type="date"
              value={eventDate}
              max={todayUtc()}
              onChange={(e) => setEventDate(e.target.value)}
              className="min-w-[160px]"
              aria-label={`Date ${STATUS_LABEL[initialStatus].toLowerCase()}`}
              title={`Date ${STATUS_LABEL[initialStatus].toLowerCase()}`}
            />
            <div className="flex gap-1 rounded-pill bg-black/5 p-0.5 text-[10px]">
              {(["listed", "given", "sold"] as PruneStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setInitialStatus(s)}
                  className={cn(
                    "rounded-pill px-3 py-1 capitalize transition",
                    initialStatus === s
                      ? "bg-white shadow-sm font-semibold"
                      : "text-[var(--color-muted)]",
                  )}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            <Button type="submit" disabled={busy || !title.trim()}>
              <Plus size={14} />
              Add
            </Button>
          </div>
        </form>
        {opError && <p className="mt-2 text-xs text-red-600">{opError}</p>}
      </WidgetCard>

      {/* All-time summary + activity graph */}
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <WidgetCard title="All time">
          <ul className="space-y-1.5 text-sm">
            <li className="flex justify-between">
              <span className="text-[var(--color-muted)]">Listed</span>
              <span className="tabular-nums font-semibold">
                {counts.listed}
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-[var(--color-muted)]">Given away</span>
              <span className="tabular-nums font-semibold">
                {counts.given}
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-[var(--color-muted)]">Sold</span>
              <span className="tabular-nums font-semibold">
                {counts.sold}
              </span>
            </li>
            <li className="flex justify-between">
              <span className="text-[var(--color-muted)]">Funds received</span>
              <span className="tabular-nums font-bold text-[var(--color-accent)]">
                {counts.fundsReceived.toLocaleString()}
              </span>
            </li>
          </ul>
        </WidgetCard>
        <WidgetCard title="Activity · last 12 weeks">
          <ActivityGraph items={items} />
        </WidgetCard>
      </div>

      {/* Items table with filter tabs */}
      <WidgetCard
        title={`All items${items.length ? ` (${items.length})` : ""}`}
        action={
          <div className="flex gap-1 rounded-pill bg-black/5 p-0.5 text-[10px]">
            {(["all", "listed", "given", "sold"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-pill px-2.5 py-0.5 capitalize transition",
                  filter === f
                    ? "bg-white shadow-sm font-semibold"
                    : "text-[var(--color-muted)]",
                )}
              >
                {f === "all" ? "All" : STATUS_LABEL[f]}
              </button>
            ))}
          </div>
        }
      >
        {loading ? (
          <p className="text-sm text-[var(--color-muted)]">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            hint={
              filter === "all"
                ? "Add an item above to start pruning."
                : `No items in "${STATUS_LABEL[filter as PruneStatus]}" yet.`
            }
          />
        ) : (
          <ul className="divide-y divide-[var(--color-line)]">
            {filtered.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                busy={busy}
                onTransition={transition}
                onSetFunds={setSoldFunds}
                onSaveEdits={saveEdits}
                onRemove={remove}
              />
            ))}
          </ul>
        )}
      </WidgetCard>
    </div>
  );
}

function StatTile({
  label,
  value,
  tint,
}: {
  label: string;
  value: number | string;
  tint: string;
}) {
  return (
    <div className="rounded-card border border-[var(--color-line)] bg-[var(--color-paper)] p-4">
      <p
        className={cn(
          "mb-1 inline-block rounded-pill px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
          tint,
        )}
      >
        {label}
      </p>
      <p className="font-display text-2xl font-semibold tabular-nums leading-none">
        {value}
      </p>
    </div>
  );
}

function ItemRow({
  item,
  busy,
  onTransition,
  onSetFunds,
  onSaveEdits,
  onRemove,
}: {
  item: PruneItem;
  busy: boolean;
  onTransition: (
    item: PruneItem,
    to: PruneStatus,
    soldPrice?: number,
    soldDate?: string,
  ) => void;
  onSetFunds: (item: PruneItem, funds: string) => void;
  onSaveEdits: (
    item: PruneItem,
    patch: Partial<PruneItem>,
  ) => Promise<boolean>;
  onRemove: (item: PruneItem) => void;
}) {
  const [editingFunds, setEditingFunds] = useState(false);
  const [fundsDraft, setFundsDraft] = useState(
    item.funds_received != null ? String(item.funds_received) : "",
  );
  const [markingSold, setMarkingSold] = useState(false);
  const [salePriceDraft, setSalePriceDraft] = useState("");
  const [saleDateDraft, setSaleDateDraft] = useState(todayUtc());

  // Full-edit panel
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(item.title);
  const [valueDraft, setValueDraft] = useState(
    item.value != null ? String(item.value) : "",
  );
  const [editFundsDraft, setEditFundsDraft] = useState(
    item.funds_received != null ? String(item.funds_received) : "",
  );
  const [dateDraft, setDateDraft] = useState(
    (item.status === "listed"
      ? item.listed_at
      : item.status === "given"
        ? item.given_at
        : item.sold_at) ?? todayUtc(),
  );
  const [noteDraft, setNoteDraft] = useState(item.note ?? "");

  function startEdit() {
    setTitleDraft(item.title);
    setValueDraft(item.value != null ? String(item.value) : "");
    setEditFundsDraft(
      item.funds_received != null ? String(item.funds_received) : "",
    );
    setDateDraft(
      (item.status === "listed"
        ? item.listed_at
        : item.status === "given"
          ? item.given_at
          : item.sold_at) ?? todayUtc(),
    );
    setNoteDraft(item.note ?? "");
    setEditing(true);
  }

  async function commitEdit() {
    if (!titleDraft.trim()) return;
    const patch: Partial<PruneItem> = {
      title: titleDraft.trim(),
      value: valueDraft.trim() ? Number(valueDraft) : null,
      note: noteDraft.trim() ? noteDraft.trim() : null,
    };
    if (item.status === "listed") patch.listed_at = dateDraft;
    if (item.status === "given") patch.given_at = dateDraft;
    if (item.status === "sold") {
      patch.sold_at = dateDraft;
      patch.funds_received = editFundsDraft.trim()
        ? Number(editFundsDraft)
        : null;
    }
    const ok = await onSaveEdits(item, patch);
    if (ok) setEditing(false);
  }

  const dateForStatus =
    item.status === "listed"
      ? item.listed_at
      : item.status === "given"
        ? item.given_at
        : item.sold_at;

  function startMarkSold() {
    setSalePriceDraft(item.value != null ? String(item.value) : "");
    setSaleDateDraft(todayUtc());
    setMarkingSold(true);
  }

  function confirmSold() {
    const n = Number(salePriceDraft);
    const price = Number.isFinite(n) && n >= 0 ? n : 0;
    onTransition(item, "sold", price, saleDateDraft || todayUtc());
    setMarkingSold(false);
  }

  return (
    <li className="py-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-pill px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              STATUS_TINT[item.status],
            )}
          >
            {STATUS_LABEL[item.status]}
          </span>
          <span className="truncate font-medium">{item.title}</span>
        </div>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          {dateForStatus ? prettyDate(dateForStatus) : "—"}
          {item.value != null && (
            <span className="ml-2">
              · valued {item.value.toLocaleString()}
            </span>
          )}
          {item.status === "sold" && (
            <>
              {" · "}
              {editingFunds ? (
                <input
                  type="number"
                  autoFocus
                  value={fundsDraft}
                  onChange={(e) => setFundsDraft(e.target.value)}
                  onBlur={() => {
                    onSetFunds(item, fundsDraft);
                    setEditingFunds(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onSetFunds(item, fundsDraft);
                      setEditingFunds(false);
                    }
                  }}
                  className="w-20 rounded border border-[var(--color-line)] bg-white px-1 text-xs"
                  aria-label="Funds received"
                />
              ) : (
                <button
                  onClick={() => {
                    setFundsDraft(
                      item.funds_received != null
                        ? String(item.funds_received)
                        : "",
                    );
                    setEditingFunds(true);
                  }}
                  className="font-semibold text-[var(--color-accent)] hover:underline"
                  title="Click to edit funds received"
                >
                  {(item.funds_received ?? 0).toLocaleString()} received
                </button>
              )}
            </>
          )}
        </p>
        {item.note && (
          <p className="mt-1 text-xs italic text-[var(--color-muted)]">
            {item.note}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {item.status === "listed" ? (
          <ActiveStatusTick label="Listed" />
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onTransition(item, "listed")}
            disabled={busy}
            title="Mark listed"
          >
            <Tag size={13} />
          </Button>
        )}
        {item.status === "given" ? (
          <ActiveStatusTick label="Given away" />
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onTransition(item, "given")}
            disabled={busy}
            title="Mark given away"
          >
            <Gift size={13} />
          </Button>
        )}
        {item.status === "sold" ? (
          <ActiveStatusTick label="Sold" />
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={startMarkSold}
            disabled={busy}
            title="Mark sold"
          >
            <Coins size={13} />
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={startEdit}
          disabled={busy}
          title="Edit"
        >
          <Pencil size={13} />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onRemove(item)}
          disabled={busy}
          title="Remove"
        >
          <Trash2 size={13} />
        </Button>
      </div>
      </div>

      {markingSold && (
        <div className="mt-3 rounded-card border border-[var(--color-line)] bg-[var(--color-cream)] p-3">
          <p className="mb-2 text-xs text-[var(--color-muted)]">
            Sold for how much, and when?
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="number"
              min={0}
              step="0.01"
              autoFocus
              value={salePriceDraft}
              onChange={(e) => setSalePriceDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmSold();
                if (e.key === "Escape") setMarkingSold(false);
              }}
              placeholder="Sale price"
              className="flex-1 min-w-[140px]"
            />
            <Input
              type="date"
              value={saleDateDraft}
              max={todayUtc()}
              onChange={(e) => setSaleDateDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmSold();
                if (e.key === "Escape") setMarkingSold(false);
              }}
              className="min-w-[160px]"
              aria-label="Sale date"
            />
            <Button
              size="sm"
              onClick={confirmSold}
              disabled={busy || !salePriceDraft.trim()}
            >
              Mark sold
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setMarkingSold(false)}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {editing && (
        <div className="mt-3 space-y-3 rounded-card border border-[var(--color-line)] bg-[var(--color-cream)] p-3">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Title
            </label>
            <Input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              placeholder="What is it?"
              className="w-full"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[140px]">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Value
              </label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={valueDraft}
                onChange={(e) => setValueDraft(e.target.value)}
                placeholder="(optional)"
                className="w-full"
              />
            </div>
            {item.status === "sold" && (
              <div className="flex-1 min-w-[140px]">
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  Sold for
                </label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editFundsDraft}
                  onChange={(e) => setEditFundsDraft(e.target.value)}
                  placeholder="Sale price"
                  className="w-full"
                />
              </div>
            )}
            <div className="flex-1 min-w-[140px]">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                Date {STATUS_LABEL[item.status].toLowerCase()}
              </label>
              <Input
                type="date"
                value={dateDraft}
                max={todayUtc()}
                onChange={(e) => setDateDraft(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Note
            </label>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Optional details — buyer, condition, anything"
              rows={2}
              className="w-full resize-none rounded-card border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={commitEdit}
              disabled={busy || !titleDraft.trim()}
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function ActiveStatusTick({ label }: { label: string }) {
  return (
    <span
      aria-hidden
      className="flex h-7 w-7 items-center justify-center rounded-pill text-emerald-600"
      title={label}
    >
      <Check size={14} />
    </span>
  );
}

function ActivityGraph({ items }: { items: PruneItem[] }) {
  // Bucket items by event-week per status. Each item contributes to up to 3
  // buckets (listed/given/sold) keyed off its respective *_at date.
  const buckets = useMemo(() => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const wkStart = (() => {
      const d = new Date(today);
      const dow = d.getUTCDay();
      const offset = dow === 0 ? -6 : 1 - dow;
      d.setUTCDate(d.getUTCDate() + offset);
      return d;
    })();

    const weeks: {
      weekStart: string;
      listed: number;
      given: number;
      sold: number;
    }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(wkStart);
      d.setUTCDate(d.getUTCDate() - i * 7);
      weeks.push({
        weekStart: d.toISOString().slice(0, 10),
        listed: 0,
        given: 0,
        sold: 0,
      });
    }

    function bucketFor(ymd: string) {
      const d = new Date(ymd + "T00:00:00Z");
      const dow = d.getUTCDay();
      const offset = dow === 0 ? -6 : 1 - dow;
      d.setUTCDate(d.getUTCDate() + offset);
      const wk = d.toISOString().slice(0, 10);
      return weeks.find((w) => w.weekStart === wk);
    }

    for (const item of items) {
      if (item.listed_at) {
        const b = bucketFor(item.listed_at);
        if (b) b.listed += 1;
      }
      if (item.given_at) {
        const b = bucketFor(item.given_at);
        if (b) b.given += 1;
      }
      if (item.sold_at) {
        const b = bucketFor(item.sold_at);
        if (b) b.sold += 1;
      }
    }
    return weeks;
  }, [items]);

  const maxCount = Math.max(
    1,
    ...buckets.flatMap((b) => [b.listed, b.given, b.sold]),
  );
  const W = 720;
  const H = 160;
  const padL = 8;
  const padR = 8;
  const padT = 14;
  const padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const groupW = innerW / buckets.length;
  const barW = (groupW - 8) / 3;

  // Match the status-pill colors from STATUS_TINT.
  const seriesColors = {
    listed: "#d97706", // amber-600
    given: "#7c3aed", // violet-600
    sold: "#059669", // emerald-600
  };
  const series: Array<"listed" | "given" | "sold"> = [
    "listed",
    "given",
    "sold",
  ];

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        className="block"
        preserveAspectRatio="xMidYMid meet"
      >
        {buckets.map((b, i) => {
          const groupX = padL + i * groupW + 4;
          return (
            <g key={b.weekStart}>
              {series.map((k, si) => {
                const v = b[k];
                const h = (v / maxCount) * innerH;
                const x = groupX + si * barW;
                const y = padT + (innerH - h);
                return (
                  <g key={k}>
                    <rect
                      x={x}
                      y={y}
                      width={barW - 1.5}
                      height={h}
                      rx={2}
                      fill={seriesColors[k]}
                      opacity={v > 0 ? 0.9 : 0.12}
                    />
                    {v > 0 && (
                      <text
                        x={x + (barW - 1.5) / 2}
                        y={y - 3}
                        textAnchor="middle"
                        fontSize="9"
                        fill="var(--color-ink)"
                        fontWeight="600"
                      >
                        {v}
                      </text>
                    )}
                  </g>
                );
              })}
              <text
                x={groupX + (groupW - 8) / 2}
                y={H - 16}
                textAnchor="middle"
                fontSize="9"
                fill="var(--color-muted)"
              >
                {weekLabel(b.weekStart)}
              </text>
            </g>
          );
        })}

        {/* Legend along the bottom */}
        {series.map((k, si) => {
          const x = padL + si * 80;
          const y = H - 4;
          return (
            <g key={`legend-${k}`}>
              <rect
                x={x}
                y={y - 8}
                width={8}
                height={8}
                rx={2}
                fill={seriesColors[k]}
                opacity={0.9}
              />
              <text
                x={x + 12}
                y={y - 1}
                fontSize="9"
                fill="var(--color-muted)"
                style={{ textTransform: "capitalize" }}
              >
                {k === "given" ? "given away" : k}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function weekLabel(ymd: string): string {
  const d = new Date(ymd + "T00:00:00Z");
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function prettyDate(ymd: string): string {
  return new Date(ymd + "T00:00:00Z").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
