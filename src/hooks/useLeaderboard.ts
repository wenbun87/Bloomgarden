import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { weekStartUtc } from "@/lib/dates";

export type LeaderboardRow = {
  user_id: string;
  display_name: string;
  username: string;
  total_coins: number;
  isSelf: boolean;
  isFriend: boolean;
};

type State = {
  rows: LeaderboardRow[];
  loading: boolean;
  error: string | null;
};

// Global leaderboard: every signed-in user sees every other user's weekly
// total. Friendship status is attached so the widget can show a friend
// icon + only link to friends' profile pages.
export function useLeaderboard(userId: string | undefined) {
  const [state, setState] = useState<State>({
    rows: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    if (!userId) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    const week = weekStartUtc();

    const [scoresRes, friendsRes] = await Promise.all([
      supabase
        .from("weekly_scores")
        .select("user_id, total_coins")
        .eq("week_start", week),
      supabase
        .from("friendships")
        .select("friend_id")
        .eq("user_id", userId)
        .eq("status", "accepted"),
    ]);

    if (scoresRes.error) {
      setState({ rows: [], loading: false, error: scoresRes.error.message });
      return;
    }

    const scores = (scoresRes.data ?? []) as {
      user_id: string;
      total_coins: number;
    }[];
    const friendIds = new Set<string>(
      ((friendsRes.data ?? []) as { friend_id: string }[]).map((r) => r.friend_id),
    );

    const userIds = new Set<string>(scores.map((s) => s.user_id));
    userIds.add(userId);
    for (const fid of friendIds) userIds.add(fid);

    const { data: profiles } = await supabase
      .from("profile_lookup")
      .select("id, username, display_name")
      .in("id", [...userIds]);

    const byId = new Map(
      ((profiles ?? []) as {
        id: string;
        username: string;
        display_name: string;
      }[]).map((p) => [p.id, p]),
    );
    const scoreById = new Map(scores.map((r) => [r.user_id, r.total_coins]));

    const rows: LeaderboardRow[] = [...userIds]
      .map((id) => {
        const p = byId.get(id);
        if (!p) return null;
        return {
          user_id: id,
          display_name: p.display_name,
          username: p.username,
          total_coins: scoreById.get(id) ?? 0,
          isSelf: id === userId,
          isFriend: friendIds.has(id),
        } satisfies LeaderboardRow;
      })
      .filter((r): r is LeaderboardRow => r !== null)
      .sort(
        (a, b) =>
          b.total_coins - a.total_coins ||
          a.display_name.localeCompare(b.display_name),
      );

    setState({ rows, loading: false, error: null });
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`leaderboard:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "weekly_scores" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, load]);

  return { ...state, reload: load };
}
