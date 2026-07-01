import { useEffect, useMemo, useState } from "react";
import { Coins, Crown, Droplet, Plus } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/EmptyState";
import { PixelPlant } from "@/components/PixelPlant";
import { plantKindFor } from "@/lib/plantKinds";
import {
  Bush,
  FenceBottom,
  FenceTop,
  GrassTuft,
  Scarecrow,
  Stone,
} from "@/components/FarmSprites";
import { supabase } from "@/lib/supabase";
import type { Planting, UserSeed } from "@/hooks/useGarden";
import { cn } from "@/lib/utils";

type Props = {
  plotCount: number;
  plantingsByPlot: Map<number, Planting>;
  seeds: UserSeed[];
  onChanged: () => void;
};

const decorations: Array<{ x: string; y: string; kind: "tuft" | "stone" }> = [
  { x: "5%", y: "10%", kind: "tuft" },
  { x: "92%", y: "20%", kind: "stone" },
  { x: "3%", y: "70%", kind: "tuft" },
  { x: "94%", y: "55%", kind: "tuft" },
  { x: "30%", y: "92%", kind: "stone" },
  { x: "10%", y: "44%", kind: "stone" },
  { x: "78%", y: "85%", kind: "tuft" },
];

export function FarmScene({
  plotCount,
  plantingsByPlot,
  seeds,
  onChanged,
}: Props) {
  const [plantingPlot, setPlantingPlot] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const plots = useMemo(
    () => Array.from({ length: plotCount }, (_, i) => i),
    [plotCount],
  );

  const ripeCount = useMemo(() => {
    let n = 0;
    for (const p of plantingsByPlot.values()) {
      if (
        p.status === "growing" &&
        new Date(p.harvests_at).getTime() <= now
      ) {
        n++;
      }
    }
    return n;
  }, [plantingsByPlot, now]);

  async function plant(seed: UserSeed) {
    if (plantingPlot === null) return;
    setBusy(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("plant_seed", {
      seed_id_in: seed.id,
      plot_index_in: plantingPlot,
    });
    setBusy(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    setPlantingPlot(null);
    onChanged();
  }

  async function fertilize(planting: Planting) {
    setBusy(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("apply_fertilizer", {
      planting_id_in: planting.id,
    });
    setBusy(false);
    if (rpcErr) setError(rpcErr.message);
    onChanged();
  }

  async function harvest(planting: Planting, action: "keep" | "sell") {
    setBusy(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("harvest_planting", {
      planting_id_in: planting.id,
      action_in: action,
    });
    setBusy(false);
    if (rpcErr) setError(rpcErr.message);
    onChanged();
  }

  const sandyGround = `
    radial-gradient(circle at 12% 22%, rgba(255,255,255,0.08) 1px, transparent 2px),
    radial-gradient(circle at 38% 78%, rgba(0,0,0,0.06) 1px, transparent 2px),
    radial-gradient(circle at 62% 33%, rgba(255,255,255,0.06) 1px, transparent 2px),
    radial-gradient(circle at 84% 64%, rgba(0,0,0,0.07) 1px, transparent 2px),
    radial-gradient(circle at 22% 88%, rgba(255,255,255,0.07) 1px, transparent 2px),
    radial-gradient(ellipse at 50% 40%, rgba(255,236,180,0.18), transparent 70%),
    linear-gradient(180deg, #d9b574 0%, #c8a05c 100%)
  `;

  return (
    <section
      className="relative overflow-hidden rounded-[16px]"
      style={{
        border: "2px solid #8a6134",
        boxShadow:
          "0 4px 24px rgba(60,40,20,0.12), inset 0 0 0 1px rgba(255,255,255,0.2)",
        background: sandyGround,
      }}
    >
      <FenceTop />

      <div className="relative px-4 pb-10 pt-6 sm:px-10 sm:pt-10">
        {/* Decoration scatter */}
        {decorations.map((dec, i) => (
          <div
            key={i}
            aria-hidden
            className="pointer-events-none absolute"
            style={{ left: dec.x, top: dec.y }}
          >
            {dec.kind === "tuft" ? <GrassTuft /> : <Stone />}
          </div>
        ))}

        {/* Scarecrow centered between rows on desktop */}
        <div
          aria-hidden
          className="pointer-events-none absolute hidden lg:block"
          style={{
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <Scarecrow />
        </div>

        {/* Bushes corner-left on desktop */}
        <div
          aria-hidden
          className="pointer-events-none absolute hidden lg:block"
          style={{ bottom: 4, left: -10 }}
        >
          <Bush />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute hidden lg:block"
          style={{ bottom: 38, left: -22 }}
        >
          <Bush small />
        </div>

        {/* Plot grid */}
        <div
          className="relative mx-auto grid gap-x-5 gap-y-7 sm:gap-x-9"
          style={{
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            maxWidth: 920,
          }}
        >
          {/* Switch to 4 cols on lg via media query approach */}
          <style>{`
            @media (min-width: 1024px) {
              .farm-plot-grid {
                grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
              }
            }
          `}</style>
          <div
            className="farm-plot-grid relative col-span-2 grid gap-x-5 gap-y-7 sm:gap-x-9"
            style={{
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            }}
          >
            {plots.map((i) => {
              const planting = plantingsByPlot.get(i);
              return (
                <Plot
                  key={i}
                  index={i}
                  planting={planting}
                  now={now}
                  onPlant={() => {
                    setError(null);
                    setPlantingPlot(i);
                  }}
                  onFertilize={() => planting && fertilize(planting)}
                  onHarvest={(a) => planting && harvest(planting, a)}
                  busy={busy}
                />
              );
            })}
          </div>
        </div>
      </div>

      <FenceBottom />

      {/* Scene footer — paper strip with quick stats */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-2.5 text-xs"
      >
        <div className="flex flex-wrap items-center gap-3 text-[var(--color-ink)]">
          <span>
            <b
              style={{
                color:
                  ripeCount > 0
                    ? "var(--color-grass-deep)"
                    : "var(--color-muted)",
              }}
            >
              {ripeCount} ripe
            </b>
            {ripeCount > 0 ? " · pick for coins" : ""}
          </span>
          <span className="text-[var(--color-muted)]">
            {plantingsByPlot.size}/{plotCount} plots planted
          </span>
        </div>
      </div>

      {error && (
        <p className="border-t border-[var(--color-line)] bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <Dialog
        open={plantingPlot !== null}
        onClose={() => setPlantingPlot(null)}
        title={`Plant something — plot ${
          plantingPlot !== null ? plantingPlot + 1 : ""
        }`}
      >
        {seeds.length === 0 ? (
          <EmptyState
            title="Your bag is empty"
            hint="Buy seeds from the shop first."
          />
        ) : (
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {seeds.map((seed) => (
              <li key={seed.id}>
                <button
                  onClick={() => plant(seed)}
                  disabled={busy}
                  className="flex w-full items-center gap-3 rounded-card border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-left hover:bg-[var(--color-cream)] disabled:opacity-50"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white">
                    <PixelPlant
                      kind={plantKindFor(seed.species.slug)}
                      size={28}
                      resolution={4}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {seed.species.name}
                      {seed.gifted_by && (
                        <span className="ml-2 text-xs text-[var(--color-accent)]">
                          gifted
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[var(--color-muted)]">
                      {seed.species.grow_days} days ·{" "}
                      {seed.species.harvest_type === "keep"
                        ? "display forever"
                        : `sells for ${seed.species.sell_value}`}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
    </section>
  );
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "ready";
  const totalMinutes = Math.floor(ms / 60_000);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;
  if (days >= 1) return `${days}d ${hours}h`;
  if (hours >= 1) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function Plot({
  index,
  planting,
  now,
  onPlant,
  onFertilize,
  onHarvest,
  busy,
}: {
  index: number;
  planting: Planting | undefined;
  now: number;
  onPlant: () => void;
  onFertilize: () => void;
  onHarvest: (action: "keep" | "sell") => void;
  busy: boolean;
}) {
  const tilled = `
    repeating-linear-gradient(0deg,
      #6a4420 0px, #6a4420 2px,
      #5a3818 2px, #5a3818 4px,
      #6a4420 4px, #6a4420 22px,
      #4d2f12 22px, #4d2f12 24px
    )
  `;

  // Empty plot
  if (!planting) {
    return (
      <button
        onClick={onPlant}
        aria-label={`Plant in plot ${index + 1}`}
        className="group relative flex items-center justify-center rounded-[4px] text-white/60 transition hover:text-white/90"
        style={{
          width: "100%",
          aspectRatio: "156 / 116",
          background: tilled,
          boxShadow:
            "inset 0 0 0 1px rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.2)",
        }}
      >
        <Plus size={22} strokeWidth={1.5} />
      </button>
    );
  }

  const harvestMs = new Date(planting.harvests_at).getTime();
  const ready = planting.status === "growing" && harvestMs <= now;
  const kept = planting.status === "kept";
  const remainingLabel = formatCountdown(harvestMs - now);

  const kind = plantKindFor(planting.species.slug);
  const stage = ready || kept ? "ready" : "growing";

  // 9 plant slots, slight stagger for organic feel
  const slots = Array.from({ length: 9 }, (_, i) => i);

  return (
    <div className="relative">
      {/* Plot label above */}
      <div
        className="absolute left-0 right-0 text-center text-[10px] font-bold uppercase tracking-wider"
        style={{
          top: -16,
          color: "#5a3818",
          textShadow: "0 1px 0 rgba(255,236,180,0.8)",
        }}
      >
        {planting.species.name}
        {kept && " 👑"}
      </div>

      <div
        className="relative rounded-[4px] p-2.5"
        style={{
          width: "100%",
          aspectRatio: "156 / 116",
          background: tilled,
          boxShadow: ready
            ? "inset 0 0 0 1px rgba(0,0,0,0.3), 0 0 0 2px var(--color-sun), 0 0 14px rgba(244,193,82,0.5)"
            : "inset 0 0 0 1px rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.2)",
        }}
      >
        {/* Growing timer in corner */}
        {!ready && !kept && (
          <div
            className="absolute z-10 rounded-pill px-1.5 py-px text-[9px] font-semibold tabular-nums"
            style={{
              top: 4,
              right: 4,
              color: "rgba(255,255,255,0.95)",
              background: "rgba(0,0,0,0.5)",
            }}
          >
            {remainingLabel}
          </div>
        )}

        {/* Kept crown */}
        {kept && (
          <Crown
            size={14}
            className="absolute z-10 text-amber-300"
            style={{ top: 4, right: 4, filter: "drop-shadow(0 1px 0 #634a1a)" }}
          />
        )}

        {/* Mini-grid of 9 plant sprites */}
        <div
          className="grid h-full w-full"
          style={{
            gridTemplateColumns: "repeat(3, 1fr)",
            gridTemplateRows: "repeat(3, 1fr)",
          }}
        >
          {slots.map((i) => (
            <div
              key={i}
              className="flex items-center justify-center"
              style={{ transform: `translateY(${(i % 2) * -1}px)` }}
            >
              <PixelPlant kind={kind} size={26} resolution={4} stage={stage} />
            </div>
          ))}
        </div>

        {/* Fertilize hint button (only while growing, with remaining boosts) */}
        {!ready && !kept && planting.fertilizer_days < 3 && (
          <button
            onClick={onFertilize}
            disabled={busy}
            aria-label="Fertilize"
            title="Fertilize (15 coins, −1 day)"
            className="absolute z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white/85 text-[var(--color-accent)] transition hover:bg-white disabled:opacity-50"
            style={{ bottom: 4, right: 4 }}
          >
            <Droplet size={10} />
          </button>
        )}
      </div>

      {/* Harvest buttons or RIPE badge floating below plot */}
      {ready && (
        <div
          className="absolute left-1/2 -translate-x-1/2 flex gap-1"
          style={{ bottom: -14 }}
        >
          {planting.species.harvest_type === "crop" && (
            <button
              onClick={() => onHarvest("sell")}
              disabled={busy}
              title={`Sell for ${planting.species.sell_value}`}
              className={cn(
                "flex items-center gap-0.5 rounded-pill px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#634a1a] transition disabled:opacity-50",
              )}
              style={{
                background: "var(--color-sun)",
                boxShadow:
                  "inset 0 -2px 0 rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.3)",
              }}
            >
              <Coins size={10} />
              {planting.species.sell_value}
            </button>
          )}
          <button
            onClick={() => onHarvest("keep")}
            disabled={busy}
            className="rounded-pill border border-[var(--color-line)] bg-white px-2 py-1 text-[10px] font-semibold disabled:opacity-50"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}
          >
            Keep
          </button>
        </div>
      )}
    </div>
  );
}
