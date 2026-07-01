import { useState } from "react";
import { Crown, Trash2 } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { EmptyState } from "@/components/EmptyState";
import { PixelPlant } from "@/components/PixelPlant";
import { plantKindFor } from "@/lib/plantKinds";
import { supabase } from "@/lib/supabase";
import type { Planting } from "@/hooks/useGarden";

type Props = {
  displayed: Planting[];
  onChanged: () => void;
};

export function DisplayWall({ displayed, onChanged }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(planting: Planting) {
    if (
      !confirm(`Remove "${planting.species.name}" from your collection?`)
    ) {
      return;
    }
    setBusy(planting.id);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("remove_from_display", {
      planting_id_in: planting.id,
    });
    setBusy(null);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    onChanged();
  }

  return (
    <WidgetCard
      title="Display collection"
      subtitle={`${displayed.length} kept plant${displayed.length === 1 ? "" : "s"} on display`}
    >
      {displayed.length === 0 ? (
        <EmptyState
          title="No display plants yet"
          hint="Harvest a keep-forever plant and choose Keep — it'll live here, not in a plot."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {displayed.map((p) => (
            <li
              key={p.id}
              className="group relative flex flex-col items-center gap-1 rounded-card border border-[var(--color-line)] bg-[var(--color-cream)] p-3"
              style={{ boxShadow: "inset 0 -2px 0 rgba(60,40,20,0.05)" }}
            >
              <Crown
                size={11}
                className="absolute left-1.5 top-1.5 text-amber-500"
                style={{ filter: "drop-shadow(0 1px 0 rgba(0,0,0,0.15))" }}
              />
              <button
                type="button"
                onClick={() => remove(p)}
                disabled={busy === p.id}
                aria-label="Remove from collection"
                className="absolute right-1.5 top-1.5 hidden h-5 w-5 items-center justify-center rounded-pill text-[var(--color-muted)] transition group-hover:flex hover:bg-white hover:text-red-600"
              >
                <Trash2 size={11} />
              </button>
              <span className="flex h-14 w-14 items-center justify-center rounded-md bg-white">
                <PixelPlant
                  kind={plantKindFor(p.species.slug)}
                  size={48}
                  resolution={4}
                />
              </span>
              <p className="mt-1 text-center text-[11px] font-bold leading-tight">
                {p.species.name}
              </p>
              {p.harvested_at && (
                <p className="text-[9px] text-[var(--color-muted)]">
                  kept {prettyDate(p.harvested_at)}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </WidgetCard>
  );
}

function prettyDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
