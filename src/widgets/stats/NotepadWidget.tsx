import { useState } from "react";
import { NotebookPen, Pencil, Plus, Trash2 } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import type { Note } from "@/hooks/useNotes";

const FIELD =
  "h-8 w-full rounded-pill border border-[var(--color-border)] bg-white/80 px-3 text-xs text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30";

type Props = {
  userId: string;
  notes: Note[];
  onChanged: () => void;
  className?: string;
};

export function NotepadWidget({ userId, notes, onChanged, className }: Props) {
  const [editing, setEditing] = useState<Note | "new" | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <WidgetCard
      title="Notepad"
      className={className}
      action={
        <button
          onClick={() => setEditing((cur) => (cur === "new" ? null : "new"))}
          className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:brightness-90"
        >
          <Plus size={12} />
          {editing === "new" ? "Close" : "New note"}
        </button>
      }
    >
      {editing === "new" && (
        <NoteForm
          userId={userId}
          note={null}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}

      {notes.length === 0 && !editing ? (
        <EmptyState
          title="Nothing written down yet"
          hint="A scratchpad for half-thoughts, running lists, or anything."
          action={
            <Button size="sm" variant="soft" onClick={() => setEditing("new")}>
              <NotebookPen size={11} />
              Start a note
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {notes.map((n) => {
            const isEditing =
              editing !== null && editing !== "new" && editing.id === n.id;
            const expanded = expandedId === n.id;
            return (
              <li key={n.id}>
                <div className="group py-2">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : n.id)}
                    className="block w-full text-left"
                  >
                    <p className="truncate text-sm font-medium">{n.title}</p>
                    {n.body && !expanded && (
                      <p className="truncate text-xs text-[var(--color-muted)]">
                        {n.body}
                      </p>
                    )}
                  </button>

                  {expanded && !isEditing && (
                    <div className="mt-2 space-y-2">
                      {n.body && (
                        <p className="whitespace-pre-wrap text-xs text-[var(--color-ink)]">
                          {n.body}
                        </p>
                      )}
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditing(n)}
                          className="flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                        >
                          <Pencil size={11} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm(`Delete "${n.title}"?`)) return;
                            await supabase.from("notes").delete().eq("id", n.id);
                            onChanged();
                          }}
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
                      <NoteForm
                        userId={userId}
                        note={n}
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

function NoteForm({
  userId,
  note,
  onCancel,
  onSaved,
}: {
  userId: string;
  note: Note | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    const payload = { title: title.trim(), body: body.trim() || null };
    const { error: err } = note
      ? await supabase.from("notes").update(payload).eq("id", note.id)
      : await supabase.from("notes").insert({ ...payload, user_id: userId });
    setBusy(false);
    if (err) return setError(err.message);
    onSaved();
  }

  return (
    <form
      onSubmit={save}
      className="mb-3 space-y-2 rounded-card border border-[var(--color-border)] bg-white/60 p-3"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title"
        required
        maxLength={200}
        className={FIELD}
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        maxLength={20000}
        placeholder="Write it down…"
        className="w-full rounded-card border border-[var(--color-border)] bg-white/80 p-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
      />
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
          {busy ? "Saving…" : note ? "Save" : "Add"}
        </Button>
      </div>
    </form>
  );
}
