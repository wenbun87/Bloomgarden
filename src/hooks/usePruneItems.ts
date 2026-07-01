import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type PruneStatus = "listed" | "given" | "sold";

export type PruneItem = {
  id: string;
  user_id: string;
  title: string;
  status: PruneStatus;
  value: number | null;
  funds_received: number | null;
  recipient: string | null;
  note: string | null;
  listed_at: string | null;
  given_at: string | null;
  sold_at: string | null;
  created_at: string;
  updated_at: string;
};

type State = {
  items: PruneItem[];
  loading: boolean;
  error: string | null;
};

export function usePruneItems(userId: string | undefined) {
  const [state, setState] = useState<State>({
    items: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    if (!userId) {
      setState({ items: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase
      .from("prune_items")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) {
      setState({ items: [], loading: false, error: error.message });
      return;
    }
    setState({
      items: ((data ?? []) as PruneItem[]).map((r) => ({
        ...r,
        value: r.value !== null ? Number(r.value) : null,
        funds_received:
          r.funds_received !== null ? Number(r.funds_received) : null,
      })),
      loading: false,
      error: null,
    });
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
