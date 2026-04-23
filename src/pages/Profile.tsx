import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Crown, ExternalLink, PenSquare } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/useSession";
import { useProfile } from "@/hooks/useProfile";
import { SendMessageDialog } from "@/widgets/social/SendMessageDialog";
import type { Planting } from "@/hooks/useGarden";
import type { WishlistItem } from "@/hooks/useWishlist";
import { cn } from "@/lib/utils";

type ProfileView = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  coin_balance: number | null;
  lifetime_coins: number | null;
};

export default function Profile() {
  const { username } = useParams<{ username: string }>();
  const { session } = useSession();
  const myId = session?.user.id;
  const myProfile = useProfile(myId);
  const [sending, setSending] = useState(false);
  const [state, setState] = useState<
    | { kind: "loading" }
    | {
        kind: "ok";
        profile: ProfileView;
        plotCount: number;
        plantings: Planting[];
        wishlist: WishlistItem[];
      }
    | { kind: "missing" }
    | { kind: "not-friends" }
    | { kind: "error"; msg: string }
  >({ kind: "loading" });

  useEffect(() => {
    if (!username) return;
    (async () => {
      const { data: lookup, error: lookupErr } = await supabase
        .from("profile_lookup")
        .select("id")
        .eq("username", username)
        .maybeSingle();

      if (lookupErr) return setState({ kind: "error", msg: lookupErr.message });
      if (!lookup) return setState({ kind: "missing" });

      const id = (lookup as { id: string }).id;

      const [profileRes, plotsRes, plantingsRes, wishlistRes] =
        await Promise.all([
          supabase
            .from("profiles")
            .select(
              "id, username, display_name, avatar_url, coin_balance, lifetime_coins",
            )
            .eq("id", id)
            .maybeSingle(),
          supabase
            .from("garden_plots")
            .select("plot_count")
            .eq("user_id", id)
            .maybeSingle(),
          supabase
            .from("plantings")
            .select(
              "id, user_id, species_id, plot_index, planted_at, harvests_at, fertilizer_days, status, harvested_at, species:plant_species(*)",
            )
            .eq("user_id", id),
          // RLS filters to show_in_profile=true items on friends' lists.
          supabase
            .from("wishlist_items")
            .select("*")
            .eq("user_id", id)
            .eq("show_in_profile", true)
            .order("created_at", { ascending: false }),
        ]);

      if (profileRes.error)
        return setState({ kind: "error", msg: profileRes.error.message });
      if (!profileRes.data) return setState({ kind: "not-friends" });

      setState({
        kind: "ok",
        profile: profileRes.data as ProfileView,
        plotCount:
          ((plotsRes.data as { plot_count: number } | null)?.plot_count) ?? 4,
        plantings: (plantingsRes.data ?? []) as unknown as Planting[],
        wishlist: ((wishlistRes.data ?? []) as WishlistItem[]).map((w) => ({
          ...w,
          price: w.price == null ? null : Number(w.price),
        })),
      });
    })();
  }, [username]);

  if (state.kind === "loading")
    return <p className="text-sm text-[var(--color-muted)]">Loading profile…</p>;

  if (state.kind === "missing")
    return (
      <WidgetCard>
        <EmptyState
          title="No one here by that name"
          hint={`@${username} doesn't exist.`}
        />
      </WidgetCard>
    );

  if (state.kind === "not-friends")
    return (
      <WidgetCard>
        <EmptyState
          title="Not friends yet"
          hint="You'll see their garden once they accept your request."
          action={
            <Link to="/friends" className="text-sm text-[var(--color-accent)] underline">
              Manage friends
            </Link>
          }
        />
      </WidgetCard>
    );

  if (state.kind === "error")
    return (
      <WidgetCard>
        <p className="text-sm text-red-600">{state.msg}</p>
      </WidgetCard>
    );

  const { profile: p, plotCount, plantings, wishlist } = state;
  const byPlot = new Map(plantings.map((pl) => [pl.plot_index, pl]));
  const plots = Array.from({ length: plotCount }, (_, i) => i);

  const isSelf = myId === p.id;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {p.display_name}
          </h1>
          <p className="text-sm text-[var(--color-muted)]">@{p.username}</p>
        </div>
        {!isSelf && (
          <Button size="sm" variant="soft" onClick={() => setSending(true)}>
            <PenSquare size={12} />
            Send a message
          </Button>
        )}
      </div>

      {sending && myId && (
        <SendMessageDialog
          userId={myId}
          coinBalance={myProfile.profile?.coin_balance ?? 0}
          lifetimeCoins={myProfile.profile?.lifetime_coins ?? 0}
          initialFriendId={p.id}
          onCancel={() => setSending(false)}
          onSent={() => setSending(false)}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <WidgetCard title="Coin balance">
          <p className="text-3xl font-semibold tabular-nums">
            {p.coin_balance ?? 0}
          </p>
          <p className="text-xs text-[var(--color-muted)]">
            Lifetime: {p.lifetime_coins ?? 0}
          </p>
        </WidgetCard>

        <WidgetCard
          title={`${p.display_name.split(" ")[0]}'s garden`}
          className="lg:col-span-2"
          action={
            <span className="text-xs text-[var(--color-muted)]">
              {plantings.length}/{plotCount} plots
            </span>
          }
        >
          {plantings.length === 0 ? (
            <EmptyState
              title="Nothing planted yet"
              hint="Come back when they've grown something."
            />
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {plots.map((i) => {
                const pl = byPlot.get(i);
                if (!pl) {
                  return (
                    <div
                      key={i}
                      className="aspect-square rounded-card border border-dashed border-[var(--color-border)] bg-white/40"
                    />
                  );
                }
                const now = Date.now();
                const ready =
                  pl.status === "growing" &&
                  new Date(pl.harvests_at).getTime() <= now;
                const kept = pl.status === "kept";
                return (
                  <div
                    key={i}
                    className={cn(
                      "relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-card border p-1.5 text-center",
                      kept
                        ? "border-amber-200/80 bg-amber-50/70"
                        : ready
                          ? "border-green-300/80 bg-green-50/70"
                          : "border-[var(--color-border)] bg-white/70",
                    )}
                  >
                    <span className="text-2xl leading-none">
                      {pl.species.sprite_emoji}
                    </span>
                    <span className="truncate text-[10px] font-medium">
                      {pl.species.name}
                    </span>
                    {kept && (
                      <Crown
                        size={10}
                        className="absolute right-1 top-1 text-amber-500"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </WidgetCard>
      </div>

      {wishlist.length > 0 && (
        <WidgetCard title={`${p.display_name.split(" ")[0]}'s wishlist`}>
          <ul className="divide-y divide-[var(--color-border)]">
            {wishlist.map((w) => (
              <li key={w.id} className="flex items-start gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{w.title}</p>
                    {w.url && (
                      <a
                        href={w.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--color-muted)] hover:text-[var(--color-accent)]"
                      >
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                  {w.notes && (
                    <p className="text-xs text-[var(--color-muted)]">
                      {w.notes}
                    </p>
                  )}
                </div>
                {w.price != null && (
                  <span className="text-xs tabular-nums text-[var(--color-muted)]">
                    {w.price.toLocaleString()}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </WidgetCard>
      )}
    </div>
  );
}
