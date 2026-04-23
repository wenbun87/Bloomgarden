import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type FriendEdge = {
  user_id: string;
  friend_id: string;
  status: "pending" | "accepted";
  created_at: string;
  profile: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
};

export type FriendsState = {
  accepted: FriendEdge[];
  incoming: FriendEdge[];
  outgoing: FriendEdge[];
  loading: boolean;
  error: string | null;
};

export function useFriends(userId: string | undefined) {
  const [state, setState] = useState<FriendsState>({
    accepted: [],
    incoming: [],
    outgoing: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    if (!userId) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));

    const { data, error } = await supabase
      .from("friendships")
      .select("user_id, friend_id, status, created_at");

    if (error) {
      setState((s) => ({ ...s, loading: false, error: error.message }));
      return;
    }

    const otherIds = new Set<string>();
    for (const row of data ?? []) {
      otherIds.add(row.user_id === userId ? row.friend_id : row.user_id);
    }

    const profiles =
      otherIds.size > 0
        ? (
            await supabase
              .from("profile_lookup")
              .select("id, username, display_name, avatar_url")
              .in("id", [...otherIds])
          ).data ?? []
        : [];
    const byId = new Map(profiles.map((p) => [p.id, p]));

    const accepted: FriendEdge[] = [];
    const incoming: FriendEdge[] = [];
    const outgoing: FriendEdge[] = [];

    for (const row of data ?? []) {
      const otherId = row.user_id === userId ? row.friend_id : row.user_id;
      const profile = byId.get(otherId);
      if (!profile) continue;
      const edge: FriendEdge = {
        user_id: row.user_id,
        friend_id: row.friend_id,
        status: row.status as "pending" | "accepted",
        created_at: row.created_at,
        profile,
      };
      if (row.status === "accepted") {
        // two-row convention: keep the row where current user is user_id
        if (row.user_id === userId) accepted.push(edge);
      } else if (row.user_id === userId) {
        outgoing.push(edge);
      } else {
        incoming.push(edge);
      }
    }

    setState({ accepted, incoming, outgoing, loading: false, error: null });
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
