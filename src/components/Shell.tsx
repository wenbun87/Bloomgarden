import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Coins,
  Flower2,
  Home,
  LogOut,
  NotebookPen,
  Settings as SettingsIcon,
  Trees,
  Trophy,
  Users,
  Utensils,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCoinBalance } from "@/hooks/useCoinBalance";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";

type Props = { userId: string };

export function Shell({ userId }: Props) {
  const navigate = useNavigate();
  const balance = useCoinBalance(userId);
  const { profile } = useProfile(userId);

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 backdrop-blur-card bg-white/60 border-b border-[var(--color-border)]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <NavLink
            to="/"
            end
            className="shrink-0 text-base font-semibold tracking-tight hover:text-[var(--color-accent)] sm:text-lg"
          >
            Bloomgarden
          </NavLink>
          <nav className="flex-1 -mx-2 overflow-x-auto px-2">
            <div className="flex items-center justify-start gap-1 whitespace-nowrap sm:justify-center">
              <NavTab to="/" icon={<Home size={14} />} label="Dashboard" end />
              <NavTab
                to="/shed"
                icon={<NotebookPen size={14} />}
                label="Shed"
              />
              <NavTab
                to="/kitchen"
                icon={<Utensils size={14} />}
                label="Kitchen"
              />
              <NavTab
                to="/orchard"
                icon={<Trees size={14} />}
                label="Orchard"
              />
              <NavTab to="/garden" icon={<Flower2 size={14} />} label="Garden" />
              <NavTab
                to="/leaderboard"
                icon={<Trophy size={14} />}
                label="Board"
              />
              <NavTab to="/friends" icon={<Users size={14} />} label="Friends" />
            </div>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            {profile?.username ? (
              <NavLink
                to={`/u/${profile.username}`}
                aria-label="My profile"
                className="flex items-center gap-1.5 rounded-pill bg-[var(--color-accent-soft)] px-2.5 py-1 text-sm transition hover:brightness-95"
              >
                <Coins size={13} className="text-[var(--color-accent)]" />
                <span className="tabular-nums font-medium">{balance ?? 0}</span>
              </NavLink>
            ) : (
              <div className="flex items-center gap-1.5 rounded-pill bg-[var(--color-accent-soft)] px-2.5 py-1 text-sm">
                <Coins size={13} className="text-[var(--color-accent)]" />
                <span className="tabular-nums font-medium">{balance ?? 0}</span>
              </div>
            )}
            <NavLink
              to="/settings"
              aria-label="Settings"
              className={({ isActive }) =>
                cn(
                  "flex h-8 w-8 items-center justify-center rounded-pill transition",
                  isActive
                    ? "bg-white text-[var(--color-ink)] shadow-sm"
                    : "text-[var(--color-muted)] hover:text-[var(--color-ink)]",
                )
              }
            >
              <SettingsIcon size={14} />
            </NavLink>
            <button
              onClick={signOut}
              aria-label="Sign out"
              className="flex h-8 w-8 items-center justify-center rounded-pill text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

function NavTab({
  to,
  icon,
  label,
  end,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-sm transition",
          isActive
            ? "bg-white text-[var(--color-ink)] shadow-sm"
            : "text-[var(--color-muted)] hover:text-[var(--color-ink)]",
        )
      }
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </NavLink>
  );
}
