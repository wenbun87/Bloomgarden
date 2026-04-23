// Week math matches the Postgres `week_start_utc` function exactly: Monday
// 00:00 UTC. Keep these in sync if either side ever changes.

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function weekStartUtc(date = new Date()): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  // Postgres `date_trunc('week', ...)` uses ISO week (Monday start).
  const dayOfWeek = d.getUTCDay(); // 0 = Sun, 1 = Mon …
  const monday = new Date(d);
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  monday.setUTCDate(d.getUTCDate() + offset);
  return monday.toISOString().slice(0, 10);
}

export function daysUntilMondayUtc(): number {
  const now = new Date();
  const day = now.getUTCDay();
  return day === 0 ? 1 : 8 - day;
}

// Mirrors supabase.public.current_utc_season(). Northern Hemisphere for v1.
export function currentUtcSeason(): "spring" | "summer" | "autumn" | "winter" {
  const m = new Date().getUTCMonth() + 1;
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "autumn";
  return "winter";
}
