# Bloomgarden

A friends-only gamified life dashboard. Do life-affirming things → earn coins → grow a cozy garden.

Sibling product to [Bloomboard](https://bloomboard-ndl.pages.dev). Visual identity is a deliberate placeholder until the Saturday design pass (see `src/styles/tokens.css`).

## Layout

```
src/            React app (Vite, see below)
supabase/       SQL migrations (run in order: 0001 → 0006)
workers/        Cloudflare Worker for AI widgets + cron — see workers/README.md
```

## Phase A — Foundation

Shipped:

- Vite + React + TS + Tailwind scaffold
- `tokens.css` placeholder pastel palette (Saturday's swap target)
- Supabase schema (`profiles`, `friendships`) + RLS
- Magic-link auth, protected routes, `AuthCallback`
- Onboarding (set username + display_name)
- Friends: send / accept / decline / cancel requests, list friends
- Friend profile page (empty widgets, RLS-gated)
- `WidgetCard` primitive + `Shell` chrome + `Dashboard` grid with placeholder widgets

Not yet (Phase B and later): habit widgets, coin engine, leaderboard, garden economy, net worth, to-do, AI widgets.

## Setup

```bash
npm install
cp .env.example .env
# fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from the Supabase dashboard
```

Apply migrations in the Supabase SQL editor (or via the CLI):

```
supabase/migrations/0001_schema.sql
supabase/migrations/0002_rls.sql
```

Then:

```bash
npm run dev
```

## Phase A ship-milestone verification

1. Open two browsers (or a browser + an incognito window).
2. Sign up two accounts with different emails; complete onboarding for each with different usernames.
3. From account A, add account B by username → pending request appears for B.
4. From account B, accept → each sees the other under **Friends**.
5. Tap a friend tile → their profile loads, widgets are empty (as expected for Phase A).
6. Try visiting `/u/<stranger-username>` while not friends → you see "Not friends yet" (RLS blocks the read).

## Stack

See `~/.claude/plans/my-claude-design-credits-glistening-candy.md` for the full Bloomgarden plan, coin engine, garden economy, AI widget specs, and later-phase build order.

## Layout

```
src/
  components/
    ui/           # minimal primitives (Button, Input)
    WidgetCard    # the single card primitive every widget wraps
    Shell         # app chrome + nav
    EmptyState
  hooks/          # useSession, useProfile, useFriends
  lib/            # supabase client, database types, cn()
  pages/          # Login, AuthCallback, Onboarding, Dashboard, Friends, Profile
  styles/         # tokens.css (design swap target) + globals.css
supabase/
  migrations/     # 0001 schema, 0002 RLS (accept_friend_request RPC)
```
