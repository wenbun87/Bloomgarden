import { useState } from "react";
import { AlertTriangle, Info, Plus, Search } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";
import {
  flagIngredients,
  macrosPer100g,
  searchProducts,
  servingGrams,
  type OffProduct,
} from "@/lib/openFoodFacts";
import { cn } from "@/lib/utils";

type Props = {
  userId: string;
  onChanged: () => void;
  className?: string;
};

function scoreColor(grade: string | null | undefined): string {
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

function novaColor(n: number | null | undefined): string {
  if (!n) return "bg-black/10 text-[var(--color-muted)]";
  if (n <= 1) return "bg-green-100 text-green-700";
  if (n === 2) return "bg-lime-100 text-lime-700";
  if (n === 3) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

export function FoodSearchWidget({ userId, onChanged, className }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OffProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [grams, setGrams] = useState<Record<string, string>>({});
  const [legendOpen, setLegendOpen] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const hits = await searchProducts(query);
      setResults(hits);
      if (hits.length === 0)
        setError(`No matches for "${query}". Try fewer keywords.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        msg.includes("fetch")
          ? "Couldn't reach Open Food Facts — check connection or try fewer keywords."
          : msg,
      );
    } finally {
      setSearching(false);
    }
  }

  async function add(product: OffProduct) {
    const defaultG = servingGrams(product) ?? 100;
    const g = parseFloat(grams[product.code] ?? String(defaultG));
    if (!Number.isFinite(g) || g <= 0) return;
    setAdding(product.code);
    setError(null);
    const m = macrosPer100g(product);
    const factor = g / 100;
    const { error: insErr } = await supabase.from("food_entries").insert({
      user_id: userId,
      name: product.product_name,
      brand: product.brands || null,
      barcode: product.code || null,
      grams: g,
      calories: m.calories * factor,
      protein_g: m.protein_g * factor,
      carbs_g: m.carbs_g * factor,
      fat_g: m.fat_g * factor,
      nutriscore: product.nutriscore_grade ?? null,
      nova_group: product.nova_group ?? null,
      ecoscore: product.ecoscore_grade ?? null,
    });
    setAdding(null);
    if (insErr) return setError(insErr.message);
    onChanged();
  }

  return (
    <WidgetCard title="Food search" className={className}>
      <form onSubmit={search} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. oat milk, peanut butter, protein bar…"
          className="flex-1"
        />
        <Button type="submit" disabled={searching || !query.trim()}>
          <Search size={12} />
          {searching ? "…" : "Search"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => setLegendOpen((v) => !v)}
        className="mt-2 flex items-center gap-1 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        <Info size={10} />
        {legendOpen ? "Hide" : "What do Nutri / NOVA / Eco mean?"}
      </button>
      {legendOpen && (
        <div className="mt-2 space-y-1.5 rounded-card border border-[var(--color-border)] bg-white/60 p-3 text-[11px] text-[var(--color-muted)]">
          <p>
            <span className="font-medium text-[var(--color-ink)]">Nutri-Score</span>{" "}
            — overall nutrition grade. <b>A</b> (best) → <b>E</b> (worst).
            Rewards fibre / protein / fruits; penalises sugar, saturated fat,
            sodium, calories.
          </p>
          <p>
            <span className="font-medium text-[var(--color-ink)]">NOVA</span>{" "}
            — processing level. <b>1</b> unprocessed → <b>4</b> ultra-processed.
            NOVA 4 is the category to watch.
          </p>
          <p>
            <span className="font-medium text-[var(--color-ink)]">Eco-Score</span>{" "}
            — environmental impact across lifecycle. <b>A</b> (lowest impact) →
            <b> E</b> (highest).
          </p>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {results.length > 0 && (
        <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
          {results.map((p) => {
            const flags = flagIngredients(p.ingredients_text);
            const m = macrosPer100g(p);
            return (
              <li
                key={p.code}
                className="rounded-card border border-[var(--color-border)] bg-white/60 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {p.product_name}
                  </p>
                  {p.brands && (
                    <p className="truncate text-[10px] text-[var(--color-muted)]">
                      {p.brands}
                    </p>
                  )}
                  <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">
                    per 100g · {Math.round(m.calories)} kcal · P{Math.round(m.protein_g)} / C{Math.round(m.carbs_g)} / F{Math.round(m.fat_g)}
                  </p>
                </div>

                <div className="mt-2 flex flex-wrap gap-1">
                  {p.nutriscore_grade && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-pill px-1.5 py-0.5 text-[9px] font-medium uppercase",
                        scoreColor(p.nutriscore_grade),
                      )}
                    >
                      Nutri {p.nutriscore_grade}
                    </span>
                  )}
                  {p.nova_group != null && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-pill px-1.5 py-0.5 text-[9px] font-medium uppercase",
                        novaColor(p.nova_group),
                      )}
                      title={
                        p.nova_group === 4
                          ? "Ultra-processed"
                          : p.nova_group === 3
                            ? "Processed"
                            : p.nova_group === 2
                              ? "Processed culinary ingredient"
                              : "Unprocessed / minimally processed"
                      }
                    >
                      NOVA {p.nova_group}
                      {p.nova_group === 4 && " · ultra-processed"}
                    </span>
                  )}
                  {p.ecoscore_grade && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-pill px-1.5 py-0.5 text-[9px] font-medium uppercase",
                        scoreColor(p.ecoscore_grade),
                      )}
                    >
                      Eco {p.ecoscore_grade}
                    </span>
                  )}
                </div>

                {flags.length > 0 && (
                  <div className="mt-2 rounded-card border border-red-200/60 bg-red-50/70 p-2">
                    <p className="flex items-center gap-1 text-[10px] font-medium text-red-700">
                      <AlertTriangle size={10} />
                      Flagged ingredients
                    </p>
                    <ul className="mt-1 space-y-0.5 text-[10px] text-red-700/80">
                      {flags.slice(0, 5).map((f) => (
                        <li key={f.label}>
                          <span className="font-medium">{f.label}</span> —{" "}
                          {f.why}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {p.packaging_materials_tags &&
                  p.packaging_materials_tags.length > 0 && (
                    <p className="mt-2 truncate text-[10px] text-[var(--color-muted)]">
                      Packaging:{" "}
                      {p.packaging_materials_tags
                        .map((t) => t.replace(/^en:/, "").replace(/-/g, " "))
                        .slice(0, 4)
                        .join(", ")}
                    </p>
                  )}

                <AddRow
                  servingG={servingGrams(p)}
                  servingLabel={p.serving_size}
                  gramsValue={
                    grams[p.code] ?? String(servingGrams(p) ?? 100)
                  }
                  onGramsChange={(v) =>
                    setGrams((g) => ({ ...g, [p.code]: v }))
                  }
                  previewKcal={
                    m.calories *
                    ((parseFloat(
                      grams[p.code] ?? String(servingGrams(p) ?? 100),
                    ) || 0) /
                      100)
                  }
                  onAdd={() => add(p)}
                  busy={adding === p.code}
                />
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}

function AddRow({
  servingG,
  servingLabel,
  gramsValue,
  onGramsChange,
  previewKcal,
  onAdd,
  busy,
}: {
  servingG: number | null;
  servingLabel: string | undefined;
  gramsValue: string;
  onGramsChange: (v: string) => void;
  previewKcal: number;
  onAdd: () => void;
  busy: boolean;
}) {
  // Consistent preset pills across all products. Serving size info (when OFF
  // knows it) is shown above as a reference — user can type it manually.
  const presets = [
    { label: "50g", grams: 50 },
    { label: "100g", grams: 100 },
    { label: "200g", grams: 200 },
  ];

  return (
    <div className="mt-2 space-y-1">
      {servingG && servingLabel && (
        <p className="text-[10px] text-[var(--color-muted)]">
          1 serving = {servingLabel}
        </p>
      )}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-pill border border-[var(--color-border)] bg-white px-2 py-1">
          <input
            type="number"
            min={1}
            max={5000}
            value={gramsValue}
            onChange={(e) => onGramsChange(e.target.value)}
            className="w-12 bg-transparent text-right text-xs tabular-nums outline-none"
          />
          <span className="text-[10px] text-[var(--color-muted)]">g</span>
        </div>
        <div className="flex gap-1 text-[10px]">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onGramsChange(String(p.grams))}
              className="rounded-pill bg-black/5 px-2 py-0.5 text-[var(--color-muted)] hover:bg-black/10"
            >
              {p.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[10px] tabular-nums text-[var(--color-muted)]">
          {Math.round(previewKcal)} kcal
        </span>
        <Button size="sm" variant="soft" onClick={onAdd} disabled={busy}>
          <Plus size={11} />
          {busy ? "…" : "Add"}
        </Button>
      </div>
    </div>
  );
}
