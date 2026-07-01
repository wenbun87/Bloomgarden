import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string | null;
  seed_id: string | null;
  species_id: string | null;
  read_at: string | null;
  created_at: string;
  sender: { username: string; display_name: string };
  species: { name: string; slug: string; sprite_emoji: string } | null;
};

type State = {
  inbox: Message[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
};

export function useMessages(userId: string | undefined) {
  const [state, setState] = useState<State>({
    inbox: [],
    unreadCount: 0,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    if (!userId) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase
      .from("messages")
      .select(
        "id, sender_id, recipient_id, body, seed_id, species_id, read_at, created_at, sender:profile_lookup!sender_id(username, display_name), species:plant_species(name, slug, sprite_emoji)",
      )
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      setState({ inbox: [], unreadCount: 0, loading: false, error: error.message });
      return;
    }

    const inbox = (data ?? []) as unknown as Message[];
    setState({
      inbox,
      unreadCount: inbox.filter((m) => !m.read_at).length,
      loading: false,
      error: null,
    });
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`inbox:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${userId}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, load]);

  return { ...state, reload: load };
}
