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

    // Two filters, ANDed:
    //  1) membership — the event is owned by, or shares in, one of `ids`
    //     (so shared events reach participants, not just the creator).
    //  2) date overlap — a multi-day event that starts before the grid or ends
    //     after it still shows on its in-range days.
    const idList = ids.join(",");
    const { data, error: err } = await supabase
      .from("calendar_events")
      .select(
        "id, user_id, title, event_date, end_date, all_day, start_time, end_time, note, source, participant_ids, shared_label",
      )
      .or(`user_id.in.(${idList}),participant_ids.ov.{${idList}}`)
      .lte("event_date", rangeEnd)
      .or(`end_date.gte.${rangeStart},and(end_date.is.null,event_date.gte.${rangeStart})`)
      .order("event_date", { ascending: true })
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
