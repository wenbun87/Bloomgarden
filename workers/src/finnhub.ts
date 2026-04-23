import type { Env } from "./env";

// Finnhub free tier: 60 req/min. Everything here hits KV first to stay well
// under. Quotes cache for 2 min; news for 6 hours; index values for 5 min.

const BASE = "https://finnhub.io/api/v1";

async function call<T>(env: Env, path: string): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE}${path}${sep}token=${env.FINNHUB_API_KEY}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`finnhub ${resp.status}: ${text.slice(0, 300)}`);
  }
  return (await resp.json()) as T;
}

async function cached<T>(
  env: Env,
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const hit = await env.CACHE.get(key);
  if (hit) return JSON.parse(hit) as T;
  const value = await fetcher();
  await env.CACHE.put(key, JSON.stringify(value), {
    expirationTtl: ttlSeconds,
  });
  return value;
}

export type Quote = {
  c: number;   // current
  d: number;   // change
  dp: number;  // change %
  h: number;   // high
  l: number;   // low
  o: number;   // open
  pc: number;  // previous close
  t: number;   // timestamp
};

export async function quote(env: Env, symbol: string): Promise<Quote> {
  return cached(env, `fh:quote:${symbol}`, 120, () =>
    call<Quote>(env, `/quote?symbol=${encodeURIComponent(symbol)}`),
  );
}

// Quote batch — hits quote(env, ...) in sequence with tiny pauses to stay under
// rate limits. Max ~20 symbols recommended per batch.
export async function quoteMany(
  env: Env,
  symbols: string[],
): Promise<Record<string, Quote>> {
  const out: Record<string, Quote> = {};
  for (const s of symbols) {
    try {
      out[s] = await quote(env, s);
    } catch {
      // skip individual failures
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  return out;
}

// Top movers from a symbol universe — sorted by absolute % change.
export async function topMovers(
  env: Env,
  universe: string[],
  direction: "up" | "down",
  limit = 5,
): Promise<{ symbol: string; change_pct: number; price: number }[]> {
  const quotes = await quoteMany(env, universe);
  const rows = Object.entries(quotes).map(([symbol, q]) => ({
    symbol,
    change_pct: q.dp,
    price: q.c,
  }));
  rows.sort((a, b) =>
    direction === "up" ? b.change_pct - a.change_pct : a.change_pct - b.change_pct,
  );
  return rows.slice(0, limit);
}

type NewsArticle = {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
};

export async function companyNews(
  env: Env,
  symbol: string,
  fromIso: string,
  toIso: string,
): Promise<NewsArticle[]> {
  const key = `fh:news:${symbol}:${fromIso}:${toIso}`;
  return cached(env, key, 6 * 3600, () =>
    call<NewsArticle[]>(
      env,
      `/company-news?symbol=${encodeURIComponent(symbol)}&from=${fromIso}&to=${toIso}`,
    ),
  );
}

// Default universe for The Greenhouse: core mega-caps across sectors.
// Swap for S&P 100 if you want a broader set.
export const GREENHOUSE_UNIVERSE = [
  "AAPL","MSFT","GOOGL","AMZN","META","NVDA","TSLA","BRK.B","JPM","V",
  "UNH","WMT","JNJ","PG","XOM","MA","HD","CVX","LLY","KO",
  "PEP","ABBV","ORCL","CRM","ADBE",
];

// Proxies for market indices via ETFs since Finnhub's index endpoint is paid.
export const INDEX_PROXIES = {
  sp500: "SPY",
  nasdaq: "QQQ",
  dow: "DIA",
  vix: "VIXY",   // iPath VIX ETN — imperfect but free-tier friendly
};
