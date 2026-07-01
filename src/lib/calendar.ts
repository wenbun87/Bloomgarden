/* Calendar helpers — pure date math + formatting for the calendar page.
   All dates are handled in the user's local timezone. Event dates are stored
   as plain `yyyy-mm-dd` strings so there's no UTC off-by-one. */

export type CalendarEvent = {
  id: string;
  user_id: string;
  title: string;
  event_date: string; // yyyy-mm-dd (local)
  all_day: boolean;
  start_time: string | null; // "HH:MM:SS" or null
  end_time: string | null;
  note: string | null;
  source: "manual" | "google";
};

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

/** The 42-cell (6-week) grid for a month, Sunday-first. */
export function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
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

/** "9:00 AM" from "09:00:00" (or ""). */
export function fmtTime(t: string | null): string {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  let h = Number(hStr);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${mStr} ${ampm}`;
}
