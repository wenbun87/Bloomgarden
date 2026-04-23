import { useState } from "react";
import { Bookmark, ChefHat, Clock, Flame, Sparkles, X } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";
import type { RecipeIngredient } from "@/hooks/useRecipes";

type AiRecipe = {
  title: string;
  description: string;
  minutes: number;
  servings: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  health_notes: string;
};

type Props = {
  userId: string;
  onSaved: () => void;
  className?: string;
};

export function RecipeSuggestWidget({ userId, onSaved, className }: Props) {
  const [ingredient, setIngredient] = useState("");
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [preferences, setPreferences] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<AiRecipe[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);

  function addIngredient(e: React.FormEvent) {
    e.preventDefault();
    const v = ingredient.trim().toLowerCase();
    if (!v || ingredients.includes(v)) return;
    setIngredients((cur) => [...cur, v]);
    setIngredient("");
  }

  function removeIngredient(v: string) {
    setIngredients((cur) => cur.filter((i) => i !== v));
  }

  async function suggest() {
    if (ingredients.length === 0) return;
    setSuggesting(true);
    setError(null);
    setRecipes([]);
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      setSuggesting(false);
      setError("Not signed in.");
      return;
    }
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_WORKER_URL}/analysis/recipes`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ingredients, preferences }),
        },
      );
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(t || `HTTP ${resp.status}`);
      }
      const data = (await resp.json()) as { recipes: AiRecipe[] };
      setRecipes(data.recipes ?? []);
      setExpandedIdx(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSuggesting(false);
    }
  }

  async function saveToBook(idx: number) {
    const r = recipes[idx];
    if (!r) return;
    setSavingIdx(idx);
    const { error: insErr } = await supabase.from("recipes").insert({
      user_id: userId,
      title: r.title,
      description: r.description,
      minutes: r.minutes,
      servings: r.servings,
      calories: r.calories,
      protein_g: r.protein_g,
      carbs_g: r.carbs_g,
      fat_g: r.fat_g,
      ingredients_json: r.ingredients,
      steps_json: r.steps,
      health_notes: r.health_notes,
      source: "ai",
    });
    setSavingIdx(null);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    onSaved();
  }

  return (
    <WidgetCard
      title="Recipe suggester"
      className={className}
      action={<ChefHat size={14} className="text-[var(--color-muted)]" />}
    >
      <form onSubmit={addIngredient} className="flex gap-2">
        <Input
          value={ingredient}
          onChange={(e) => setIngredient(e.target.value)}
          placeholder="add an ingredient (e.g. eggs, spinach)"
          className="flex-1"
        />
        <Button type="submit" size="sm" disabled={!ingredient.trim()}>
          Add
        </Button>
      </form>

      {ingredients.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1">
          {ingredients.map((i) => (
            <li
              key={i}
              className="flex items-center gap-1 rounded-pill bg-[var(--color-accent-soft)] px-2.5 py-0.5 text-xs"
            >
              {i}
              <button
                onClick={() => removeIngredient(i)}
                aria-label={`Remove ${i}`}
              >
                <X size={10} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Input
        value={preferences}
        onChange={(e) => setPreferences(e.target.value)}
        placeholder="optional preferences (gluten-free, under 30 min…)"
        className="mt-2"
      />

      <Button
        onClick={suggest}
        disabled={suggesting || ingredients.length === 0}
        className="mt-3 w-full"
      >
        <Sparkles size={12} />
        {suggesting ? "Thinking…" : "Suggest recipes"}
      </Button>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {recipes.length > 0 && (
        <ul className="mt-3 space-y-2">
          {recipes.map((r, i) => (
            <li
              key={i}
              className="rounded-card border border-[var(--color-border)] bg-white/60 p-3"
            >
              <button
                type="button"
                onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                className="block w-full text-left"
              >
                <p className="text-sm font-medium">{r.title}</p>
                <p className="text-xs text-[var(--color-muted)]">
                  {r.description}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-[var(--color-muted)]">
                  <span className="flex items-center gap-0.5">
                    <Clock size={10} />
                    {r.minutes} min
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Flame size={10} />
                    {Math.round(r.calories)} kcal/serving
                  </span>
                  <span>
                    P{Math.round(r.protein_g)} · C{Math.round(r.carbs_g)} · F
                    {Math.round(r.fat_g)}
                  </span>
                  <span>{r.servings} servings</span>
                </div>
              </button>

              {expandedIdx === i && (
                <div className="mt-3 space-y-3 text-xs">
                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                      Ingredients
                    </p>
                    <ul className="space-y-0.5">
                      {r.ingredients.map((ing, j) => (
                        <li
                          key={j}
                          className="flex items-start gap-1.5"
                        >
                          <span
                            className={
                              ing.have
                                ? "text-green-600"
                                : "text-[var(--color-muted)]"
                            }
                          >
                            {ing.have ? "✓" : "🛒"}
                          </span>
                          <span>
                            <span className="text-[var(--color-ink)]">
                              {ing.amount}
                            </span>{" "}
                            <span className="text-[var(--color-muted)]">
                              {ing.name}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                      Steps
                    </p>
                    <ol className="list-decimal space-y-1 pl-4">
                      {r.steps.map((s, j) => (
                        <li key={j}>{s}</li>
                      ))}
                    </ol>
                  </div>
                  {r.health_notes && (
                    <p className="italic text-[var(--color-muted)]">
                      {r.health_notes}
                    </p>
                  )}
                  <Button
                    size="sm"
                    variant="soft"
                    onClick={() => saveToBook(i)}
                    disabled={savingIdx === i}
                    className="w-full"
                  >
                    <Bookmark size={11} />
                    {savingIdx === i ? "Saving…" : "Save to cookbook"}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[10px] italic text-[var(--color-muted)]">
        AI-suggested recipes. Use your judgment — not medical advice.
      </p>
    </WidgetCard>
  );
}
