import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Coins,
  Flower2,
  Home,
  LogOut,
  Menu,
  NotebookPen,
  Scissors,
  Settings as SettingsIcon,
  Trees,
  Trophy,
  Users,
  Utensils,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCoinBalance } from "@/hooks/useCoinBalance";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";

type Props = { userId: string };

function currentSeason(): string {
  const m = new Date().getMonth();
  if (m <= 1 || m === 11) return "winter";
  if (m <= 4) return "spring";
  if (m <= 7) return "summer";
  return "autumn";
}

function weekOfYear(): number {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = (d.getTime() - start.getTime()) / 86400000;
  return Math.ceil((diff + start.getDay() + 1) / 7);
}

function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center rounded-[10px] bg-[var(--color-grass)] text-white"
      style={{
        width: size,
        height: size,
        boxShadow: "inset 0 -2px 0 var(--color-grass-deep)",
      }}
    >
      <svg
        width={size * 0.55}
        height={size * 0.55}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      >
        <path d="M12 2v20M6 8c0-3 3-5 6-5M18 8c0-3-3-5-6-5M6 15c0 4 3 6 6 6M18 15c0 4-3 6-6 6" />
      </svg>
    </span>
  );
}

export function Shell({ userId }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const balance = useCoinBalance(userId);
  const { profile } = useProfile(userId);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  const initials =
    profile?.display_name
      ?.split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ?? "·";

  const sidebar = (
    <>
      <NavLink
        to="/"
        end
        className="flex items-center gap-2.5 px-2 pb-4 hover:opacity-90"
      >
        <BrandMark />
        <div className="leading-tight">
          <div className="font-display text-[17px] font-bold leading-none">
            Bloomgarden
          </div>
          <div className="mt-1 text-[10px] capitalize text-[var(--color-muted)]">
            {currentSeason()} · week {weekOfYear()}
          </div>
        </div>
      </NavLink>

      <nav className="flex flex-col gap-0.5">
        <NavRow to="/" icon={<Home size={16} />} label="Dashboard" end />
        <NavRow to="/garden" icon={<Flower2 size={16} />} label="Garden" />
        <NavRow to="/pruning" icon={<Scissors size={16} />} label="Pruning" />
        <NavRow to="/shed" icon={<NotebookPen size={16} />} label="Shed" />
        <NavRow to="/kitchen" icon={<Utensils size={16} />} label="Kitchen" />
        <NavRow to="/orchard" icon={<Trees size={16} />} label="Orchard" />
        <NavRow to="/leaderboard" icon={<Trophy size={16} />} label="Leaderboard" />
        <NavRow to="/friends" icon={<Users size={16} />} label="Friends" />
        <NavRow to="/calendar" icon={<CalendarDays size={16} />} label="Calendar" />
      </nav>

      <div className="mt-auto flex flex-col gap-2 pt-3">
        {/* Coin card — cream with chunky border, lifetime sub */}
        {profile?.username ? (
          <NavLink
            to={`/u/${profile.username}`}
            className="block rounded-[12px] border border-[var(--color-line)] bg-[var(--color-cream)] px-3 py-2.5 transition hover:brightness-[0.98]"
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Coins size={13} className="text-[var(--color-accent)]" />
              <span className="tabular-nums">{balance ?? 0}</span>
              <span className="text-[10px] font-normal text-[var(--color-muted)]">
                coins
              </span>
            </div>
            <div className="mt-0.5 text-[10px] text-[var(--color-muted)]">
              lifetime {profile.lifetime_coins ?? 0}
            </div>
          </NavLink>
        ) : (
          <div className="rounded-[12px] border border-[var(--color-line)] bg-[var(--color-cream)] px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Coins size={13} className="text-[var(--color-accent)]" />
              <span className="tabular-nums">{balance ?? 0}</span>
              <span className="text-[10px] font-normal text-[var(--color-muted)]">
                coins
              </span>
            </div>
          </div>
        )}

        {/* Avatar profile row + settings + sign out */}
        <div className="flex items-center gap-2.5 px-2 py-2">
          <NavLink
            to={profile?.username ? `/u/${profile.username}` : "/settings"}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[11px] font-bold text-white"
            style={{ boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.15)" }}
          >
            {initials}
          </NavLink>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-xs font-semibold">
              {profile?.display_name ?? "Loading…"}
            </div>
            <div className="truncate text-[10px] text-[var(--color-muted)]">
              {profile?.username ? `@${profile.username}` : ""}
            </div>
          </div>
          <NavLink
            to="/settings"
            aria-label="Settings"
            className={({ isActive }) =>
              cn(
                "flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-muted)] transition",
                isActive
                  ? "bg-[var(--color-grass-deep)] text-white"
                  : "hover:bg-[rgba(40,30,20,0.06)] hover:text-[var(--color-ink)]",
              )
            }
          >
            <SettingsIcon size={14} />
          </NavLink>
          <button
            onClick={signOut}
            aria-label="Sign out"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-muted)] hover:bg-[rgba(40,30,20,0.06)] hover:text-[var(--color-ink)]"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[220px_1fr]">
      {/* Mobile topbar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-3 lg:hidden">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-md text-[var(--color-ink)] hover:bg-[rgba(40,30,20,0.06)]"
        >
          <Menu size={18} />
        </button>
        <NavLink
          to="/"
          end
          className="flex items-center gap-2 font-display text-base font-bold tracking-tight"
        >
          <BrandMark size={26} />
          Bloomgarden
        </NavLink>
        <NavLink
          to={profile?.username ? `/u/${profile.username}` : "/settings"}
          className="flex items-center gap-1.5 rounded-pill bg-[var(--color-cream)] px-2.5 py-1 text-sm"
          style={{ boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.06)" }}
        >
          <Coins size={13} className="text-[var(--color-accent)]" />
          <span className="tabular-nums font-semibold">{balance ?? 0}</span>
        </NavLink>
      </header>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-[var(--color-line)] bg-[var(--color-paper)] p-4 lg:flex">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-[rgba(30,22,15,0.4)] backdrop-blur-sm lg:hidden"
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            className="fixed inset-y-0 left-0 z-50 flex w-[min(280px,84vw)] flex-col border-r border-[var(--color-line)] bg-[var(--color-paper)] p-4 shadow-2xl lg:hidden"
            style={{
              animation: "drawerIn 0.28s cubic-bezier(0.2,0.8,0.2,1) both",
            }}
          >
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-md text-[var(--color-muted)] hover:bg-[rgba(40,30,20,0.06)] hover:text-[var(--color-ink)]"
            >
              <X size={16} />
            </button>
            {sidebar}
          </aside>
        </>
      )}

      <main className="mx-auto w-full max-w-[1200px] px-4 py-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}

function NavRow({
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
          "flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] transition",
          isActive
            ? "bg-[var(--color-grass-deep)] font-semibold text-white"
            : "font-medium text-[var(--color-ink)] hover:bg-[rgba(40,30,20,0.04)]",
        )
      }
      style={({ isActive }) =>
        isActive
          ? { boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.18)" }
          : undefined
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}
