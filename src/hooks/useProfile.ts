import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/database.types";

type State = {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
};

export function useProfile(userId: string | undefined) {
  const [state, setState] = useState<State>({
    profile: null,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    if (!userId) {
      setState({ profile: null, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      setState({ profile: null, loading: false, error: error.message });
      return;
    }
    setState({ profile: data, loading: false, error: null });
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
