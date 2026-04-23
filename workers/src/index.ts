import { Hono } from "hono";
import type { Env } from "./env";
import { runForecast } from "./forecast";
import { runFieldNotes } from "./field-notes";
import { runGreenhouse } from "./greenhouse";
import { adminClient } from "./supabase";
import { groqJson } from "./groq";

const app = new Hono<{ Bindings: Env }>();

// Manual trigger endpoints — handy for first-run seeding and dev. Protected
// by a shared-secret header so the public internet can't spam them.
// Set MANUAL_TRIGGER_TOKEN as a secret; pass it via `x-trigger-token: ...`.
async function authorized(c: {
  env: Env;
  req: { header: (name: string) => string | undefined };
}) {
  const expected = (c.env as unknown as { MANUAL_TRIGGER_TOKEN?: string })
    .MANUAL_TRIGGER_TOKEN;
  const got = c.req.header("x-trigger-token");
  return !!expected && got === expected;
}

app.get("/", (c) => c.text("bloomgarden workers — alive"));

// CORS — lets the Pages frontend hit these endpoints from the browser.
const CORS_HEADERS_ANALYSIS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const CORS_HEADERS_FOOD = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

app.use("/analysis/*", async (c, next) => {
  if (c.req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS_ANALYSIS });
  }
  for (const [k, v] of Object.entries(CORS_HEADERS_ANALYSIS)) c.header(k, v);
  await next();
});

app.use("/food/*", async (c, next) => {
  if (c.req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS_FOOD });
  }
  for (const [k, v] of Object.entries(CORS_HEADERS_FOOD)) c.header(k, v);
  await next();
});

// ─── Food search proxy (Open Food Facts) ─────────────────────────────────────
// Some users' browsers or extensions block OFF directly. Proxy through the
// Worker — same API shape, KV-cached for 6 hours per query.
const OFF_FIELDS = [
  "code",
  "product_name",
  "brands",
  "nutriscore_grade",
  "nova_group",
  "ecoscore_grade",
  "ingredients_text_en",
  "ingredients_text",
  "nutriments",
  "serving_size",
  "serving_quantity",
  "packaging_materials_tags",
].join(",");

// Try the legacy cgi/search.pl first (richer fields); fall back to the newer
// search-a-licious endpoint at search.openfoodfacts.org when legacy 5xx's.
// Each is retried once with backoff. Successful responses are normalised to
// the `{products: [...]}` shape the client already consumes.

async function tryLegacySearch(
  q: string,
  limit: number,
): Promise<Response | null> {
  const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
  url.searchParams.set("search_terms", q);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", String(limit));
  url.searchParams.set("fields", OFF_FIELDS);
  url.searchParams.set("lc", "en");                   // prefer English names
  url.searchParams.set("sort_by", "unique_scans_n");  // popularity proxy — valid OFF value
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(url.toString());
      if (resp.ok) return resp;
      if (resp.status < 500) return resp;   // 4xx — don't retry
    } catch {
      // network — retry once
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}

// Search-a-licious doesn't index serving_size / serving_quantity even when
// returning the full doc. Enrich by hitting the v2 per-product endpoint for
// each result in parallel — ~12 extra subrequests, well under the 50 limit,
// and the whole thing lands in KV for 6h so the cost is paid once per query.
async function enrichServings(
  products: { code?: string }[],
): Promise<{ code?: string }[]> {
  return Promise.all(
    products.map(async (p) => {
      if (!p.code) return p;
      try {
        const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
          p.code,
        )}.json?fields=code,serving_size,serving_quantity`;
        const resp = await fetch(url);
        if (!resp.ok) return p;
        const data = (await resp.json()) as {
          product?: {
            serving_size?: string;
            serving_quantity?: string | number;
          };
        };
        if (!data.product) return p;
        return {
          ...p,
          serving_size: data.product.serving_size,
          serving_quantity: data.product.serving_quantity,
        };
      } catch {
        return p;
      }
    }),
  );
}

async function trySearchALicious(
  q: string,
  limit: number,
): Promise<{ products: unknown[] } | null> {
  // Elasticsearch-based relevance — handles stemming, typos, and multi-word
  // queries far better than the legacy CGI. Leaving `fields` unset returns the
  // full indexed doc, which includes serving_quantity / serving_size.
  const url = new URL("https://search.openfoodfacts.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("page_size", String(limit));
  url.searchParams.set("langs", "en");
  try {
    const resp = await fetch(url.toString());
    if (!resp.ok) return null;
    const data = (await resp.json()) as { hits?: unknown[] };
    return { products: data.hits ?? [] };
  } catch {
    return null;
  }
}

app.get("/food/search", async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  const limit = Math.min(20, parseInt(c.req.query("limit") ?? "12", 10) || 12);
  if (!q) return c.json({ products: [] });

  // v3 = search-a-licious as primary. Bumping the prefix invalidates older
  // caches built from the legacy-first responses.
  const cacheKey = `off:search:v6:${q.toLowerCase()}:${limit}`;
  const cached = await c.env.CACHE.get(cacheKey);
  if (cached) return c.body(cached, 200, { "content-type": "application/json" });

  // Primary: search-a-licious (ES) — better relevance for generic queries.
  const primary = await trySearchALicious(q, limit);
  if (primary && primary.products.length > 0) {
    const enriched = await enrichServings(
      primary.products as { code?: string }[],
    );
    const body = JSON.stringify({ products: enriched });
    await c.env.CACHE.put(cacheKey, body, { expirationTtl: 6 * 3600 });
    return c.body(body, 200, { "content-type": "application/json" });
  }

  // Fallback: legacy CGI search (wider compatibility but weaker ranking).
  const legacy = await tryLegacySearch(q, limit);
  if (legacy) {
    const body = await legacy.text();
    if (legacy.ok) {
      await c.env.CACHE.put(cacheKey, body, { expirationTtl: 15 * 60 });
      return c.body(body, 200, { "content-type": "application/json" });
    }
  }

  return c.json(
    { error: "Open Food Facts is temporarily unavailable — please try again." },
    502,
  );
});

// Auth check — uses the user's Supabase access token (NOT the trigger token).
async function authedUserId(c: {
  env: Env;
  req: { header: (name: string) => string | undefined };
}): Promise<string | null> {
  const authHeader = c.req.header("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const sb = adminClient(c.env);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

// Recipe suggestions. Client posts ingredients + optional prefs; Groq returns
// 3 recipes shaped for the Kitchen widget. Authenticated only.
app.post("/analysis/recipes", async (c) => {
  const userId = await authedUserId(c);
  if (!userId) return c.json({ error: "unauthorized" }, 401);

  const body = (await c.req.json().catch(() => null)) as
    | { ingredients: string[]; preferences?: string }
    | null;
  if (!body || !Array.isArray(body.ingredients) || body.ingredients.length === 0) {
    return c.json({ error: "add at least one ingredient" }, 400);
  }

  try {
    const result = await groqJson<{
      recipes: {
        title: string;
        description: string;
        minutes: number;
        servings: number;
        calories: number;
        protein_g: number;
        carbs_g: number;
        fat_g: number;
        ingredients: { name: string; amount: string; have: boolean }[];
        steps: string[];
        health_notes: string;
      }[];
    }>(c.env, {
      system:
        "You suggest healthy home-cooked recipes for Bloomgarden's Kitchen. Given the user's on-hand ingredients (and any preferences), return 3 distinct recipes that USE most of those ingredients and suggest 1-5 common pantry additions. Favor whole foods, minimal processing (low NOVA), and clean ingredients. Output JSON: {recipes: [{title: string, description: string (one sentence), minutes: number (total cook time), servings: number, calories: number (per serving), protein_g: number, carbs_g: number, fat_g: number, ingredients: [{name, amount, have: boolean (true if from the user's list)}], steps: string[] (5-8 short steps), health_notes: string (one sentence)}]}. Be concrete about amounts (e.g. '2 tbsp olive oil', '200g spinach'). No seed oils if avoidable.",
      user: JSON.stringify({
        on_hand: body.ingredients,
        preferences: body.preferences ?? "",
      }),
      temperature: 0.5,
    });
    return c.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("recipes failed:", msg);
    return c.json({ error: msg }, 500);
  }
});

// Net-worth analysis. Client posts its accounts + projection; Worker returns
// 2-3 sentences from Groq. Nothing persisted, nothing cached — keep it simple.
app.post("/analysis/net-worth", async (c) => {
  const userId = await authedUserId(c);
  if (!userId) return c.json({ error: "unauthorized" }, 401);

  const body = (await c.req.json().catch(() => null)) as
    | {
        accounts: { name: string; type: string; balance: number }[];
        total: number;
        projection?: {
          monthly: number;
          rate_pct: number;
          years: number;
          future_value: number;
        } | null;
      }
    | null;
  if (!body || !Array.isArray(body.accounts)) {
    return c.json({ error: "invalid body" }, 400);
  }

  try {
    const analysis = await groqJson<{ analysis: string; suggestions: string[] }>(
      c.env,
      {
        system:
          "You are a friendly financial coach for Bloomgarden. Given a snapshot of someone's accounts and (optionally) their retirement projection, write a short observational analysis and 2-3 concrete suggestions. Output JSON {analysis: string (2-3 sentences), suggestions: string[] (2-3 short, actionable items)}. Be warm, not preachy. Flag concentration risk, emergency-fund gaps, or glaring imbalances. Never promise returns. Include the phrase 'not financial advice' somewhere in the analysis.",
        user: JSON.stringify(body),
        temperature: 0.4,
      },
    );
    return c.json(analysis);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("analysis failed:", msg);
    return c.json({ error: msg }, 500);
  }
});

async function runGuarded(
  fn: () => Promise<unknown>,
): Promise<{ ok: true } | { ok: false; error: string; stack?: string }> {
  try {
    await fn();
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("trigger failed:", msg, stack);
    return { ok: false, error: msg, stack };
  }
}

app.post("/trigger/forecast", async (c) => {
  if (!(await authorized(c))) return c.text("unauthorized", 401);
  const force = c.req.query("force") === "1";
  const result = await runGuarded(() => runForecast(c.env, { force }));
  return c.json(result, result.ok ? 200 : 500);
});

app.post("/trigger/field-notes", async (c) => {
  if (!(await authorized(c))) return c.text("unauthorized", 401);
  const result = await runGuarded(() => runFieldNotes(c.env));
  return c.json(result, result.ok ? 200 : 500);
});

app.post("/trigger/greenhouse", async (c) => {
  if (!(await authorized(c))) return c.text("unauthorized", 401);
  const result = await runGuarded(() => runGreenhouse(c.env));
  return c.json(result, result.ok ? 200 : 500);
});

app.post("/trigger/weekly-rollup", async (c) => {
  if (!(await authorized(c))) return c.text("unauthorized", 401);
  const result = await runGuarded(async () => {
    const sb = adminClient(c.env);
    const { error } = await sb.rpc("weekly_rollup");
    if (error) throw new Error(error.message);
  });
  return c.json(result, result.ok ? 200 : 500);
});

export default {
  fetch: app.fetch,

  // Cron dispatch. Wrangler calls `scheduled` with the cron pattern that fired.
  // Pattern-match here so we don't need a separate Worker per cron.
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const run = async () => {
      switch (event.cron) {
        case "0 21 * * *":
          await runForecast(env);
          return;
        case "0 20 * * SUN":
          await runFieldNotes(env);
          return;
        case "0 22 * * SUN": {
          // Sunday pipeline: habit rollup first (SQL fn from 0003), then the
          // AI portfolio rebalance. Runs sequentially in the same invocation.
          const sb = adminClient(env);
          await sb.rpc("weekly_rollup");
          await runGreenhouse(env);
          return;
        }
        default:
          console.warn("unknown cron", event.cron);
      }
    };
    ctx.waitUntil(run());
  },
};
