-- Bloomgarden — drop the single-arg log_custom_habit overload.
-- Migration 0020 added a 2-arg overload `log_custom_habit(habit_id_in, date_in)`
-- with a default for date_in, but the older 1-arg version from 0011/0018
-- was never dropped. Postgres now sees both candidates as matching when the
-- client calls with just habit_id_in, and errors with:
--   "Could not choose the best candidate function between: ..."
-- Drop the orphan; the 2-arg version covers both call shapes.

drop function if exists public.log_custom_habit(uuid);
