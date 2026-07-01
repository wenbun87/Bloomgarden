import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PixelPlant } from "@/components/PixelPlant";
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

    if (!data.session) {
      setStatus({ kind: "check-email" });
      return;
    }
    setStatus({ kind: "idle" });
  }

  const busy = status.kind === "sending";
  const ready = !!email.trim() && !!password.trim() && !busy;

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-6"
      style={{
        background:
          "linear-gradient(180deg, var(--color-sky) 0%, var(--color-bg) 60%)",
      }}
    >
      {/* Sun in upper left */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          top: 50,
          left: 60,
          width: 56,
          height: 56,
          borderRadius: 999,
          background: "var(--color-sun)",
          boxShadow: "0 0 36px var(--color-sun)",
        }}
      />

      {/* Ambient pixel plants — sunflower bottom-left, tulip bottom-right */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{ bottom: 70, left: 90 }}
      >
        <PixelPlant kind="sunflower" size={56} resolution={4} />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute hidden sm:block"
        style={{ bottom: 80, right: 120 }}
      >
        <PixelPlant kind="tulip" size={48} resolution={4} />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute hidden sm:block"
        style={{ bottom: 50, left: "55%" }}
      >
        <PixelPlant kind="chamomile" size={40} resolution={4} />
      </div>

      {/* Grass waves at the bottom */}
      <svg
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 right-0"
        width="100%"
        height="160"
        viewBox="0 0 800 160"
        preserveAspectRatio="none"
      >
        <path
          d="M0,100 Q200,70 400,100 T800,90 L800,160 L0,160 Z"
          fill="var(--color-grass)"
        />
        <path
          d="M0,120 Q200,100 400,120 T800,110 L800,160 L0,160 Z"
          fill="var(--color-grass-deep)"
        />
      </svg>

      {/* Sign-in card */}
      <div
        className="relative z-10 w-full max-w-sm rounded-[20px] bg-[var(--color-paper)] p-8"
        style={{
          boxShadow:
            "0 20px 60px rgba(40,30,20,0.12), 0 2px 0 rgba(0,0,0,0.05)",
        }}
      >
        <div className="mb-4 flex items-center gap-2.5">
          <span
            aria-hidden
            className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--color-grass)] text-white"
            style={{ boxShadow: "inset 0 -2px 0 var(--color-grass-deep)" }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <path d="M12 2v20M6 8c0-3 3-5 6-5M18 8c0-3-3-5-6-5M6 15c0 4 3 6 6 6M18 15c0 4-3 6-6 6" />
            </svg>
          </span>
          <h1 className="font-display m-0 text-2xl font-bold tracking-tight">
            Bloomgarden
          </h1>
        </div>
        <p className="mb-5 text-sm text-[var(--color-muted)]">
          A calm place to grow your life.
        </p>

        <div
          className="mb-4 flex gap-1 rounded-[12px] p-1 text-xs"
          style={{ background: "rgba(0,0,0,0.04)" }}
        >
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setStatus({ kind: "idle" });
            }}
            className={cn(
              "flex-1 rounded-[10px] px-3 py-2 font-semibold transition",
              mode === "signin"
                ? "bg-[var(--color-grass-deep)] text-white"
                : "text-[var(--color-muted)]",
            )}
            style={
              mode === "signin"
                ? { boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.18)" }
                : undefined
            }
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
              "flex-1 rounded-[10px] px-3 py-2 font-semibold transition",
              mode === "signup"
                ? "bg-[var(--color-grass-deep)] text-white"
                : "text-[var(--color-muted)]",
            )}
            style={
              mode === "signup"
                ? { boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.18)" }
                : undefined
            }
          >
            Create account
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
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
                ? "Step into the garden →"
                : "Plant your garden →"}
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
