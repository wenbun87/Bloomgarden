import { Link } from "react-router-dom";
import { Coins, Heart, Trophy } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { EmptyState } from "@/components/EmptyState";
import { useLeaderboard, type LeaderboardRow } from "@/hooks/useLeaderboard";
import { cn } from "@/lib/utils";

type Props = { userId: string; className?: string };

export function LeaderboardWidget({ userId, className }: Props) {
  const { rows, loading } = useLeaderboard(userId);

  return (
    <WidgetCard
      title="Leaderboard · this week"
      className={className}
      action={
        <span className="text-xs text-[var(--color-muted)]">
          Live · everyone
        </span>
      }
    >
      {loading ? (
        <p className="text-sm text-[var(--color-muted)]">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No scores yet"
          hint="Log a habit to start this week's leaderboard."
        />
      ) : (
        <ol className="space-y-1.5">
          {rows.map((row, i) => (
            <Row key={row.user_id} row={row} rank={i + 1} />
          ))}
        </ol>
      )}
    </WidgetCard>
  );
}

function Row({ row, rank }: { row: LeaderboardRow; rank: number }) {
  const inner = (
    <div
      className={cn(
        "flex items-center gap-3 rounded-pill px-3 py-2",
        row.isSelf
          ? "bg-[var(--color-accent-soft)]"
          : row.isFriend
            ? "bg-white"
            : "bg-white/50",
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-pill text-xs font-semibold tabular-nums",
          rank === 1
            ? "bg-amber-200 text-amber-900"
            : "bg-white text-[var(--color-muted)]",
        )}
      >
        {rank === 1 ? <Trophy size={12} /> : rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
          {row.display_name}
          {row.isFriend && !row.isSelf && (
            <Heart size={10} className="fill-[var(--color-accent)] text-[var(--color-accent)]" />
          )}
          {row.isSelf && (
            <span className="text-xs text-[var(--color-muted)]">you</span>
          )}
        </p>
        <p className="truncate text-xs text-[var(--color-muted)]">
          @{row.username}
        </p>
      </div>
      <div className="flex items-center gap-1 text-sm tabular-nums">
        <Coins size={12} className="text-[var(--color-accent)]" />
        {row.total_coins}
      </div>
    </div>
  );

  // Only friends (and yourself) are clickable — non-friends get no link so
  // they can't be profile-snooped before a friend request lands.
  if (row.isFriend || row.isSelf) {
    return (
      <li>
        <Link to={`/u/${row.username}`} className="block">
          {inner}
        </Link>
      </li>
    );
  }
  return <li>{inner}</li>;
}
