import { Flame } from "lucide-react";

type Props = { count: number };

// Small flame badge for habit cards. Only renders when streak ≥ 2 (a streak
// of 1 is just "did it today" — flame there is noise).
export function StreakBadge({ count }: Props) {
  if (count < 2) return null;
  return (
    <span
      title={`${count}-day streak`}
      className="flex items-center gap-0.5 rounded-pill bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
    >
      <Flame size={10} />
      {count}
    </span>
  );
}
