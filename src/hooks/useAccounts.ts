import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type Account = {
  id: string;
  user_id: string;
  name: string;
  type:
    | "cash"
    | "investment"
    | "retirement"
    | "property"
    | "crypto"
    | "debt"
    | "other";
  balance: number;
  updated_at: string;
};

export type NetWorthPoint = {
  captured_at: string;
  total: number;
};

type State = {
  accounts: Account[];
  history: NetWorthPoint[];
  loading: boolean;
  error: string | null;
};

export function useAccounts(userId: string | undefined) {
  const [state, setState] = useState<State>({
    accounts: [],
    history: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    if (!userId) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    const [accRes, histRes] = await Promise.all([
      supabase
        .from("accounts")
        .select("id, user_id, name, type, balance, updated_at")
        .eq("user_id", userId)
        .order("type")
        .order("name"),
      supabase
        .from("net_worth_snapshots")
        .select("captured_at, total")
        .eq("user_id", userId)
        .order("captured_at"),
    ]);

    const err = accRes.error || histRes.error;
    if (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
      return;
    }

    setState({
      accounts: (accRes.data ?? []) as Account[],
      history: ((histRes.data ?? []) as { captured_at: string; total: number | string }[])
        .map((r) => ({
          captured_at: r.captured_at,
          total: Number(r.total),
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
