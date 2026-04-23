import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";

type Props = { userId: string; onDone: () => void };

export default function Onboarding({ userId, onDone }: Props) {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedUsername = username.trim().toLowerCase();
  const validUsername = /^[a-z0-9_]{3,24}$/.test(normalizedUsername);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim() || !validUsername) return;
    setSaving(true);
    setError(null);

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        username: normalizedUsername,
      })
      .eq("id", userId);

    setSaving(false);
    if (updateErr) {
      setError(
        updateErr.code === "23505"
          ? "That username is taken — try another."
          : updateErr.message,
      );
      return;
    }
    onDone();
    navigate("/friends", { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-card border border-white/60 bg-surface backdrop-blur-card shadow-card p-6">
        <h1 className="text-xl font-semibold tracking-tight">
          Welcome to Bloomgarden
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Pick how you'll show up to friends. You can change this later.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
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
              3–24 chars, lowercase letters, numbers, underscore. Friends use
              this to add you.
            </span>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button
            type="submit"
            className="w-full"
            disabled={saving || !displayName.trim() || !validUsername}
          >
            {saving ? "Saving…" : "Plant my garden"}
          </Button>
        </form>
      </div>
    </div>
  );
}
