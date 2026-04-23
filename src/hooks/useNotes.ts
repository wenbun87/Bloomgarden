import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type Note = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  created_at: string;
  updated_at: string;
};

type State = {
  notes: Note[];
  loading: boolean;
  error: string | null;
};

export function useNotes(userId: string | undefined) {
  const [state, setState] = useState<State>({
    notes: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    if (!userId) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) {
      setState({ notes: [], loading: false, error: error.message });
      return;
    }
    setState({ notes: (data ?? []) as Note[], loading: false, error: null });
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
