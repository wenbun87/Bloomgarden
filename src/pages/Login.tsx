import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

export default function Login() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "error"; msg: string }
    | { kind: "check-email" }
  >({ kind: "idle" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setStatus({ kind: "sending" });

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return setStatus({ kind: "error", msg: error.message });
      setStatus({ kind: "idle" });
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) return setStatus({ kind: "error", msg: error.message });

    // If email confirmation is enabled in Supabase, there's no session yet —
    // tell the user to confirm. If it's disabled, the session lands immediately
    // and useSession picks it up.
    if (!data.session) {
      setStatus({ kind: "check-email" });
      return;
    }
    setStatus({ kind: "idle" });
  }

  const busy = status.kind === "sending";
  const ready = !!email.trim() && !!password.trim() && !busy;

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-card border border-white/60 bg-surface backdrop-blur-card shadow-card p-6">
        <h1 className="text-xl font-semibold tracking-tight">Bloomgarden</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          A calm place to grow your life.
        </p>

        <div className="mt-4 flex gap-1 rounded-pill bg-black/5 p-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setStatus({ kind: "idle" });
            }}
            className={cn(
              "flex-1 rounded-pill px-3 py-1.5 transition",
              mode === "signin"
                ? "bg-white shadow-sm"
                : "text-[var(--color-muted)]",
            )}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setStatus({ kind: "idle" });
            }}
            className={cn(
              "flex-1 rounded-pill px-3 py-1.5 transition",
              mode === "signup"
                ? "bg-white shadow-sm"
                : "text-[var(--color-muted)]",
            )}
          >
            Create account
          </button>
        </div>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <Input
            type="email"
            required
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
          <Input
            type="password"
            required
            minLength={6}
            placeholder={mode === "signup" ? "password (6+ chars)" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
          <Button
            type="submit"
            variant={ready ? "primary" : "soft"}
            className="w-full"
            disabled={!ready}
          >
            {busy
              ? mode === "signin"
                ? "Signing in…"
                : "Creating account…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </Button>
        </form>

        {status.kind === "error" && (
          <p className="mt-4 text-sm text-red-600">{status.msg}</p>
        )}
        {status.kind === "check-email" && (
          <p className="mt-4 text-sm text-[var(--color-ink)]">
            Check your inbox and click the confirmation link to finish signing
            up.
          </p>
        )}
      </div>
    </div>
  );
}
