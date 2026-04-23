import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Filter, X } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";
import type { Todo } from "@/hooks/useTodos";
import { cn } from "@/lib/utils";
import { todayUtc } from "@/lib/dates";

type Props = {
  userId: string;
  todos: Todo[];
  onChanged: () => void;
  className?: string;
};

const DEFAULT_TAGS = ["urgent", "admin", "project"] as const;

const TAG_COLORS: Record<string, string> = {
  urgent: "bg-red-100 text-red-700",
  admin: "bg-slate-100 text-slate-700",
  project: "bg-violet-100 text-violet-700",
};

function tagColor(tag: string | null): string {
  if (!tag) return "bg-black/5 text-[var(--color-muted)]";
  return TAG_COLORS[tag] ?? "bg-amber-100 text-amber-700";
}

export function TodoWidget({ userId, todos, onChanged, className }: Props) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [customTag, setCustomTag] = useState("");
  const [customTagOpen, setCustomTagOpen] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    title: "",
    due_date: "",
    tag: "",
  });
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

  function startEdit(t: Todo) {
    setEditingId(t.id);
    setEditDraft({
      title: t.title,
      due_date: t.due_date ?? "",
      tag: t.tag ?? "",
    });
  }

  async function saveEdit(id: string) {
    if (!editDraft.title.trim()) {
      setEditingId(null);
      return;
    }
    const { error: upErr } = await supabase
      .from("todos")
      .update({
        title: editDraft.title.trim(),
        due_date: editDraft.due_date || null,
        tag: editDraft.tag.trim().toLowerCase() || null,
      })
      .eq("id", id);
    setEditingId(null);
    if (upErr) return setError(upErr.message);
    onChanged();
  }

  const allTags = useMemo(() => {
    const set = new Set<string>(DEFAULT_TAGS);
    for (const t of todos) if (t.tag) set.add(t.tag);
    return [...set];
  }, [todos]);

  const sorted = useMemo(() => {
    const active = filter
      ? todos.filter((t) => t.tag === filter)
      : todos;
    const open = active.filter((t) => !t.completed);
    const done = active.filter((t) => t.completed);
    open.sort((a, b) => {
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return b.created_at.localeCompare(a.created_at);
    });
    done.sort((a, b) =>
      (b.completed_at ?? "").localeCompare(a.completed_at ?? ""),
    );
    return [...open, ...done];
  }, [todos, filter]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    const resolvedTag =
      selectedTag === "__custom"
        ? customTag.trim().toLowerCase()
        : selectedTag || null;
    const { error: insErr } = await supabase.from("todos").insert({
      user_id: userId,
      title: title.trim(),
      due_date: dueDate || null,
      tag: resolvedTag || null,
    });
    setBusy(false);
    if (insErr) return setError(insErr.message);
    setTitle("");
    setDueDate("");
    setSelectedTag("");
    setCustomTag("");
    setCustomTagOpen(false);
    onChanged();
  }

  async function toggle(t: Todo) {
    const { error: upErr } = await supabase
      .from("todos")
      .update({
        completed: !t.completed,
        completed_at: t.completed ? null : new Date().toISOString(),
      })
      .eq("id", t.id);
    if (upErr) return setError(upErr.message);
    onChanged();
  }

  async function remove(id: string) {
    const { error: delErr } = await supabase.from("todos").delete().eq("id", id);
    if (delErr) return setError(delErr.message);
    onChanged();
  }

  const today = todayUtc();

  return (
    <WidgetCard
      title="To do list"
      className={className}
      action={
        <span className="text-xs text-[var(--color-muted)]">
          {todos.filter((t) => !t.completed).length} open
        </span>
      }
    >
      <form onSubmit={add} className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Something to get done"
            className="flex-1"
          />
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-36"
          />
          <Button type="submit" disabled={busy || !title.trim()}>
            Add
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1 text-[10px]">
          <span className="text-[var(--color-muted)]">Tag:</span>
          {DEFAULT_TAGS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setSelectedTag(selectedTag === t ? "" : t);
                setCustomTagOpen(false);
              }}
              className={cn(
                "rounded-pill px-2 py-0.5 uppercase transition",
                selectedTag === t
                  ? TAG_COLORS[t]
                  : "bg-black/5 text-[var(--color-muted)] hover:brightness-95",
              )}
            >
              {t}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setCustomTagOpen(true);
              setSelectedTag("__custom");
            }}
            className={cn(
              "rounded-pill px-2 py-0.5 uppercase transition",
              selectedTag === "__custom"
                ? "bg-amber-100 text-amber-700"
                : "bg-black/5 text-[var(--color-muted)] hover:brightness-95",
            )}
          >
            + custom
          </button>
          {customTagOpen && (
            <input
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              placeholder="tag name"
              maxLength={40}
              className="h-6 w-24 rounded-pill border border-[var(--color-border)] bg-white px-2 text-[10px] outline-none"
            />
          )}
        </div>
      </form>

      {allTags.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1 text-[10px]">
          <Filter size={10} className="text-[var(--color-muted)]" />
          <button
            type="button"
            onClick={() => setFilter(null)}
            className={cn(
              "rounded-pill px-2 py-0.5 transition",
              filter === null
                ? "bg-white text-[var(--color-ink)] shadow-sm"
                : "text-[var(--color-muted)]",
            )}
          >
            All
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilter(filter === t ? null : t)}
              className={cn(
                "rounded-pill px-2 py-0.5 uppercase transition",
                filter === t
                  ? tagColor(t)
                  : "text-[var(--color-muted)] hover:brightness-90",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <ul className="mt-3 divide-y divide-[var(--color-border)]">
        {sorted.length === 0 && (
          <li className="py-4 text-center text-xs text-[var(--color-muted)]">
            Nothing here yet.
          </li>
        )}
        {sorted.map((t) => {
          const overdue =
            !t.completed && t.due_date && t.due_date < today;
          return (
            <li
              key={t.id}
              className={cn(
                "group flex items-center gap-2 py-1.5",
                t.completed && "opacity-60",
              )}
            >
              <button
                onClick={() => toggle(t)}
                aria-label={t.completed ? "Mark incomplete" : "Mark complete"}
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-pill border transition",
                  t.completed
                    ? "border-green-500 bg-green-500 text-white"
                    : "border-[var(--color-border)] bg-white hover:border-[var(--color-accent)]",
                )}
              >
                {t.completed && <Check size={12} />}
              </button>
              {editingId === t.id ? (
                <form
                  className="flex min-w-0 flex-1 items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveEdit(t.id);
                  }}
                >
                  <input
                    ref={editInputRef}
                    value={editDraft.title}
                    onChange={(e) =>
                      setEditDraft((d) => ({ ...d, title: e.target.value }))
                    }
                    onBlur={() => saveEdit(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  />
                  <input
                    value={editDraft.tag}
                    onChange={(e) =>
                      setEditDraft((d) => ({ ...d, tag: e.target.value }))
                    }
                    onBlur={() => saveEdit(t.id)}
                    placeholder="tag"
                    maxLength={40}
                    className="w-20 rounded-pill border border-[var(--color-border)] bg-white px-2 py-0.5 text-[10px] uppercase outline-none"
                  />
                  <input
                    type="date"
                    value={editDraft.due_date}
                    onChange={(e) =>
                      setEditDraft((d) => ({ ...d, due_date: e.target.value }))
                    }
                    onBlur={() => saveEdit(t.id)}
                    className="w-32 rounded-pill border border-[var(--color-border)] bg-white px-2 py-0.5 text-xs"
                  />
                </form>
              ) : (
                <div
                  className="min-w-0 flex-1 cursor-text"
                  onClick={() => !t.completed && startEdit(t)}
                >
                  <div className="flex items-center gap-2">
                    <p
                      className={cn(
                        "truncate text-sm",
                        t.completed && "line-through",
                      )}
                    >
                      {t.title}
                    </p>
                    {t.tag && (
                      <span
                        className={cn(
                          "shrink-0 rounded-pill px-1.5 py-0.5 text-[9px] uppercase",
                          tagColor(t.tag),
                        )}
                      >
                        {t.tag}
                      </span>
                    )}
                  </div>
                  {t.due_date && (
                    <p
                      className={cn(
                        "text-[10px]",
                        overdue ? "text-red-600" : "text-[var(--color-muted)]",
                      )}
                    >
                      {overdue ? "overdue · " : "due "}
                      {t.due_date}
                    </p>
                  )}
                </div>
              )}
              <button
                onClick={() => remove(t.id)}
                aria-label="Delete"
                className="opacity-0 transition group-hover:opacity-100 text-[var(--color-muted)] hover:text-red-600"
              >
                <X size={12} />
              </button>
            </li>
          );
        })}
      </ul>
    </WidgetCard>
  );
}
