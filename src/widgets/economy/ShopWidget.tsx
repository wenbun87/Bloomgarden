import { useMemo, useState } from "react";
import { Coins, Lock } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import type { PlantSpecies } from "@/hooks/useGarden";
import { cn } from "@/lib/utils";

type Tab = "seeds" | "packs" | "heirlooms" | "plots";

const TABS: { id: Tab; label: string }[] = [
  { id: "seeds", label: "Seeds" },
  { id: "packs", label: "Packs" },
  { id: "heirlooms", label: "Heirlooms" },
  { id: "plots", label: "Plots" },
];

type Props = {
  species: PlantSpecies[];
  coinBalance: number;
  lifetimeCoins: number;
  plotCount: number;
  currentSeason: "spring" | "summer" | "autumn" | "winter";
  onChanged: () => void;
  className?: string;
};

export function ShopWidget({
  species,
  coinBalance,
  lifetimeCoins,
  plotCount,
  currentSeason,
  onChanged,
  className,
}: Props) {
  const [tab, setTab] = useState<Tab>("seeds");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const seasonSeeds = useMemo(
    () =>
      species
        .filter(
          (s) =>
            (s.season === "always" || s.season === currentSeason) &&
            (s.rarity === "common" || s.rarity === "rare"),
        )
        .sort(
          (a, b) =>
            a.seed_cost - b.seed_cost || a.name.localeCompare(b.name),
        ),
    [species, currentSeason],
  );

  const heirlooms = useMemo(
    () =>
      species
        .filter((s) => s.rarity === "heirloom" || s.rarity === "legendary")
        .sort((a, b) => a.seed_cost - b.seed_cost),
    [species],
  );

  async function runRpc(
    fn: "buy_seed" | "buy_mystery_pack" | "buy_plot_expansion",
    args: Record<string, unknown>,
    successMsg: string,
  ) {
    setBusy(true);
    setError(null);
    setFlash(null);
    const { error: rpcErr } = await supabase.rpc(fn, args);
    setBusy(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    setFlash(successMsg);
    onChanged();
    setTimeout(() => setFlash(null), 2500);
  }

  return (
    <WidgetCard
      title="Garden shop"
      className={className}
      action={
        <span className="text-xs capitalize text-[var(--color-muted)]">
          {currentSeason}
        </span>
      }
    >
      <div className="mb-3 flex gap-1 rounded-pill bg-black/5 p-1 text-xs">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setError(null);
            }}
            className={cn(
              "flex-1 rounded-pill px-3 py-1.5 transition",
              tab === t.id
                ? "bg-white shadow-sm"
                : "text-[var(--color-muted)] hover:text-[var(--color-ink)]",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "seeds" && (
        <ul className="grid grid-cols-2 gap-2">
          {seasonSeeds.map((s) => (
            <SpeciesTile
              key={s.id}
              species={s}
              canAfford={coinBalance >= s.seed_cost}
              lifetimeCoins={lifetimeCoins}
              busy={busy}
              onBuy={() =>
                runRpc(
                  "buy_seed",
                  { species_id_in: s.id },
                  `${s.name} added to your bag`,
                )
              }
            />
          ))}
        </ul>
      )}

      {tab === "packs" && (
        <div className="grid gap-2">
          <PackRow
            label="Common pack"
            hint="Random common seed this season"
            cost={20}
            canAfford={coinBalance >= 20}
            busy={busy}
            onBuy={() =>
              runRpc(
                "buy_mystery_pack",
                { tier_in: "common" },
                "Opened common pack",
              )
            }
          />
          <PackRow
            label="Rare pack"
            hint="Random rare seed this season"
            cost={75}
            canAfford={coinBalance >= 75}
            busy={busy}
            onBuy={() =>
              runRpc(
                "buy_mystery_pack",
                { tier_in: "rare" },
                "Opened rare pack",
              )
            }
          />
          <PackRow
            label="Legendary pack"
            hint="A rotating legendary seed"
            cost={250}
            canAfford={coinBalance >= 250}
            busy={busy}
            onBuy={() =>
              runRpc(
                "buy_mystery_pack",
                { tier_in: "legendary" },
                "Opened legendary pack",
              )
            }
          />
        </div>
      )}

      {tab === "heirlooms" && (
        <ul className="grid grid-cols-2 gap-2">
          {heirlooms.map((s) => (
            <SpeciesTile
              key={s.id}
              species={s}
              canAfford={coinBalance >= s.seed_cost}
              lifetimeCoins={lifetimeCoins}
              busy={busy}
              onBuy={() =>
                runRpc(
                  "buy_seed",
                  { species_id_in: s.id },
                  `${s.name} added to your bag`,
                )
              }
            />
          ))}
        </ul>
      )}

      {tab === "plots" && (
        <PlotsTab
          plotCount={plotCount}
          coinBalance={coinBalance}
          busy={busy}
          onBuy={() =>
            runRpc(
              "buy_plot_expansion",
              {},
              `Expanded to ${plotCount + 1} plots`,
            )
          }
        />
      )}

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      {flash && <p className="mt-3 text-xs text-green-700">{flash}</p>}
    </WidgetCard>
  );
}

function SpeciesTile({
  species,
  canAfford,
  lifetimeCoins,
  busy,
  onBuy,
}: {
  species: PlantSpecies;
  canAfford: boolean;
  lifetimeCoins: number;
  busy: boolean;
  onBuy: () => void;
}) {
  const rule = species.unlock_rule_json;
  const unlocked =
    !rule ||
    (rule.type === "lifetime_coins" &&
      lifetimeCoins >= (rule.min ?? Number.POSITIVE_INFINITY));

  return (
    <li className="flex flex-col gap-1 rounded-card border border-[var(--color-border)] bg-white/70 p-2">
      <div className="flex items-start gap-2">
        <span className="text-xl leading-none">{species.sprite_emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">{species.name}</p>
          <p className="truncate text-[10px] capitalize text-[var(--color-muted)]">
            {species.rarity}
            {" · "}
            {species.grow_days}d
            {" · "}
            {species.harvest_type === "keep"
              ? "display"
              : `sell ${species.sell_value}`}
          </p>
        </div>
      </div>
      {unlocked ? (
        <Button
          size="sm"
          variant="soft"
          onClick={onBuy}
          disabled={busy || !canAfford}
          className="mt-auto w-full"
        >
          <Coins size={11} />
          {species.seed_cost}
        </Button>
      ) : (
        <div className="mt-auto flex items-center justify-center gap-1 rounded-pill bg-black/5 px-2 py-1 text-[10px] text-[var(--color-muted)]">
          <Lock size={10} />
          {rule?.min?.toLocaleString()} lifetime
        </div>
      )}
    </li>
  );
}

function PackRow({
  label,
  hint,
  cost,
  canAfford,
  busy,
  onBuy,
}: {
  label: string;
  hint: string;
  cost: number;
  canAfford: boolean;
  busy: boolean;
  onBuy: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-card border border-[var(--color-border)] bg-white/70 p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-[var(--color-muted)]">{hint}</p>
      </div>
      <Button
        size="sm"
        variant="soft"
        onClick={onBuy}
        disabled={busy || !canAfford}
      >
        <Coins size={11} />
        {cost}
      </Button>
    </div>
  );
}

function PlotsTab({
  plotCount,
  coinBalance,
  busy,
  onBuy,
}: {
  plotCount: number;
  coinBalance: number;
  busy: boolean;
  onBuy: () => void;
}) {
  const nextCost = plotCount >= 16 ? null : 50 * 2 ** (plotCount - 4);
  const canAfford = nextCost !== null && coinBalance >= nextCost;

  return (
    <div className="space-y-2 rounded-card border border-[var(--color-border)] bg-white/70 p-4">
      <p className="text-sm font-medium">
        {plotCount} plot{plotCount === 1 ? "" : "s"}
      </p>
      <p className="text-xs text-[var(--color-muted)]">
        {nextCost === null
          ? "You've reached the max garden size."
          : "More plots = more plants growing at once."}
      </p>
      {nextCost !== null && (
        <Button
          size="sm"
          variant="soft"
          onClick={onBuy}
          disabled={busy || !canAfford}
          className="w-full"
        >
          <Coins size={12} />
          {`Expand to ${plotCount + 1} plots — ${nextCost.toLocaleString()}`}
        </Button>
      )}
    </div>
  );
}
