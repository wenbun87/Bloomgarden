import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { CalendarEvent } from "@/lib/calendar";

// Fetch calendar events for a set of users (me + any overlaid friends) within a
// date range. RLS guarantees we only ever get back rows we're allowed to see —
// our own, or accepted friends'. The date range is the visible month grid.
export function useCalendar(
  userIds: string[],
  rangeStart: string,
  rangeEnd: string,
) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stable primitive dep — the array identity changes every render.
  const idsKey = userIds.join(",");

  const load = useCallback(async () => {
    const ids = idsKey ? idsKey.split(",") : [];
    if (ids.length === 0) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("calendar_events")
      .select(
        "id, user_id, title, event_date, all_day, start_time, end_time, note, source",
      )
      .in("user_id", ids)
      .gte("event_date", rangeStart)
      .lte("event_date", rangeEnd)
      .order("start_time", { nullsFirst: true });

    if (err) {
      setError(err.message);
      setEvents([]);
    } else {
      setEvents((data ?? []) as CalendarEvent[]);
    }
    setLoading(false);
  }, [idsKey, rangeStart, rangeEnd]);

  useEffect(() => {
    load();
  }, [load]);

  return { events, loading, error, reload: load };
}
