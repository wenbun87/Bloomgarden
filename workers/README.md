# Bloomgarden Workers

Cloudflare Worker that drives the three AI widgets (Forecast, Greenhouse, Field Notes) plus the weekly habit rollup. Runs on four cron triggers; can also be manually poked via HTTP for testing.

## One-time setup

### 1. Accounts + API keys

| Service | What for | How |
|---|---|---|
| **Groq** | LLM summaries | [console.groq.com/keys](https://console.groq.com/keys) → create key |
| **Finnhub** | Market data | [finnhub.io/register](https://finnhub.io/register) → free tier → dashboard shows the key |
| **Cloudflare** | Worker hosting | [dash.cloudflare.com](https://dash.cloudflare.com) — free tier is fine |

### 2. Install + log into wrangler

```bash
cd workers
npm install
npx wrangler login
```

This opens a browser tab to authorize wrangler against your Cloudflare account.

### 3. Create the KV namespace

```bash
npx wrangler kv namespace create CACHE
```

It prints back an `id` — paste that into the `[[kv_namespaces]]` block in `wrangler.toml` (uncomment the block too). Same for `SUPABASE_URL` in `[vars]`.

### 4. Set secrets

```bash
npx wrangler secret put GROQ_API_KEY                   # paste Groq key
npx wrangler secret put FINNHUB_API_KEY                # paste Finnhub key
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY      # from Supabase → Settings → API → service_role
npx wrangler secret put MANUAL_TRIGGER_TOKEN           # any random string, used to gate the HTTP endpoints
```

The service role key **bypasses RLS** — it only lives here, never in the React app.

### 5. Deploy

```bash
npx wrangler deploy
```

That registers the crons + serves the HTTP handler. You'll get back a `*.workers.dev` URL.

## Seeding the tables (first-run)

The cron triggers will fire on their schedule. If you want to populate immediately so the dashboard has something to show:

```bash
# Replace with your deployed URL + MANUAL_TRIGGER_TOKEN value
WORKER_URL="https://bloomgarden-workers.<subdomain>.workers.dev"
TOKEN="<your-manual-trigger-token>"

curl -X POST $WORKER_URL/trigger/forecast      -H "x-trigger-token: $TOKEN"
curl -X POST $WORKER_URL/trigger/field-notes   -H "x-trigger-token: $TOKEN"
curl -X POST $WORKER_URL/trigger/greenhouse    -H "x-trigger-token: $TOKEN"
curl -X POST $WORKER_URL/trigger/weekly-rollup -H "x-trigger-token: $TOKEN"
```

Refresh the Briefs page — widgets populate. The Greenhouse chart needs at least 2 snapshots to render (run the trigger twice with a ~minute gap for a quick preview).

Tailing logs:

```bash
npx wrangler tail
```

## Cron schedule (UTC)

| Cron | What |
|---|---|
| `0 21 * * *` | Forecast — daily market brief, ~30 min after US close |
| `0 20 * * 0` | Field Notes — Sunday research digest |
| `0 21 * * 0` | Weekly habit rollup (calls the `weekly_rollup` SQL function) |
| `0 22 * * 0` | Greenhouse — weekly AI portfolio rebalance |

## Adding / removing research feeds

Feeds are rows in `public.research_feeds`. SQL editor:

```sql
insert into public.research_feeds (url, name)
values ('https://example.com/feed.xml', 'Source Name');

update public.research_feeds set enabled = false where name = 'Example';
```
