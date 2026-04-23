// Weekly-quota and streak helpers shared between widgets and the streak grid.
// "Quota" = doing something N times per week to count the week complete.

import { weekStartUtc } from "@/lib/dates";

// Built-in habits that default to a weekly quota rather than "every day".
// Keep in sync with the client copy in DailyHabitCard subtitles.
export const BUILTIN_WEEKLY_QUOTA: Record<string, number> = {
  hobby: 3,
  mental_health: 3,
};

function addDays(ymd: string, delta: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// Number of qualifying days in the week containing `anchor` (default = this
// week). Pass a Set of logged-qualified dates.
export function countInWeek(
  qualified: Set<string>,
  anchorWeekStart: string = weekStartUtc(),
): number {
  let n = 0;
  for (let i = 0; i < 7; i++) {
    if (qualified.has(addDays(anchorWeekStart, i))) n += 1;
  }
  return n;
}

// Consecutive weeks (ending with this one) where the quota was hit. Lenient:
// if the current week hasn't hit quota yet, look at the prior week as the
// anchor so a mid-week fresh start doesn't visibly break the streak.
export function quotaWeekStreak(
  qualified: Set<string>,
  target: number,
): number {
  const thisWeek = weekStartUtc();
  const thisCount = countInWeek(qualified, thisWeek);
  let cursor =
    thisCount >= target ? thisWeek : addDays(thisWeek, -7);
  let count = 0;
  while (countInWeek(qualified, cursor) >= target) {
    count += 1;
    cursor = addDays(cursor, -7);
  }
  return count;
}
