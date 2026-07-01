/* Calendar helpers — pure date math + formatting for the calendar page.
   All dates are handled in the user's local timezone. Event dates are stored
   as plain `yyyy-mm-dd` strings so there's no UTC off-by-one. */

export type CalendarEvent = {
  id: string;
  user_id: string; // creator / owner
  title: string;
  event_date: string; // yyyy-mm-dd (local) — start day
  end_date: string | null; // yyyy-mm-dd, null = single-day (same as event_date)
  all_day: boolean;
  start_time: string | null; // "HH:MM:SS" or null
  end_time: string | null;
  note: string | null;
  source: "manual" | "google";
  participant_ids: string[]; // extra friends on a shared event (excludes creator)
  shared_label: string | null; // display prefix for shared events, e.g. "W&A&B"
};

/** The last day an event covers ("HH" ignored) — end_date, or event_date if single-day. */
export function eventEnd(ev: { event_date: string; end_date: string | null }): string {
  return ev.end_date && ev.end_date > ev.event_date ? ev.end_date : ev.event_date;
}

/** Whether an event spans more than one day. */
export function isMultiDay(ev: { event_date: string; end_date: string | null }): boolean {
  return !!ev.end_date && ev.end_date > ev.event_date;
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Format a Date as a local `yyyy-mm-dd` string. */
export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** The 42-cell (6-week) grid for a month, Monday-first. */
export function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  // getDay(): 0=Sun..6=Sat. Days back to the preceding Monday.
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  return Array.from(
    { length: 42 },
    (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
  );
}

/** "Saturday, July 12" from a yyyy-mm-dd string. */
export function longDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const wd = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
    dt.getDay()
  ];
  return `${wd}, ${MONTHS[m - 1]} ${d}`;
}

/** "Jul 12" from a yyyy-mm-dd string. */
export function shortDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${MONTHS[m - 1].slice(0, 3)} ${d}`;
}

/** Inclusive list of yyyy-mm-dd strings from start to end (capped at 400 days). */
export function daysBetween(startStr: string, endStr: string): string[] {
  const [ys, ms, ds] = startStr.split("-").map(Number);
  const out: string[] = [];
  const cur = new Date(ys, ms - 1, ds);
  let guard = 0;
  while (ymd(cur) <= endStr && guard < 400) {
    out.push(ymd(cur));
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return out;
}

/** "Jul 3 – Jul 7" for a multi-day range. */
export function dateRangeLabel(startStr: string, endStr: string): string {
  return `${shortDate(startStr)} – ${shortDate(endStr)}`;
}

/** "9:00 AM" from "09:00:00" (or ""). */
export function fmtTime(t: string | null): string {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  let h = Number(hStr);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${mStr} ${ampm}`;
}
