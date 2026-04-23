import { LeaderboardWidget } from "@/widgets/social/LeaderboardWidget";

type Props = { userId: string };

export default function Leaderboard({ userId }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
        <p className="text-sm text-[var(--color-muted)]">
          This week's coin totals. Friends only. Updates live.
        </p>
      </div>
      <LeaderboardWidget userId={userId} />
    </div>
  );
}
