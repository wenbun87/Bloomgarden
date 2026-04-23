import { useEffect, useState } from "react";
import { ExternalLink, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import type { WishlistItem } from "@/hooks/useWishlist";
import { cn } from "@/lib/utils";

// Compact input style for the inline form (smaller than the app-wide Input).
const FIELD =
  "h-8 w-full rounded-pill border border-[var(--color-border)] bg-white/80 px-3 text-xs text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30";

type Props = {
  userId: string;
  items: WishlistItem[];
  onChanged: () => void;
  className?: string;
};

// Inline-editing pattern (matches the Projection / Analysis panels on the
// Orchard page). "Add" toggles the form at the top; Pencil swaps the form in
// pre-filled with the item's values. No modal Dialog.
export function WishlistWidget({ userId, items, onChanged, className }: Props) {
  const [editing, setEditing] = useState<WishlistItem | "new" | null>(null);

  async function toggleVisibility(item: WishlistItem) {
    await supabase
      .from("wishlist_items")
      .update({ show_in_profile: !item.show_in_profile })
      .eq("id", item.id);
    onChanged();
  }

  return (
    <WidgetCard
      title="Wishlist"
      className={className}
      action={
        <button
          onClick={() =>
            setEditing((cur) => (cur === "new" ? null : "new"))
          }
          className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:brightness-90"
        >
          <Plus size={12} />
          {editing === "new" ? "Close" : "Add"}
        </button>
      }
    >
      {editing === "new" && (
        <WishlistForm
          userId={userId}
          item={null}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}

      {items.length === 0 && !editing ? (
        <EmptyState
          title="Nothing on the wishlist yet"
          hint="Add things you'd love and toggle which ones friends can see."
        />
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {items.map((item) => {
            const isEditing = editing !== null && editing !== "new" && editing.id === item.id;
            return (
              <li key={item.id}>
                <div className="group flex items-start gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-xs text-[var(--color-muted)]">
                        {item.title}
                      </p>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--color-muted)] hover:text-[var(--color-accent)]"
                          aria-label="Open link"
                        >
                          <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                    {item.notes && (
                      <p className="text-xs text-[var(--color-muted)]">
                        {item.notes}
                      </p>
                    )}
                    {item.price != null && (
                      <p className="text-[10px] tabular-nums text-[var(--color-muted)]">
                        {item.price.toLocaleString()}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => toggleVisibility(item)}
                    aria-label={
                      item.show_in_profile
                        ? "Hide from profile"
                        : "Show on profile"
                    }
                    title={
                      item.show_in_profile
                        ? "Shown to friends"
                        : "Hidden from friends"
                    }
                    className={cn(
                      "text-[var(--color-muted)] transition hover:text-[var(--color-ink)]",
                      item.show_in_profile && "text-[var(--color-accent)]",
                    )}
                  >
                    {item.show_in_profile ? (
                      <Eye size={13} />
                    ) : (
                      <EyeOff size={13} />
                    )}
                  </button>
                  <button
                    onClick={() =>
                      setEditing((cur) =>
                        cur !== null && cur !== "new" && cur.id === item.id
                          ? null
                          : item,
                      )
                    }
                    aria-label="Edit"
                    className={cn(
                      "text-[var(--color-muted)] hover:text-[var(--color-ink)]",
                      isEditing
                        ? "opacity-100"
                        : "opacity-0 transition group-hover:opacity-100",
                    )}
                  >
                    <Pencil size={12} />
                  </button>
                </div>
                {isEditing && (
                  <div className="pb-2">
                    <WishlistForm
                      userId={userId}
                      item={item}
                      onCancel={() => setEditing(null)}
                      onSaved={() => {
                        setEditing(null);
                        onChanged();
                      }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}

function WishlistForm({
  userId,
  item,
  onCancel,
  onSaved,
}: {
  userId: string;
  item: WishlistItem | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [url, setUrl] = useState(item?.url ?? "");
  const [price, setPrice] = useState(
    item?.price != null ? String(item.price) : "",
  );
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [showInProfile, setShowInProfile] = useState(
    item?.show_in_profile ?? false,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset fields whenever switching from one item to another.
  useEffect(() => {
    setTitle(item?.title ?? "");
    setUrl(item?.url ?? "");
    setPrice(item?.price != null ? String(item.price) : "");
    setNotes(item?.notes ?? "");
    setShowInProfile(item?.show_in_profile ?? false);
    setError(null);
  }, [item]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    const payload = {
      title: title.trim(),
      url: url.trim() || null,
      price: price ? parseFloat(price) : null,
      notes: notes.trim() || null,
      show_in_profile: showInProfile,
    };
    const { error: err } = item
      ? await supabase.from("wishlist_items").update(payload).eq("id", item.id)
      : await supabase
          .from("wishlist_items")
          .insert({ ...payload, user_id: userId });
    setBusy(false);
    if (err) return setError(err.message);
    onSaved();
  }

  async function remove() {
    if (!item || !confirm(`Remove "${item.title}"?`)) return;
    setBusy(true);
    const { error: err } = await supabase
      .from("wishlist_items")
      .delete()
      .eq("id", item.id);
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
        placeholder="Title (e.g. ceramic planter)"
        required
        className={FIELD}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Link (optional)"
          className={FIELD}
        />
        <input
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Price"
          className={FIELD}
        />
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        maxLength={300}
        placeholder="Notes (size, colour, why you want it…)"
        className="w-full rounded-card border border-[var(--color-border)] bg-white/80 p-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
      />
      <label className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
        <input
          type="checkbox"
          checked={showInProfile}
          onChange={(e) => setShowInProfile(e.target.checked)}
          className="h-4 w-4 rounded"
        />
        Show on my profile (friends can see it)
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center justify-between">
        {item ? (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="flex items-center gap-1 text-xs text-red-600 hover:brightness-90"
          >
            <Trash2 size={11} />
            Delete
          </button>
        ) : (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            Cancel
          </button>
        )}
        <Button type="submit" size="sm" disabled={busy || !title.trim()}>
          {busy ? "Saving…" : item ? "Save" : "Add"}
        </Button>
      </div>
    </form>
  );
}
