import { useEffect, useMemo, useState } from "react";
import { Coins, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PixelPlant } from "@/components/PixelPlant";
import { plantKindFor } from "@/lib/plantKinds";
import { supabase } from "@/lib/supabase";
import { useFriends } from "@/hooks/useFriends";
import { useGarden } from "@/hooks/useGarden";
import { currentUtcSeason } from "@/lib/dates";
import { cn } from "@/lib/utils";

// Inline form for composing a message (optional note + optional seed gift).
// Dropped the modal Dialog wrapper — consumers (Mailbox, Profile) render this
// directly inside their own container and control show/hide.
type Props = {
  userId: string;
  coinBalance: number;
  lifetimeCoins: number;
  initialFriendId?: string;
  onSent: () => void;
  onCancel: () => void;
};

export function SendMessageDialog({
  userId,
  coinBalance,
  lifetimeCoins,
  initialFriendId,
  onSent,
  onCancel,
}: Props) {
  const { accepted } = useFriends(userId);
  const { species } = useGarden(userId);

  const [recipient, setRecipient] = useState<string>(initialFriendId ?? "");
  const [body, setBody] = useState("");
  const [speciesId, setSpeciesId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialFriendId) setRecipient(initialFriendId);
  }, [initialFriendId]);

  const season = currentUtcSeason();
  const giftable = useMemo(
    () =>
      species
        .filter(
          (s) =>
            (s.season === "always" || s.season === season) &&
            s.seed_cost * 2 <= coinBalance &&
            (!s.unlock_rule_json ||
              (s.unlock_rule_json.type === "lifetime_coins" &&
                lifetimeCoins >= (s.unlock_rule_json.min ?? Infinity))),
        )
        .sort((a, b) => a.seed_cost - b.seed_cost)
        .slice(0, 12),
    [species, season, coinBalance, lifetimeCoins],
  );

  const selectedSeed = giftable.find((s) => s.id === speciesId);
  const giftCost = selectedSeed ? selectedSeed.seed_cost * 2 : 0;
  const canSend =
    !!recipient && (body.trim().length > 0 || !!speciesId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setBusy(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("send_message", {
      recipient_in: recipient,
      body_in: body.trim() || null,
      species_in: speciesId || null,
    });
    setBusy(false);
    if (rpcErr) return setError(rpcErr.message);
    onSent();
  }

  return (
    <form
      onSubmit={submit}
      className="mb-3 space-y-3 rounded-card border border-[var(--color-border)] bg-white/60 p-3"
    >
      {!initialFriendId && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
            To
          </span>
          <select
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="h-8 w-full rounded-pill border border-[var(--color-border)] bg-white/80 px-3 text-xs"
            required
          >
            <option value="">Pick a friend…</option>
            {accepted.map((f) => (
              <option key={f.profile.id} value={f.profile.id}>
                {f.profile.display_name} (@{f.profile.username})
              </option>
            ))}
          </select>
        </label>
      )}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder="A little something from your garden to theirs."
        className="w-full rounded-card border border-[var(--color-border)] bg-white/80 p-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
      />

      <div>
        <p className="mb-1 text-xs font-medium text-[var(--color-muted)]">
          Send a seed (optional)
        </p>
        <p className="mb-2 text-[10px] text-[var(--color-muted)]">
          Gifts cost 2× the seed price. Goes straight to their bag.
        </p>
        {giftable.length === 0 ? (
          <p className="text-xs text-[var(--color-muted)]">
            No in-season seeds you can afford to gift right now.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {giftable.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() =>
                  setSpeciesId((cur) => (cur === s.id ? "" : s.id))
                }
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-card border p-2 text-center text-[10px] transition",
                  speciesId === s.id
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                    : "border-[var(--color-border)] bg-white/70 hover:border-[var(--color-accent)]",
                )}
              >
                <PixelPlant kind={plantKindFor(s.slug)} size={24} resolution={4} />
                <span className="truncate">{s.name}</span>
                <span className="flex items-center gap-0.5 text-[9px] text-[var(--color-muted)]">
                  <Coins size={8} />
                  {s.seed_cost * 2}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          Cancel
        </button>
        <div className="flex items-center gap-2">
          {giftCost > 0 && (
            <span className="text-xs text-[var(--color-muted)]">
              {giftCost} coins
            </span>
          )}
          <Button type="submit" size="sm" disabled={busy || !canSend}>
            <Send size={11} />
            {busy ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </form>
  );
}
