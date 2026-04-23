import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type MarketBrief = {
  date: string;
  summary: string;
  indices_json: Record<
    string,
    { price: number; change_pct: number; symbol: string } | null
  >;
  movers_json: {
    gainers: { symbol: string; change_pct: number; price: number }[];
    losers: { symbol: string; change_pct: number; price: number }[];
  };
};

export type FieldNotesBrief = {
  week_start: string;
  summary: string;
  bullets_json: {
    claim: string;
    why_it_matters: string;
    source_url: string;
    source_name: string;
  }[];
  caveat: string;
};

export type Holding = {
  ticker: string;
  shares: number;
  avg_cost: number;
};

export type PortfolioTrade = {
  id: number;
  executed_at: string;
  ticker: string;
  action: "buy" | "sell";
  shares: number;
  price: number;
  rationale: string;
};

export type PortfolioSnapshot = {
  snapshot_at: string;
  total_value: number;
  sp500_value: number;
  narrative: string | null;
};

export type PortfolioState = {
  cash: number;
  holdings: Holding[];
  trades: PortfolioTrade[];
  snapshots: PortfolioSnapshot[];
};

type State = {
  forecast: MarketBrief | null;
  fieldNotes: FieldNotesBrief | null;
  portfolio: PortfolioState | null;
  loading: boolean;
  error: string | null;
};

export function useBriefs() {
  const [state, setState] = useState<State>({
    forecast: null,
    fieldNotes: null,
    portfolio: null,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));

    const [fc, fn, cash, holdings, trades, snaps] = await Promise.all([
      supabase
        .from("market_briefs")
        .select("*")
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("research_briefs")
        .select("*")
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("portfolio_cash")
        .select("balance")
        .eq("id", 1)
        .maybeSingle(),
      supabase
        .from("portfolio_holdings")
        .select("ticker, shares, avg_cost")
        .order("ticker"),
      supabase
        .from("portfolio_trades")
        .select("*")
        .order("executed_at", { ascending: false })
        .limit(50),
      supabase
        .from("portfolio_snapshots")
        .select("snapshot_at, total_value, sp500_value, narrative")
        .order("snapshot_at"),
    ]);

    const firstErr =
      fc.error ||
      fn.error ||
      cash.error ||
      holdings.error ||
      trades.error ||
      snaps.error;
    if (firstErr) {
      setState((s) => ({ ...s, loading: false, error: firstErr.message }));
      return;
    }

    const numberify = <T extends Record<string, unknown>>(
      rows: T[] | null,
      keys: (keyof T)[],
    ): T[] =>
      (rows ?? []).map((r) => {
        const o = { ...r };
        for (const k of keys) (o as Record<string, unknown>)[k as string] = Number(r[k]);
        return o;
      });

    setState({
      forecast: fc.data as MarketBrief | null,
      fieldNotes: fn.data as FieldNotesBrief | null,
      portfolio: {
        cash: Number((cash.data as { balance: number | string } | null)?.balance ?? 10000),
        holdings: numberify(holdings.data as Holding[] | null, ["shares", "avg_cost"]),
        trades: numberify(trades.data as PortfolioTrade[] | null, ["shares", "price"]),
        snapshots: numberify(snaps.data as PortfolioSnapshot[] | null, [
          "total_value",
          "sp500_value",
        ]),
      },
      loading: false,
      error: null,
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
