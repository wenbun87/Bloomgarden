import type { Env } from "./env";
import { adminClient } from "./supabase";
import { groqJson } from "./groq";
import { GREENHOUSE_UNIVERSE, INDEX_PROXIES, quoteMany } from "./finnhub";

// Free-tier Workers cap at 50 subrequests per invocation. KV read+write + one
// Finnhub call per symbol ≈ 3 subrequests each. A 10-symbol mover universe
// keeps the forecast comfortably under the limit.
const FORECAST_MOVER_UNIVERSE = GREENHOUSE_UNIVERSE.slice(0, 10);

// The Forecast — daily market brief.
// Runs ~30 min after US close (21:00 UTC). One shared row per UTC date.
type ForecastBrief = {
  summary: string;  // "Tech warmed up today…" — two sentences, weather-voiced
};

export async function runForecast(
  env: Env,
  opts: { force?: boolean } = {},
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const supabase = adminClient(env);

  // Skip if we already ran today — unless the caller forces a regeneration
  // (used by the manual trigger after a prompt change).
  if (!opts.force) {
    const { data: existing } = await supabase
      .from("market_briefs")
      .select("date")
      .eq("date", today)
      .maybeSingle();
    if (existing) {
      console.log(`forecast: already ran for ${today}`);
      return;
    }
  }

  // 1. Indices (via ETF proxies — free tier).
  const indexSymbols = Object.values(INDEX_PROXIES);
  const indexQuotes = await quoteMany(env, indexSymbols);
  const indices = Object.fromEntries(
    Object.entries(INDEX_PROXIES).map(([label, symbol]) => {
      const q = indexQuotes[symbol];
      return [
        label,
        q ? { price: q.c, change_pct: q.dp, symbol } : null,
      ];
    }),
  );

  // 2. Top 5 gainers + losers from the same single quote-batch — deriving both
  // in memory avoids fetching the universe twice.
  const moverQuotes = await quoteMany(env, FORECAST_MOVER_UNIVERSE);
  const moverRows = Object.entries(moverQuotes).map(([symbol, q]) => ({
    symbol,
    change_pct: q.dp,
    price: q.c,
  }));
  const gainers = [...moverRows]
    .sort((a, b) => b.change_pct - a.change_pct)
    .slice(0, 5);
  const losers = [...moverRows]
    .sort((a, b) => a.change_pct - b.change_pct)
    .slice(0, 5);

  // 3. Groq summary. Weather-toned opener + a couple of concrete drivers so
  // readers get real signal, not just vibes.
  const brief = await groqJson<ForecastBrief>(env, {
    system:
      "You write The Forecast — a daily market briefing for Bloomgarden. Output JSON {\"summary\": string} with 3-4 sentences, under 120 words. First sentence: a weather-like one-liner setting the mood ('Tech warmed up as Nvidia led the index higher'). Remaining sentences: concrete events / news / macro drivers visible in the provided movers data — earnings beats or misses, rate decisions, geopolitics, commodity moves, sector rotations. Be specific (reference tickers by name, not sector alone). No investment advice, no emojis, no markdown, no 'the market' as a character.",
    user: JSON.stringify({ date: today, indices, gainers, losers }),
    temperature: 0.4,
  });

  await supabase.from("market_briefs").upsert({
    date: today,
    summary: brief.summary,
    indices_json: indices,
    movers_json: { gainers, losers },
  });

  console.log(`forecast: wrote brief for ${today}`);
}
