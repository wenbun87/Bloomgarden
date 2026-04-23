import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Realtime-backed coin balance. Subscribes to profiles updates for this user so
// the chrome pill reflects awards as soon as log_habit / weekly_rollup fire.
export function useCoinBalance(userId: string | undefined) {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    supabase
      .from("profiles")
      .select("coin_balance")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data)
          setBalance((data as { coin_balance: number }).coin_balance);
      });

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
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return balance;
}
