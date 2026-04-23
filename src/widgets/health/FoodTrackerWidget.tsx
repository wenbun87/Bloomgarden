import { Flame, Trash2 } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/lib/supabase";
import type { FoodEntry } from "@/hooks/useFoodEntries";
import { cn } from "@/lib/utils";

type Props = {
  entries: FoodEntry[];
  onChanged: () => void;
  className?: string;
};

function scoreColor(grade: string | null): string {
  if (!grade) return "bg-black/10 text-[var(--color-muted)]";
  switch (grade.toLowerCase()) {
    case "a":
      return "bg-green-100 text-green-700";
    case "b":
      return "bg-lime-100 text-lime-700";
    case "c":
      return "bg-amber-100 text-amber-700";
    case "d":
      return "bg-orange-100 text-orange-700";
    case "e":
      return "bg-red-100 text-red-700";
    default:
      return "bg-black/10 text-[var(--color-muted)]";
  }
}

function novaColor(n: number | null): string {
  if (!n) return "bg-black/10 text-[var(--color-muted)]";
  if (n <= 1) return "bg-green-100 text-green-700";
  if (n === 2) return "bg-lime-100 text-lime-700";
  if (n === 3) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700"; // 4 = ultra-processed
}

export function FoodTrackerWidget({ entries, onChanged, className }: Props) {
  const totals = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein_g,
      carbs: acc.carbs + e.carbs_g,
      fat: acc.fat + e.fat_g,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  async function remove(id: string) {
    const { error } = await supabase.from("food_entries").delete().eq("id", id);
    if (!error) onChanged();
  }

  return (
    <WidgetCard
      title="Today's food"
      className={className}
      action={
        <span className="flex items-center gap-1 text-xs tabular-nums text-[var(--color-muted)]">
          <Flame size={12} />
          {Math.round(totals.calories)} kcal
        </span>
      }
    >
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <MacroCell label="Protein" value={totals.protein} unit="g" />
        <MacroCell label="Carbs" value={totals.carbs} unit="g" />
        <MacroCell label="Fat" value={totals.fat} unit="g" />
      </div>

      {entries.length === 0 ? (
        <EmptyState
          title="Nothing logged yet today"
          hint="Search for a food on the right to add it."
        />
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {entries.map((e) => (
            <li key={e.id} className="group flex items-start gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{e.name}</p>
                <p className="truncate text-[10px] text-[var(--color-muted)]">
                  {e.brand ? `${e.brand} · ` : ""}
                  {Math.round(e.grams)}g · {Math.round(e.calories)} kcal
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {e.nutriscore && (
                    <Score label="Nutri" value={e.nutriscore} color={scoreColor(e.nutriscore)} />
                  )}
                  {e.nova_group != null && (
                    <Score
                      label="NOVA"
                      value={String(e.nova_group)}
                      color={novaColor(e.nova_group)}
                    />
                  )}
                  {e.ecoscore && (
                    <Score label="Eco" value={e.ecoscore} color={scoreColor(e.ecoscore)} />
                  )}
                </div>
              </div>
              <button
                onClick={() => remove(e.id)}
                aria-label="Remove"
                className="opacity-0 transition group-hover:opacity-100 text-[var(--color-muted)] hover:text-red-600"
              >
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

function MacroCell({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <div className="rounded-card border border-[var(--color-border)] bg-white/60 py-2">
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </p>
      <p className="tabular-nums text-sm font-semibold">
        {Math.round(value)}
        <span className="ml-0.5 text-[10px] font-normal text-[var(--color-muted)]">
          {unit}
        </span>
      </p>
    </div>
  );
}

function Score({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill px-1.5 py-0.5 text-[9px] font-medium uppercase",
        color,
      )}
    >
      {label} {value}
    </span>
  );
}
