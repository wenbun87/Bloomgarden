import { Navigate, Route, Routes } from "react-router-dom";
import { useSession } from "@/hooks/useSession";
import { useProfile } from "@/hooks/useProfile";
import { Shell } from "@/components/Shell";
import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import Shed from "@/pages/Shed";
import Garden from "@/pages/Garden";
import Leaderboard from "@/pages/Leaderboard";
import Health from "@/pages/Health";
import Wealth from "@/pages/Wealth";
import Friends from "@/pages/Friends";
import Profile from "@/pages/Profile";
import SettingsPage from "@/pages/Settings";

export default function App() {
  const { session, loading } = useSession();
  const userId = session?.user.id;
  const { profile, loading: profileLoading, reload } = useProfile(userId);

  if (loading) return <FullPageStatus>Loading…</FullPageStatus>;

  if (!session) {
    return (
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  if (profileLoading) return <FullPageStatus>Loading…</FullPageStatus>;

  // Fresh sign-up: the trigger created a profile with a placeholder username.
  // Route to onboarding until they pick a real one.
  const needsOnboarding = !profile || profile.username.startsWith("u_");
  if (needsOnboarding) {
    return (
      <Routes>
        <Route
          path="*"
          element={<Onboarding userId={session.user.id} onDone={reload} />}
        />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/auth/callback" element={<Navigate to="/" replace />} />
      <Route element={<Shell userId={session.user.id} />}>
        <Route index element={<Dashboard />} />
        <Route path="shed" element={<Shed userId={session.user.id} />} />
        <Route path="garden" element={<Garden userId={session.user.id} />} />
        <Route
          path="leaderboard"
          element={<Leaderboard userId={session.user.id} />}
        />
        <Route path="kitchen" element={<Health userId={session.user.id} />} />
        <Route path="orchard" element={<Wealth userId={session.user.id} />} />
        <Route path="health" element={<Navigate to="/kitchen" replace />} />
        <Route path="wealth" element={<Navigate to="/orchard" replace />} />
        <Route path="briefs" element={<Navigate to="/kitchen" replace />} />
        <Route
          path="friends"
          element={<Friends userId={session.user.id} />}
        />
        <Route
          path="settings"
          element={<SettingsPage userId={session.user.id} />}
        />
        <Route path="u/:username" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function FullPageStatus({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-[var(--color-muted)]">{children}</p>
    </div>
  );
}
