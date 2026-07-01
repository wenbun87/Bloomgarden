import { useMemo } from "react";
import { WidgetCard } from "@/components/WidgetCard";
import { EmptyState } from "@/components/EmptyState";
import { PixelPlant } from "@/components/PixelPlant";
import { plantKindFor } from "@/lib/plantKinds";
import type { UserSeed } from "@/hooks/useGarden";

type Props = {
  seeds: UserSeed[];
};

type Stack = {
  speciesId: string;
  name: string;
  slug: string;
  count: number;
  rarity: UserSeed["species"]["rarity"];
  growDays: number;
  harvestType: UserSeed["species"]["harvest_type"];
  sellValue: number;
};

export function SeedBag({ seeds }: Props) {
  const stacks: Stack[] = useMemo(() => {
    const byId = new Map<string, Stack>();
    for (const s of seeds) {
      const existing = byId.get(s.species_id);
      if (existing) {
        existing.count += 1;
      } else {
        byId.set(s.species_id, {
          speciesId: s.species_id,
          name: s.species.name,
          slug: s.species.slug,
          count: 1,
          rarity: s.species.rarity,
          growDays: s.species.grow_days,
          harvestType: s.species.harvest_type,
          sellValue: s.species.sell_value,
        });
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [seeds]);

  return (
    <WidgetCard
      title="Your seed bag"
      subtitle={`${seeds.length} seed${seeds.length === 1 ? "" : "s"} ready to plant`}
    >
      {stacks.length === 0 ? (
        <EmptyState
          title="Bag is empty"
          hint="Buy seeds from the shop, or wait for friends to gift you."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {stacks.map((s) => (
            <li
              key={s.speciesId}
              className="relative flex items-center gap-2.5 rounded-card border border-[var(--color-line)] bg-[var(--color-cream)] p-2.5"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white">
                <PixelPlant
                  kind={plantKindFor(s.slug)}
                  size={32}
                  resolution={4}
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold">{s.name}</p>
                <p className="text-[10px] text-[var(--color-muted)]">
                  {s.growDays}d ·{" "}
                  {s.harvestType === "keep"
                    ? "display"
                    : `sells ${s.sellValue}`}
                </p>
              </div>
              {s.count > 1 && (
                <span
                  className="absolute right-1.5 top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--color-grass-deep)] px-1 text-[10px] font-bold text-white tabular-nums"
                  style={{ boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.18)" }}
                >
                  ×{s.count}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}
