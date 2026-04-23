-- Bloomgarden — per-user widget visibility.
-- Lets users hide any non-habit widget across the app. Coexists with
-- user_habit_hidden (which stays as-is for the 8 built-in habits).

create table public.user_hidden_widgets (
  user_id     uuid not null references auth.users(id) on delete cascade,
  widget_key  text not null check (char_length(widget_key) between 1 and 60),
  primary key (user_id, widget_key)
);

alter table public.user_hidden_widgets enable row level security;

create policy user_hidden_widgets_own on public.user_hidden_widgets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
