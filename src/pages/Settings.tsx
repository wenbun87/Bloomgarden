import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/hooks/useProfile";
import {
  HIDEABLE_CATEGORIES,
  useUserHabits,
  type HideableCategory,
  type UserHabit,
} from "@/hooks/useUserHabits";
import {
  WIDGET_KEYS,
  WIDGET_LABELS,
  useHiddenWidgets,
  type WidgetKey,
} from "@/hooks/useHiddenWidgets";

const DEFAULT_LABELS: Record<HideableCategory, string> = {
  exercise: "Exercise",
  hobby: "Hobby",
  mental_health: "Mental health",
  sleep: "Sleep",
  plants: "Plants",
  social: "Social",
  savings: "Savings",
  investment: "Investing",
};

// Built-in coin cap (from the plan): ~236/week at full consistency.
// Custom rewards: daily+2, weekly+5, monthly+20 (≈ +4.6/week amortized).
const BUILTIN_WEEKLY_MAX = 221;
const SOFT_CAP = 236;

function customWeekly(h: { cadence: UserHabit["cadence"] }): number {
  if (h.cadence === "daily") return 2 * 7;     // +14/week
  if (h.cadence === "weekly") return 5;
  return 20 / 4.3;                             // +4.6/week amortized
}

type Props = { userId: string };

// Inline-editable row — click the name to edit, Enter / blur to save, Esc to cancel.
function EditableHabitRow({
  habit,
  onSaved,
  onDelete,
}: {
  habit: UserHabit;
  onSaved: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(habit.name);

  async function save() {
    const next = draft.trim();
    if (!next || next === habit.name) {
      setEditing(false);
      setDraft(habit.name);
      return;
    }
    await supabase
      .from("user_habits")
      .update({ name: next })
      .eq("id", habit.id);
    setEditing(false);
    onSaved();
  }

  return (
    <li className="flex items-center justify-between py-2">
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") {
                setDraft(habit.name);
                setEditing(false);
              }
            }}
            maxLength={40}
            className="w-full bg-transparent text-sm font-medium outline-none"
          />
        ) : (
          <button
            onClick={() => {
              setDraft(habit.name);
              setEditing(true);
            }}
            className="block w-full truncate text-left text-sm font-medium hover:text-[var(--color-accent)]"
          >
            {habit.name}
          </button>
        )}
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
          {habit.cadence === "daily" && habit.target_per_week
            ? `${habit.target_per_week}× weekly`
            : habit.cadence}
        </p>
      </div>
      <button
        onClick={onDelete}
        aria-label="Delete"
        className="text-[var(--color-muted)] hover:text-red-600"
      >
        <Trash2 size={13} />
      </button>
    </li>
  );
}

export default function Settings({ userId }: Props) {
  const { profile, reload } = useProfile(userId);
  const habits = useUserHabits(userId);
  const widgets = useHiddenWidgets(userId);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add-habit form
  const [newName, setNewName] = useState("");
  const [newCadence, setNewCadence] = useState<UserHabit["cadence"]>("daily");
  const [newTargetPerWeek, setNewTargetPerWeek] = useState<string>("");
  const [addingHabit, setAddingHabit] = useState(false);
  const [habitErr, setHabitErr] = useState<string | null>(null);

  const projectedWeekly = useMemo(() => {
    const visibleBuiltins =
      BUILTIN_WEEKLY_MAX *
      (1 - habits.hidden.size / HIDEABLE_CATEGORIES.length);
    const custom = habits.habits.reduce((s, h) => s + customWeekly(h), 0);
    return Math.round(visibleBuiltins + custom);
  }, [habits.habits, habits.hidden]);

  async function toggleHidden(category: HideableCategory, hide: boolean) {
    if (hide) {
      await supabase
        .from("user_habit_hidden")
        .insert({ user_id: userId, category });
    } else {
      await supabase
        .from("user_habit_hidden")
        .delete()
        .eq("user_id", userId)
        .eq("category", category);
    }
    habits.reload();
  }

  async function addHabit(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;

    // Soft-cap warning: if the NEXT habit would push the projected weekly
    // earning above the calibrated ~236/week, confirm before adding.
    const addedWeekly = customWeekly({ cadence: newCadence });
    if (projectedWeekly + addedWeekly > SOFT_CAP) {
      const ok = confirm(
        `Heads up: adding "${name}" may push your weekly coin earnings above the calibrated max (~${SOFT_CAP}/week). The garden shop prices assume that cap — custom habits beyond it may make heirlooms easier to reach than intended. Continue?`,
      );
      if (!ok) return;
    }

    setAddingHabit(true);
    setHabitErr(null);
    const parsedTarget = parseInt(newTargetPerWeek, 10);
    const target_per_week =
      newCadence === "daily" && Number.isFinite(parsedTarget) && parsedTarget >= 1 && parsedTarget <= 7
        ? parsedTarget
        : null;
    const { error: insErr } = await supabase
      .from("user_habits")
      .insert({
        user_id: userId,
        name,
        cadence: newCadence,
        target_per_week,
      });
    setAddingHabit(false);
    if (insErr) return setHabitErr(insErr.message);
    setNewName("");
    setNewCadence("daily");
    setNewTargetPerWeek("");
    habits.reload();
  }

  async function removeHabit(id: string, name: string) {
    if (!confirm(`Delete "${name}" and all its log history?`)) return;
    await supabase.from("user_habits").delete().eq("id", id);
    habits.reload();
  }

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name);
    setUsername(profile.username);
  }, [profile]);

  const normalizedUsername = username.trim().toLowerCase();
  const validUsername = /^[a-z0-9_]{3,24}$/.test(normalizedUsername);
  const dirty =
    !!profile &&
    (displayName.trim() !== profile.display_name ||
      normalizedUsername !== profile.username);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty || !displayName.trim() || !validUsername) return;
    setSaving(true);
    setError(null);
    setFlash(null);
    const { error: upErr } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        username: normalizedUsername,
      })
      .eq("id", userId);
    setSaving(false);
    if (upErr) {
      setError(
        upErr.code === "23505"
          ? "That username is already taken — try another."
          : upErr.message,
      );
      return;
    }
    setFlash("Saved.");
    reload();
    setTimeout(() => setFlash(null), 2000);
  }

  if (!profile) {
    return <p className="text-sm text-[var(--color-muted)]">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">
          How you show up to friends.
        </p>
      </div>

      <WidgetCard
        title="Widgets across the app"
        subtitle="Show / hide"
      >
        <p className="mb-3 text-xs text-[var(--color-muted)]">
          Hide anything you don't want cluttering a page. Core pieces (garden,
          shop, net worth, leaderboard) stay visible.
        </p>
        {(() => {
          const byPage = new Map<string, WidgetKey[]>();
          for (const k of WIDGET_KEYS) {
            const page = WIDGET_LABELS[k].page;
            if (!byPage.has(page)) byPage.set(page, []);
            byPage.get(page)!.push(k);
          }
          return [...byPage.entries()].map(([page, keys]) => (
            <div key={page} className="mb-3 last:mb-0">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                {page}
              </p>
              <ul className="divide-y divide-[var(--color-border)]">
                {keys.map((k) => {
                  const h = widgets.hidden.has(k);
                  return (
                    <li
                      key={k}
                      className="flex items-center justify-between py-1.5"
                    >
                      <span className="text-sm">{WIDGET_LABELS[k].label}</span>
                      <button
                        onClick={() => widgets.toggle(k, !h)}
                        className={
                          h
                            ? "text-xs text-[var(--color-accent)] hover:brightness-90"
                            : "text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                        }
                      >
                        {h ? "Show" : "Hide"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ));
        })()}
      </WidgetCard>

      <WidgetCard
        title="Built-in habits"
        subtitle="Show / hide"
      >
        <p className="mb-3 text-xs text-[var(--color-muted)]">
          Hide any built-in you don't track. You can bring them back any time —
          the data stays.
        </p>
        <ul className="divide-y divide-[var(--color-border)]">
          {HIDEABLE_CATEGORIES.map((cat) => {
            const hidden = habits.hidden.has(cat);
            return (
              <li
                key={cat}
                className="flex items-center justify-between py-2"
              >
                <span className="text-sm">{DEFAULT_LABELS[cat]}</span>
                <button
                  onClick={() => toggleHidden(cat, !hidden)}
                  className={
                    hidden
                      ? "text-xs text-[var(--color-accent)] hover:brightness-90"
                      : "text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                  }
                >
                  {hidden ? "Show" : "Hide"}
                </button>
              </li>
            );
          })}
        </ul>
      </WidgetCard>

      <WidgetCard
        title="Your custom habits"
        subtitle={`~${projectedWeekly} coins / week projected`}
      >
        <form onSubmit={addHabit} className="mb-3 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Cold shower, Read 20 min"
              maxLength={40}
              className="flex-1"
            />
            <select
              value={newCadence}
              onChange={(e) => {
                setNewCadence(e.target.value as UserHabit["cadence"]);
                if (e.target.value !== "daily") setNewTargetPerWeek("");
              }}
              className="h-10 rounded-pill border border-[var(--color-border)] bg-white/80 px-4 text-sm"
            >
              <option value="daily">Daily (+2)</option>
              <option value="weekly">Weekly (+5)</option>
              <option value="monthly">Monthly (+20)</option>
            </select>
            <Button type="submit" disabled={addingHabit || !newName.trim()}>
              <Plus size={12} />
              Add
            </Button>
          </div>
          {newCadence === "daily" && (
            <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
              <label className="flex items-center gap-1">
                <span>Target</span>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={newTargetPerWeek}
                  onChange={(e) => setNewTargetPerWeek(e.target.value)}
                  placeholder="—"
                  className="h-7 w-12 rounded-pill border border-[var(--color-border)] bg-white px-2 text-center text-xs outline-none"
                />
                <span>× per week (optional)</span>
              </label>
              <span className="text-[10px]">
                Leave blank for "every day". Set 3 for "3× weekly".
              </span>
            </div>
          )}
        </form>
        {habitErr && <p className="mb-2 text-xs text-red-600">{habitErr}</p>}

        {habits.habits.length === 0 ? (
          <p className="text-xs text-[var(--color-muted)]">
            No custom habits yet. Add one above — it appears on your dashboard.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {habits.habits.map((h) => (
              <EditableHabitRow
                key={h.id}
                habit={h}
                onSaved={habits.reload}
                onDelete={() => removeHabit(h.id, h.name)}
              />
            ))}
          </ul>
        )}
      </WidgetCard>

      <WidgetCard title="Profile">
        <form onSubmit={save} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
              Display name
            </span>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">
              Username
            </span>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <span className="mt-1 block text-xs text-[var(--color-muted)]">
              3–24 chars, lowercase letters, numbers, underscore. Friends add
              you by this.
            </span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {flash && <p className="text-sm text-green-700">{flash}</p>}

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={
                saving || !dirty || !displayName.trim() || !validUsername
              }
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </WidgetCard>
    </div>
  );
}
