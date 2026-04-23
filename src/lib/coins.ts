// Mirrors the coin rules in supabase/migrations/0003_habits_and_coins.sql.
// The server is the source of truth; these constants exist so the UI can
// preview expected awards without a round-trip.

export const DAILY_HABITS = [
  "exercise",
  "hobby",
  "mental_health",
  "sleep",
] as const;
export type DailyCategory = (typeof DAILY_HABITS)[number];

export const HABIT_DAILY_REWARD = 5;
export const HABIT_WEEKLY_REWARDS = {
  plants: 25,
  social: 10,
} as const;
export const HABIT_MONTHLY_REWARDS = {
  savings: 100,
  investing: 100,
} as const;

export const PLANTS_WEEKLY_GOAL = 30;

export const DAILY_MINUTE_THRESHOLD = 30;
export const SLEEP_HOUR_THRESHOLD = 6;

export const CATEGORY_LABELS: Record<DailyCategory | "social" | "plants", string> = {
  exercise: "Exercise",
  hobby: "Hobby",
  mental_health: "Mental health",
  sleep: "Sleep",
  social: "Social",
  plants: "Plants",
};
