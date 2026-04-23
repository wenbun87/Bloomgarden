import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type Todo = {
  id: string;
  user_id: string;
  title: string;
  completed: boolean;
  due_date: string | null;
  tag: string | null;
  created_at: string;
  completed_at: string | null;
};

type State = {
  todos: Todo[];
  loading: boolean;
  error: string | null;
};

export function useTodos(userId: string | undefined) {
  const [state, setState] = useState<State>({
    todos: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    if (!userId) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase
      .from("todos")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) {
      setState({ todos: [], loading: false, error: error.message });
      return;
    }
    setState({ todos: (data ?? []) as Todo[], loading: false, error: null });
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
