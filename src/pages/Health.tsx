import { useBriefs } from "@/hooks/useBriefs";
import { useFoodEntries } from "@/hooks/useFoodEntries";
import { useRecipes } from "@/hooks/useRecipes";
import { useHiddenWidgets } from "@/hooks/useHiddenWidgets";
import { FieldNotesWidget } from "@/widgets/ai/FieldNotesWidget";
import { DirtyDozenWidget } from "@/widgets/health/DirtyDozenWidget";
import { FoodTrackerWidget } from "@/widgets/health/FoodTrackerWidget";
import { FoodSearchWidget } from "@/widgets/health/FoodSearchWidget";
import { RecipeSuggestWidget } from "@/widgets/health/RecipeSuggestWidget";
import { CookbookWidget } from "@/widgets/health/CookbookWidget";

type Props = { userId: string };

export default function Health({ userId }: Props) {
  const { fieldNotes, loading } = useBriefs();
  const foods = useFoodEntries(userId);
  const recipes = useRecipes(userId);
  const widgets = useHiddenWidgets(userId);
  const h = widgets.hidden;

  const showSearch = !h.has("kitchen:food-search");
  const showTracker = !h.has("kitchen:food-tracker");
  const showSuggest = !h.has("kitchen:recipe-suggest");
  const showCookbook = !h.has("kitchen:cookbook");
  const showDirty = !h.has("kitchen:dirty-dozen");
  const showNotes = !h.has("kitchen:field-notes");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Kitchen</h1>
        <p className="page-sub">
          Everything you need at your fingertips to eat well — flag processed
          foods, microplastics, and questionable ingredients before they land
          on your plate.
        </p>
      </div>

      {(showSearch || showTracker) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {showSearch && (
            <FoodSearchWidget userId={userId} onChanged={foods.reload} />
          )}
          {showTracker && (
            <FoodTrackerWidget
              entries={foods.today}
              onChanged={foods.reload}
            />
          )}
        </div>
      )}

      {(showSuggest || showCookbook) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {showSuggest && (
            <RecipeSuggestWidget userId={userId} onSaved={recipes.reload} />
          )}
          {showCookbook && (
            <CookbookWidget
              userId={userId}
              recipes={recipes.recipes}
              onChanged={recipes.reload}
              onLogged={foods.reload}
            />
          )}
        </div>
      )}

      {(showDirty || showNotes) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {showDirty && <DirtyDozenWidget />}
          {showNotes &&
            (loading ? (
              <div className="rounded-card border border-white/60 bg-surface p-5">
                <p className="text-sm text-[var(--color-muted)]">Loading…</p>
              </div>
            ) : (
              <FieldNotesWidget brief={fieldNotes} />
            ))}
        </div>
      )}
    </div>
  );
}
