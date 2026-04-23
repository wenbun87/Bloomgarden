import type { Env } from "./env";
import { adminClient } from "./supabase";
import { groqJson } from "./groq";
import {
  companyNews,
  GREENHOUSE_UNIVERSE,
  INDEX_PROXIES,
  quote,
  quoteMany,
} from "./finnhub";

// The Greenhouse — weekly AI-run $10k simulated portfolio.
// Rebalance pipeline (Sunday 22:00 UTC):
//   1. Load cash + holdings
//   2. Get current prices for held tickers + the universe
//   3. Fetch recent news for held tickers
//   4. Ask Groq for {trades, notes}
//   5. Execute trades (update holdings + cash + trade rows)
//   6. Snapshot total value + S&P equivalent for the chart

type Decision = {
  trades: {
    ticker: string;
    action: "buy" | "sell";
    target_dollars: number;  // approximate dollar allocation; we round to whole shares
    rationale: string;
  }[];
  narrative: string;  // one paragraph: why the portfolio looks the way it does now
};

export async function runGreenhouse(env: Env): Promise<void> {
  const supabase = adminClient(env);

  // 1. Load current state
  const { data: cashRow } = await supabase
    .from("portfolio_cash")
    .select("balance")
    .eq("id", 1)
    .maybeSingle();
  const cash = Number(cashRow?.balance ?? 10000);

  const { data: holdingsRows } = await supabase
    .from("portfolio_holdings")
    .select("ticker, shares, avg_cost");
  const holdings = (holdingsRows ?? []) as {
    ticker: string;
    shares: number;
    avg_cost: number;
  }[];

  // 2. Quotes for everything we might touch.
  const universe = Array.from(
    new Set([...GREENHOUSE_UNIVERSE, ...holdings.map((h) => h.ticker)]),
  );
  const quotes = await quoteMany(env, universe);

  // 3. News for held + a sample of the universe (free-tier-friendly cap).
  const newsTickers = Array.from(
    new Set([
      ...holdings.map((h) => h.ticker),
      ...GREENHOUSE_UNIVERSE.slice(0, 10),
    ]),
  );
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const news: Record<string, { headline: string; source: string }[]> = {};
  for (const t of newsTickers) {
    try {
      const items = await companyNews(env, t, from, to);
      news[t] = items.slice(0, 5).map((a) => ({
        headline: a.headline,
        source: a.source,
      }));
    } catch {
      news[t] = [];
    }
    await new Promise((r) => setTimeout(r, 75));  // gentle pace for Finnhub
  }

  const totalValue =
    cash +
    holdings.reduce((s, h) => s + h.shares * (quotes[h.ticker]?.c ?? 0), 0);

  // 4. Groq makes decisions + writes the weekly narrative.
  const decision = await groqJson<Decision>(env, {
    system:
      "You tend The Greenhouse — a shared $10,000 simulated educational portfolio for Bloomgarden. This is NOT real money, never investment advice. Output JSON {trades: [{ticker, action: 'buy'|'sell', target_dollars: number, rationale: string (1-2 sentences, grounded in the news provided)}], narrative: string (2-3 sentences: why the portfolio looks the way it does right now, what the AI is watching, any macro or thematic thesis — plain language, no jargon)}. Rules: only trade tickers from the provided universe or current holdings; never exceed current cash (for buys) or current shares (for sells); total trade count 0-5 per rebalance; prefer quality diversification over hot takes. If the market calls for patience, return trades: []. target_dollars is the approximate dollar amount for each trade.",
    user: JSON.stringify({
      cash,
      holdings,
      quotes: Object.fromEntries(
        Object.entries(quotes).map(([k, v]) => [k, { price: v.c, change_pct: v.dp }]),
      ),
      news,
      total_portfolio_value: totalValue,
    }),
    temperature: 0.4,
  });

  // 5. Execute trades. Safety-net guards match the rules in the prompt.
  let workingCash = cash;
  const workingHoldings = new Map(
    holdings.map((h) => [h.ticker, { shares: h.shares, avg_cost: h.avg_cost }]),
  );
  const executed: {
    ticker: string;
    action: "buy" | "sell";
    shares: number;
    price: number;
    rationale: string;
  }[] = [];

  for (const t of decision.trades.slice(0, 5)) {
    const q = quotes[t.ticker];
    if (!q || q.c <= 0) continue;

    if (t.action === "buy") {
      const dollars = Math.min(t.target_dollars, workingCash);
      const shares = Math.floor(dollars / q.c);
      if (shares <= 0) continue;
      const cost = shares * q.c;
      workingCash -= cost;
      const prev = workingHoldings.get(t.ticker) ?? { shares: 0, avg_cost: 0 };
      const newShares = prev.shares + shares;
      const newAvg = (prev.shares * prev.avg_cost + cost) / newShares;
      workingHoldings.set(t.ticker, { shares: newShares, avg_cost: newAvg });
      executed.push({
        ticker: t.ticker,
        action: "buy",
        shares,
        price: q.c,
        rationale: t.rationale,
      });
    } else {
      const prev = workingHoldings.get(t.ticker);
      if (!prev || prev.shares <= 0) continue;
      const dollars = Math.min(t.target_dollars, prev.shares * q.c);
      const shares = Math.min(prev.shares, Math.floor(dollars / q.c));
      if (shares <= 0) continue;
      const proceeds = shares * q.c;
      workingCash += proceeds;
      const remaining = prev.shares - shares;
      if (remaining === 0) workingHoldings.delete(t.ticker);
      else workingHoldings.set(t.ticker, { ...prev, shares: remaining });
      executed.push({
        ticker: t.ticker,
        action: "sell",
        shares,
        price: q.c,
        rationale: t.rationale,
      });
    }
  }

  // 6. Persist new state.
  await supabase
    .from("portfolio_cash")
    .update({ balance: workingCash.toFixed(2), updated_at: new Date().toISOString() })
    .eq("id", 1);

  // Upsert all touched holdings; delete any that dropped to 0.
  for (const [ticker, h] of workingHoldings) {
    await supabase.from("portfolio_holdings").upsert({
      ticker,
      shares: h.shares,
      avg_cost: h.avg_cost.toFixed(2),
      updated_at: new Date().toISOString(),
    });
  }
  const keptTickers = new Set(workingHoldings.keys());
  const removed = holdings.filter((h) => !keptTickers.has(h.ticker));
  if (removed.length > 0) {
    await supabase
      .from("portfolio_holdings")
      .delete()
      .in("ticker", removed.map((r) => r.ticker));
  }

  // Snapshot BEFORE inserting trade rows (so we can attach snapshot_id to them).
  const finalTotal =
    workingCash +
    [...workingHoldings].reduce(
      (s, [t, h]) => s + h.shares * (quotes[t]?.c ?? 0),
      0,
    );

  // S&P equivalent: the value of $10,000 invested in SPY at inception, with
  // no rebalancing. We derive "inception SPY price" from the earliest snapshot.
  const spy = await quote(env, INDEX_PROXIES.sp500);
  const { data: firstSnap } = await supabase
    .from("portfolio_snapshots")
    .select("sp500_value, snapshot_at")
    .order("snapshot_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  // If this is the very first snapshot, align the S&P baseline to $10k.
  let sp500Value = 10000;
  if (firstSnap) {
    // Use a stored ratio so S&P tracking is robust to price-history gaps.
    const { data: baselineRow } = await supabase
      .from("portfolio_snapshots")
      .select("sp500_value, snapshot_at")
      .order("snapshot_at", { ascending: true })
      .limit(1)
      .single();
    const baseline = Number(baselineRow?.sp500_value ?? 10000);
    // Quick approximation: scale by current SPY price vs. price at first snapshot.
    // For a better chart in the future, store the baseline SPY price separately.
    const prevSpyQuote = quotes[INDEX_PROXIES.sp500];
    sp500Value = baseline * (spy.c / (prevSpyQuote?.c ?? spy.c));
  }

  const { data: snap } = await supabase
    .from("portfolio_snapshots")
    .insert({
      total_value: finalTotal.toFixed(2),
      sp500_value: sp500Value.toFixed(2),
      narrative: decision.narrative ?? null,
    })
    .select("id")
    .single();

  for (const t of executed) {
    await supabase.from("portfolio_trades").insert({
      ticker: t.ticker,
      action: t.action,
      shares: t.shares,
      price: t.price.toFixed(2),
      rationale: t.rationale,
      snapshot_id: snap?.id ?? null,
    });
  }

  console.log(
    `greenhouse: ${executed.length} trades · cash ${workingCash.toFixed(2)} · total ${finalTotal.toFixed(2)}`,
  );
}
