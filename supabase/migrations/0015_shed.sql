-- Bloomgarden — Shed page: todo tags + notepad.
-- Idempotent: safe to re-run if a previous attempt partially applied.

-- ═══════════════════════════════════════════════════════════════════════════
-- Todos get a single optional tag. Freeform text so users can invent their own
-- beyond the default chips (urgent / admin / project).
-- ═══════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'todos'
       and column_name = 'tag'
  ) then
    alter table public.todos
      add column tag text check (tag is null or char_length(tag) between 1 and 40);
  end if;
end $$;

create index if not exists todos_user_tag_idx on public.todos (user_id, tag);

-- ═══════════════════════════════════════════════════════════════════════════
-- Notepad — small note-taking widget for the Shed.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  body        text check (body is null or char_length(body) <= 20000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists notes_user_idx
  on public.notes (user_id, updated_at desc);

alter table public.notes enable row level security;

drop policy if exists notes_own on public.notes;
create policy notes_own on public.notes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists notes_touch on public.notes;
create trigger notes_touch
  before update on public.notes
  for each row execute function public.touch_updated_at();
