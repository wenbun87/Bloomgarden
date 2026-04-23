import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Widget keys we use across the app. Keep in sync with Settings UI.
// Core widgets (InventoryWidget, ShopWidget, NetWorthWidget, LeaderboardWidget,
// FriendsList) aren't included — hiding them would break the product shape.
export const WIDGET_KEYS = [
  // Dashboard
  "dashboard:streaks",
  "dashboard:todo",
  // Garden
  "garden:mailbox",
  // Kitchen
  "kitchen:food-search",
  "kitchen:food-tracker",
  "kitchen:recipe-suggest",
  "kitchen:cookbook",
  "kitchen:dirty-dozen",
  "kitchen:field-notes",
  // Orchard
  "orchard:wishlist",
  "orchard:forecast",
  "orchard:greenhouse",
] as const;

export type WidgetKey = (typeof WIDGET_KEYS)[number];

export const WIDGET_LABELS: Record<WidgetKey, { page: string; label: string }> =
  {
    "dashboard:streaks": { page: "Dashboard", label: "Streaks (7-day grid)" },
    "dashboard:todo": { page: "Dashboard", label: "To do list" },
    "garden:mailbox": { page: "Garden", label: "Mailbox" },
    "kitchen:food-search": { page: "Kitchen", label: "Food search" },
    "kitchen:food-tracker": { page: "Kitchen", label: "Food tracker" },
    "kitchen:recipe-suggest": { page: "Kitchen", label: "Recipe suggester" },
    "kitchen:cookbook": { page: "Kitchen", label: "Cookbook" },
    "kitchen:dirty-dozen": { page: "Kitchen", label: "Dirty Dozen" },
    "kitchen:field-notes": { page: "Kitchen", label: "Field Notes" },
    "orchard:wishlist": { page: "Orchard", label: "Wishlist" },
    "orchard:forecast": { page: "Orchard", label: "The Forecast" },
    "orchard:greenhouse": { page: "Orchard", label: "The Greenhouse" },
  };

export function useHiddenWidgets(userId: string | undefined) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("user_hidden_widgets")
      .select("widget_key")
      .eq("user_id", userId);
    setHidden(new Set(((data ?? []) as { widget_key: string }[]).map((r) => r.widget_key)));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = useCallback(
    async (key: WidgetKey, hide: boolean) => {
      if (!userId) return;
      if (hide) {
        await supabase
          .from("user_hidden_widgets")
          .insert({ user_id: userId, widget_key: key });
      } else {
        await supabase
          .from("user_hidden_widgets")
          .delete()
          .eq("user_id", userId)
          .eq("widget_key", key);
      }
      load();
    },
    [userId, load],
  );

  return { hidden, loading, toggle, reload: load };
}
