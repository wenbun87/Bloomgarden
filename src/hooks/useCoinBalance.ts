import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { onCoinsChanged } from "@/lib/coinBus";

// The always-visible coin pill. Kept in sync three ways, most to least
// reliable: the in-app coin bus (fired the instant a coin action lands), a
// refetch when the tab regains focus, and a realtime subscription as a
// cross-device backstop. The bus is why the pill now updates immediately
// instead of only after a page refresh.
export function useCoinBalance(userId: string | undefined) {
  const [balance, setBalance] = useState<number | null>(null);

  const refetch = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("profiles")
      .select("coin_balance")
      .eq("id", userId)
      .maybeSingle();
    if (data) setBalance((data as { coin_balance: number }).coin_balance);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    refetch();
    const offBus = onCoinsChanged(refetch);
    window.addEventListener("focus", refetch);

    const channel = supabase
      .channel(`profile:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const next = (payload.new as { coin_balance?: number }).coin_balance;
          if (typeof next === "number") setBalance(next);
        },
      )
      .subscribe();

    return () => {
      offBus();
      window.removeEventListener("focus", refetch);
      supabase.removeChannel(channel);
    };
  }, [userId, refetch]);

  return balance;
}
