import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useFriends } from "@/hooks/useFriends";
import { useProfile } from "@/hooks/useProfile";
import { useCalendar } from "@/hooks/useCalendar";
import { supabase } from "@/lib/supabase";
import {
  dateRangeLabel,
  daysBetween,
  fmtTime,
  isMultiDay,
  longDate,
  monthGrid,
  MONTHS,
  shortDate,
  WEEKDAYS,
  ymd,
  type CalendarEvent,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";

type Props = { userId: string };

// Colors assigned to overlaid friends (by their position in your friend list,
// so a friend keeps the same color regardless of who else is selected).
const FRIEND_COLORS = [
  "#4b83b8", "#c07b3a", "#8a5fb0", "#3a9a7a", "#c0563a", "#b0873a", "#5f7bd0",
];
const ME_COLOR = "#4a7028";

const firstInitial = (name: string) => name.trim().charAt(0).toUpperCase() || "?";

export default function Calendar({ userId }: Props) {
  const { accepted } = useFriends(userId);
  const { profile } = useProfile(userId);
  const today = ymd(new Date());

  const [view, setView] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const grid = useMemo(() => monthGrid(view.year, view.month), [view]);
  const rangeStart = ymd(grid[0]);
  const rangeEnd = ymd(grid[41]);

  const friendColor = useMemo(() => {
    const m = new Map<string, string>();
    accepted.forEach((edge, i) =>
      m.set(edge.friend_id, FRIEND_COLORS[i % FRIEND_COLORS.length]),
    );
    return m;
  }, [accepted]);

  const overlayIds = useMemo(
    () => [userId, ...accepted.map((e) => e.friend_id).filter((id) => selectedFriends.has(id))],
    [userId, accepted, selectedFriends],
  );

  const { events, loading, error, reload } = useCalendar(
    overlayIds,
    rangeStart,
    rangeEnd,
  );

  // Group events by day for quick cell lookup. A multi-day event is placed on
  // every day it spans, so it renders across the range and marks each of those
  // days busy for the free-day finder.
  const byDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const span = isMultiDay(ev)
        ? daysBetween(ev.event_date, ev.end_date!)
        : [ev.event_date];
      for (const day of span) {
        const list = m.get(day) ?? [];
        list.push(ev);
        m.set(day, list);
      }
    }
    return m;
  }, [events]);

  const overlayActive = selectedFriends.size > 0;

  const nameFor = (id: string) =>
    id === userId
      ? "You"
      : accepted.find((e) => e.friend_id === id)?.profile.display_name ?? "Friend";
  const colorFor = (id: string) => (id === userId ? ME_COLOR : friendColor.get(id) ?? ME_COLOR);

  // First initial of whoever owns/participates, for the "W:" / "W&A:" prefix.
  const initialFor = (id: string) =>
    firstInitial(
      id === userId
        ? profile?.display_name ?? ""
        : accepted.find((e) => e.friend_id === id)?.profile.display_name ?? "",
    );
  // The prefix shown before an event title. Shared events carry a stored label
  // (creator computed it so it's stable for every viewer); solo events use the
  // owner's single initial.
  const labelFor = (ev: CalendarEvent) => ev.shared_label || initialFor(ev.user_id);

  // Upcoming days this month where everyone in the overlay is free.
  const freeDays = useMemo(() => {
    if (!overlayActive) return [];
    return grid
      .filter((d) => d.getMonth() === view.month)
      .map(ymd)
      .filter((day) => day >= today && !byDay.has(day));
  }, [grid, view.month, byDay, overlayActive, today]);

  function shiftMonth(delta: number) {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
    setSelectedDay(null);
  }

  function goToday() {
    const n = new Date();
    setView({ year: n.getFullYear(), month: n.getMonth() });
    setSelectedDay(ymd(n));
  }

  function toggleFriend(id: string) {
    setSelectedFriends((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Calendar</h1>
        <p className="page-sub">
          Keep your plans here, then overlay a friend or two to spot the days
          you're all free.
        </p>
      </div>

      {/* Friend overlay picker */}
      <WidgetCard title="Overlay friends">
        {accepted.length === 0 ? (
          <EmptyState
            title="No friends to overlay yet"
            hint="Add friends first — then their calendars can sit alongside yours."
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {accepted.map((edge) => {
              const on = selectedFriends.has(edge.friend_id);
              const color = friendColor.get(edge.friend_id)!;
              return (
                <button
                  key={edge.friend_id}
                  onClick={() => toggleFriend(edge.friend_id)}
                  className={cn(
                    "flex items-center gap-2 rounded-pill border px-3 py-1.5 text-sm transition",
                    on
                      ? "border-transparent bg-[var(--color-ink)] text-white"
                      : "border-[var(--color-border)] bg-white/70 text-[var(--color-ink)] hover:bg-white",
                  )}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: color }}
                  />
                  {edge.profile.display_name}
                </button>
              );
            })}
          </div>
        )}
        {accepted.length > 0 && (
          <p className="mt-2.5 text-xs text-[var(--color-muted)]">
            Their events layer onto your grid; open days for everyone glow green.
          </p>
        )}
      </WidgetCard>

      {/* Free-day summary */}
      {overlayActive && (
        <WidgetCard title="Days you're all free">
          <p className="mb-2.5 text-xs text-[var(--color-muted)]">
            {nameFor(userId)} + {[...selectedFriends].map(nameFor).join(", ")}
          </p>
          {freeDays.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">
              No fully-open days left this month for this group. Try another
              month.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {freeDays.map((day) => (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className="rounded-pill bg-[rgba(106,154,58,0.14)] px-3 py-1 text-xs font-semibold text-[var(--color-grass-deep)] hover:brightness-95"
                >
                  {shortDate(day)}
                </button>
              ))}
            </div>
          )}
        </WidgetCard>
      )}

      {/* Month grid */}
      <WidgetCard
        title={`${MONTHS[view.month]} ${view.year}`}
        action={
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={goToday} className="px-2">
              Today
            </Button>
            <button
              aria-label="Previous month"
              onClick={() => shiftMonth(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-pill text-[var(--color-muted)] hover:bg-[rgba(40,30,20,0.06)] hover:text-[var(--color-ink)]"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              aria-label="Next month"
              onClick={() => shiftMonth(1)}
              className="flex h-8 w-8 items-center justify-center rounded-pill text-[var(--color-muted)] hover:bg-[rgba(40,30,20,0.06)] hover:text-[var(--color-ink)]"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        }
      >
        {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="pb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]"
            >
              {w}
            </div>
          ))}

          {grid.map((d) => {
            const day = ymd(d);
            const inMonth = d.getMonth() === view.month;
            const isToday = day === today;
            const dayEvents = byDay.get(day) ?? [];
            const isFree =
              overlayActive && inMonth && day >= today && dayEvents.length === 0;
            const isSelected = selectedDay === day;

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "flex min-h-[68px] flex-col gap-0.5 rounded-card border p-1 text-left transition sm:min-h-[84px]",
                  isSelected
                    ? "border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]"
                    : "border-[var(--color-border)] hover:border-[var(--color-line)]",
                  inMonth ? "bg-white/70" : "bg-transparent opacity-45",
                  isFree && "bg-[rgba(106,154,58,0.12)]",
                )}
              >
                <span className="flex items-center justify-between">
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
                      isToday
                        ? "bg-[var(--color-accent)] text-white"
                        : "text-[var(--color-ink)]",
                    )}
                  >
                    {d.getDate()}
                  </span>
                  {isFree && (
                    <span className="text-[8px] font-bold uppercase text-[var(--color-grass-deep)]">
                      free
                    </span>
                  )}
                </span>

                <span className="flex flex-col gap-0.5 overflow-hidden">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <span
                      key={ev.id}
                      className="flex items-center gap-1 truncate text-[10px] leading-tight"
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: colorFor(ev.user_id) }}
                      />
                      <span className="shrink-0 font-bold text-[var(--color-ink)]">
                        {labelFor(ev)}:
                      </span>
                      <span className="truncate text-[var(--color-ink)]">
                        {ev.title}
                      </span>
                    </span>
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-[9px] text-[var(--color-muted)]">
                      +{dayEvents.length - 3} more
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        {loading && (
          <p className="mt-2 text-xs text-[var(--color-muted)]">Loading…</p>
        )}
      </WidgetCard>

      {/* Inline day panel — expands below the grid, never a modal */}
      {selectedDay && (
        <DayPanel
          key={selectedDay}
          userId={userId}
          day={selectedDay}
          events={byDay.get(selectedDay) ?? []}
          friends={accepted}
          nameFor={nameFor}
          colorFor={colorFor}
          initialFor={initialFor}
          labelFor={labelFor}
          onClose={() => setSelectedDay(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}

function DayPanel({
  userId,
  day,
  events,
  friends,
  nameFor,
  colorFor,
  initialFor,
  labelFor,
  onClose,
  onChanged,
}: {
  userId: string;
  day: string;
  events: CalendarEvent[];
  friends: { friend_id: string; profile: { display_name: string } }[];
  nameFor: (id: string) => string;
  colorFor: (id: string) => string;
  initialFor: (id: string) => string;
  labelFor: (ev: CalendarEvent) => string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(day);
  const [endDate, setEndDate] = useState(day);
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [note, setNote] = useState("");
  const [participants, setParticipants] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const mine = events.filter((e) => e.user_id === userId);
  const others = events.filter((e) => e.user_id !== userId);
  const isRange = endDate > startDate;
  const spanDays = isRange ? daysBetween(startDate, endDate).length : 1;

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setStartDate(day);
    setEndDate(day);
    setAllDay(true);
    setStartTime("");
    setEndTime("");
    setNote("");
    setParticipants(new Set());
    setErr(null);
  }

  function loadForEdit(ev: CalendarEvent) {
    setEditingId(ev.id);
    setTitle(ev.title);
    setStartDate(ev.event_date);
    setEndDate(
      ev.end_date && ev.end_date > ev.event_date ? ev.end_date : ev.event_date,
    );
    setAllDay(ev.all_day);
    setStartTime(ev.start_time?.slice(0, 5) ?? "");
    setEndTime(ev.end_time?.slice(0, 5) ?? "");
    setNote(ev.note ?? "");
    setParticipants(new Set(ev.participant_ids));
    setErr(null);
  }

  function toggleParticipant(id: string) {
    setParticipants((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    if (endDate < startDate) {
      setErr("End date can't be before the start date.");
      return;
    }
    setBusy(true);
    setErr(null);

    // Shared event: creator first, then each selected friend, joined as "W&A&B".
    const partArr = [...participants];
    const sharedLabel =
      partArr.length > 0
        ? [userId, ...partArr].map(initialFor).join("&")
        : null;

    // A multi-day event is treated as all-day (per-day times across a range
    // would be ambiguous), and stores end_date; single-day events keep end_date
    // null and honour the all-day / time choice.
    const row = {
      title: t,
      event_date: startDate,
      end_date: isRange ? endDate : null,
      all_day: isRange ? true : allDay,
      start_time: isRange || allDay ? null : startTime || null,
      end_time: isRange || allDay ? null : endTime || null,
      note: note.trim() || null,
      participant_ids: partArr,
      shared_label: sharedLabel,
    };

    const { error } = editingId
      ? await supabase.from("calendar_events").update(row).eq("id", editingId)
      : await supabase.from("calendar_events").insert({ ...row, user_id: userId });

    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    resetForm();
    onChanged();
  }

  async function remove(id: string) {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from("calendar_events").delete().eq("id", id);
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    if (editingId === id) resetForm();
    onChanged();
  }

  return (
    <WidgetCard
      title={longDate(day)}
      action={
        <button
          aria-label="Close day"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-pill text-[var(--color-muted)] hover:bg-[rgba(40,30,20,0.06)] hover:text-[var(--color-ink)]"
        >
          <X size={16} />
        </button>
      }
    >
      <div className="space-y-4">
        {/* Existing events */}
        {events.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            Nothing planned yet.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {[...mine, ...others].map((ev) => {
              const owned = ev.user_id === userId;
              return (
                <li
                  key={ev.id}
                  className="flex items-center gap-2.5 rounded-card border border-[var(--color-border)] bg-white/70 px-3 py-2"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: colorFor(ev.user_id) }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      <span className="text-[var(--color-muted)]">
                        {labelFor(ev)}:{" "}
                      </span>
                      {ev.title}
                    </p>
                    <p className="truncate text-[11px] text-[var(--color-muted)]">
                      {owned ? "You" : nameFor(ev.user_id)}
                      {isMultiDay(ev)
                        ? ` · ${dateRangeLabel(ev.event_date, ev.end_date!)}`
                        : !ev.all_day && ev.start_time
                          ? ` · ${fmtTime(ev.start_time)}${
                              ev.end_time ? `–${fmtTime(ev.end_time)}` : ""
                            }`
                          : " · all day"}
                      {ev.note ? ` · ${ev.note}` : ""}
                    </p>
                  </div>
                  {owned && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => loadForEdit(ev)}
                        className="rounded-pill px-2 py-1 text-xs text-[var(--color-muted)] hover:bg-[rgba(40,30,20,0.06)] hover:text-[var(--color-ink)]"
                      >
                        Edit
                      </button>
                      <button
                        aria-label="Delete event"
                        onClick={() => remove(ev.id)}
                        disabled={busy}
                        className="flex h-7 w-7 items-center justify-center rounded-pill text-[var(--color-muted)] hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Add / edit form */}
        <form onSubmit={save} className="space-y-2 border-t border-[var(--color-line)] pt-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={editingId ? "Edit event" : "Add an event…"}
            maxLength={120}
          />

          {/* Date range — set Ends past Starts for a multi-day event */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
              Starts
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  const v = e.target.value;
                  setStartDate(v);
                  if (endDate < v) setEndDate(v);
                }}
                className="h-9 w-auto px-3 text-sm"
                aria-label="Start date"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
              Ends
              <Input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 w-auto px-3 text-sm"
                aria-label="End date"
              />
            </label>
            {isRange && (
              <span className="text-xs text-[var(--color-muted)]">
                Spans {spanDays} days · all-day
              </span>
            )}
          </div>

          {!isRange && (
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-ink)]">
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={(e) => setAllDay(e.target.checked)}
                  className="h-4 w-4 accent-[var(--color-accent)]"
                />
                All day
              </label>
              {!allDay && (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="h-9 w-auto px-3"
                    aria-label="Start time"
                  />
                  <span className="text-sm text-[var(--color-muted)]">to</span>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="h-9 w-auto px-3"
                    aria-label="End time"
                  />
                </div>
              )}
            </div>
          )}
          {friends.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-[var(--color-muted)]">
                Also for (shared event)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {friends.map((f) => {
                  const on = participants.has(f.friend_id);
                  return (
                    <button
                      type="button"
                      key={f.friend_id}
                      onClick={() => toggleParticipant(f.friend_id)}
                      className={cn(
                        "rounded-pill border px-2.5 py-1 text-xs transition",
                        on
                          ? "border-transparent bg-[var(--color-ink)] text-white"
                          : "border-[var(--color-border)] bg-white/70 text-[var(--color-ink)] hover:bg-white",
                      )}
                    >
                      {f.profile.display_name}
                    </button>
                  );
                })}
              </div>
              {participants.size > 0 && (
                <p className="text-xs text-[var(--color-muted)]">
                  Shared as{" "}
                  <span className="font-semibold text-[var(--color-ink)]">
                    {[userId, ...participants].map(initialFor).join("&")}:
                  </span>{" "}
                  — also appears on their calendars.
                </p>
              )}
            </div>
          )}

          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            maxLength={500}
          />
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={busy || !title.trim()}>
              {editingId ? "Save changes" : (
                <>
                  <Plus size={13} />
                  Add event
                </>
              )}
            </Button>
            {editingId && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={resetForm}
                disabled={busy}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </div>
    </WidgetCard>
  );
}
