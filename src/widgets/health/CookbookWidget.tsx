import { useState } from "react";
import {
  Book,
  Clock,
  Flame,
  Pencil,
  Plus,
  Trash2,
  Utensils,
} from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import type { Recipe, RecipeIngredient } from "@/hooks/useRecipes";
import { cn } from "@/lib/utils";

const FIELD =
  "h-8 w-full rounded-pill border border-[var(--color-border)] bg-white/80 px-3 text-xs text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30";

type Props = {
  userId: string;
  recipes: Recipe[];
  onChanged: () => void;
  onLogged: () => void;
  className?: string;
};

export function CookbookWidget({
  userId,
  recipes,
  onChanged,
  onLogged,
  className,
}: Props) {
  const [editing, setEditing] = useState<Recipe | "new" | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [servingsInput, setServingsInput] = useState<Record<string, string>>(
    {},
  );

  async function logToFood(r: Recipe) {
    const n =
      parseFloat(servingsInput[r.id] ?? "1") || 1;
    setLoggingId(r.id);
    setError(null);
    const { error: insErr } = await supabase.from("food_entries").insert({
      user_id: userId,
      name: r.title,
      brand: "Recipe",
      grams: 100,  // placeholder; food_entries requires grams > 0
      calories: r.calories * n,
      protein_g: r.protein_g * n,
      carbs_g: r.carbs_g * n,
      fat_g: r.fat_g * n,
    });
    setLoggingId(null);
    if (insErr) return setError(insErr.message);
    onLogged();
  }

  async function remove(r: Recipe) {
    if (!confirm(`Delete "${r.title}"?`)) return;
    await supabase.from("recipes").delete().eq("id", r.id);
    onChanged();
  }

  return (
    <WidgetCard
      title="Cookbook"
      className={className}
      action={
        <button
          onClick={() => setEditing((cur) => (cur === "new" ? null : "new"))}
          className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:brightness-90"
        >
          <Plus size={12} />
          {editing === "new" ? "Close" : "Add"}
        </button>
      }
    >
      {editing === "new" && (
        <RecipeForm
          userId={userId}
          recipe={null}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}

      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

      {recipes.length === 0 && !editing ? (
        <EmptyState
          title="Cookbook's empty"
          hint="Save AI suggestions or add your own."
          action={
            <Button size="sm" variant="soft" onClick={() => setEditing("new")}>
              <Plus size={11} />
              Add recipe
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {recipes.map((r) => {
            const isEditing =
              editing !== null && editing !== "new" && editing.id === r.id;
            const expanded = expandedId === r.id;
            return (
              <li key={r.id}>
                <div className="group py-2">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : r.id)}
                    className="block w-full text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {r.title}
                      </span>
                      {r.source === "ai" && (
                        <span className="rounded-pill bg-[var(--color-accent-soft)] px-1.5 py-0.5 text-[9px] uppercase text-[var(--color-accent)]">
                          AI
                        </span>
                      )}
                    </div>
                    {r.description && (
                      <p className="truncate text-xs text-[var(--color-muted)]">
                        {r.description}
                      </p>
                    )}
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-[var(--color-muted)]">
                      {r.minutes != null && (
                        <span className="flex items-center gap-0.5">
                          <Clock size={10} />
                          {r.minutes} min
                        </span>
                      )}
                      <span className="flex items-center gap-0.5">
                        <Flame size={10} />
                        {Math.round(r.calories)} kcal/serving
                      </span>
                      <span>
                        P{Math.round(r.protein_g)} · C{Math.round(r.carbs_g)} · F
                        {Math.round(r.fat_g)}
                      </span>
                    </div>
                  </button>

                  {expanded && !isEditing && (
                    <div className="mt-2 space-y-3 text-xs">
                      {r.ingredients_json.length > 0 && (
                        <div>
                          <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                            Ingredients
                          </p>
                          <ul className="space-y-0.5">
                            {r.ingredients_json.map((ing, j) => (
                              <li key={j}>
                                <span className="text-[var(--color-ink)]">
                                  {ing.amount}
                                </span>{" "}
                                <span className="text-[var(--color-muted)]">
                                  {ing.name}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {r.steps_json.length > 0 && (
                        <div>
                          <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                            Steps
                          </p>
                          <ol className="list-decimal space-y-1 pl-4">
                            {r.steps_json.map((s, j) => (
                              <li key={j}>{s}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {r.health_notes && (
                        <p className="italic text-[var(--color-muted)]">
                          {r.health_notes}
                        </p>
                      )}

                      <div className="flex items-center gap-2 rounded-card border border-[var(--color-border)] bg-white p-2">
                        <span className="text-[10px] text-[var(--color-muted)]">
                          Log
                        </span>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={servingsInput[r.id] ?? "1"}
                          onChange={(e) =>
                            setServingsInput((s) => ({
                              ...s,
                              [r.id]: e.target.value,
                            }))
                          }
                          className="w-12 rounded-pill border border-[var(--color-border)] bg-white px-2 py-0.5 text-right text-xs tabular-nums outline-none"
                        />
                        <span className="text-[10px] text-[var(--color-muted)]">
                          serving
                          {(parseFloat(servingsInput[r.id] ?? "1") || 1) === 1
                            ? ""
                            : "s"}
                        </span>
                        <span className="ml-auto text-[10px] tabular-nums text-[var(--color-muted)]">
                          {Math.round(
                            r.calories *
                              (parseFloat(servingsInput[r.id] ?? "1") || 1),
                          )}{" "}
                          kcal
                        </span>
                        <Button
                          size="sm"
                          variant="soft"
                          onClick={() => logToFood(r)}
                          disabled={loggingId === r.id}
                        >
                          <Utensils size={11} />
                          {loggingId === r.id ? "…" : "Log"}
                        </Button>
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditing(r)}
                          className="flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                        >
                          <Pencil size={11} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(r)}
                          className="flex items-center gap-1 text-xs text-red-600 hover:brightness-90"
                        >
                          <Trash2 size={11} />
                          Delete
                        </button>
                      </div>
                    </div>
                  )}

                  {isEditing && (
                    <div className="mt-2">
                      <RecipeForm
                        userId={userId}
                        recipe={r}
                        onCancel={() => setEditing(null)}
                        onSaved={() => {
                          setEditing(null);
                          onChanged();
                        }}
                      />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}

function RecipeForm({
  userId,
  recipe,
  onCancel,
  onSaved,
}: {
  userId: string;
  recipe: Recipe | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(recipe?.title ?? "");
  const [description, setDescription] = useState(recipe?.description ?? "");
  const [minutes, setMinutes] = useState(
    recipe?.minutes != null ? String(recipe.minutes) : "",
  );
  const [servings, setServings] = useState(String(recipe?.servings ?? 1));
  const [calories, setCalories] = useState(String(recipe?.calories ?? ""));
  const [protein, setProtein] = useState(String(recipe?.protein_g ?? ""));
  const [carbs, setCarbs] = useState(String(recipe?.carbs_g ?? ""));
  const [fat, setFat] = useState(String(recipe?.fat_g ?? ""));
  const [ingredientsText, setIngredientsText] = useState(
    (recipe?.ingredients_json ?? [])
      .map((i) => `${i.amount} ${i.name}`)
      .join("\n"),
  );
  const [stepsText, setStepsText] = useState(
    (recipe?.steps_json ?? []).join("\n"),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);

    const ingredients: RecipeIngredient[] = ingredientsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        // Split on first whitespace: "200g spinach" → {amount:"200g", name:"spinach"}
        const idx = line.indexOf(" ");
        if (idx === -1) return { amount: "", name: line };
        return { amount: line.slice(0, idx), name: line.slice(idx + 1) };
      });
    const steps = stepsText.split("\n").map((s) => s.trim()).filter(Boolean);

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      minutes: minutes ? parseInt(minutes, 10) : null,
      servings: parseInt(servings, 10) || 1,
      calories: parseFloat(calories) || 0,
      protein_g: parseFloat(protein) || 0,
      carbs_g: parseFloat(carbs) || 0,
      fat_g: parseFloat(fat) || 0,
      ingredients_json: ingredients,
      steps_json: steps,
      source: recipe?.source ?? "manual",
    };

    const { error: err } = recipe
      ? await supabase.from("recipes").update(payload).eq("id", recipe.id)
      : await supabase
          .from("recipes")
          .insert({ ...payload, user_id: userId });

    setBusy(false);
    if (err) return setError(err.message);
    onSaved();
  }

  return (
    <form
      onSubmit={save}
      className={cn(
        "mb-3 space-y-2 rounded-card border border-[var(--color-border)] bg-white/60 p-3",
      )}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Recipe title"
        required
        className={FIELD}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder="One-line description (optional)"
        className="w-full rounded-card border border-[var(--color-border)] bg-white/80 p-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
      />
      <div className="grid grid-cols-4 gap-2">
        <LabelledNum label="Min" value={minutes} onChange={setMinutes} />
        <LabelledNum
          label="Servings"
          value={servings}
          onChange={setServings}
        />
        <LabelledNum
          label="kcal"
          value={calories}
          onChange={setCalories}
        />
        <LabelledNum label="P" value={protein} onChange={setProtein} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LabelledNum label="Carbs" value={carbs} onChange={setCarbs} />
        <LabelledNum label="Fat" value={fat} onChange={setFat} />
      </div>
      <label className="block">
        <span className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
          Ingredients (one per line, "amount name")
        </span>
        <textarea
          value={ingredientsText}
          onChange={(e) => setIngredientsText(e.target.value)}
          rows={4}
          placeholder="200g spinach&#10;2 eggs&#10;1 tbsp olive oil"
          className="w-full rounded-card border border-[var(--color-border)] bg-white/80 p-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
          Steps (one per line)
        </span>
        <textarea
          value={stepsText}
          onChange={(e) => setStepsText(e.target.value)}
          rows={4}
          placeholder="Heat oil in a pan…"
          className="w-full rounded-card border border-[var(--color-border)] bg-white/80 p-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
        />
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          Cancel
        </button>
        <Button type="submit" size="sm" disabled={busy || !title.trim()}>
          <Book size={11} />
          {busy ? "Saving…" : recipe ? "Save" : "Add"}
        </Button>
      </div>
    </form>
  );
}

function LabelledNum({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </span>
      <input
        type="number"
        step="0.1"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD}
      />
    </label>
  );
}
