import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type WishlistItem = {
  id: string;
  user_id: string;
  title: string;
  url: string | null;
  price: number | null;
  notes: string | null;
  show_in_profile: boolean;
  created_at: string;
};

type State = {
  items: WishlistItem[];
  loading: boolean;
  error: string | null;
};

function numberify(items: WishlistItem[]): WishlistItem[] {
  return items.map((i) => ({
    ...i,
    price: i.price == null ? null : Number(i.price),
  }));
}

export function useWishlist(userId: string | undefined, publicOnly = false) {
  const [state, setState] = useState<State>({
    items: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    if (!userId) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    let q = supabase
      .from("wishlist_items")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (publicOnly) q = q.eq("show_in_profile", true);
    const { data, error } = await q;
    if (error) {
      setState({ items: [], loading: false, error: error.message });
      return;
    }
    setState({
      items: numberify((data ?? []) as WishlistItem[]),
      loading: false,
      error: null,
    });
  }, [userId, publicOnly]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
