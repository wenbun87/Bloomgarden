import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { WidgetCard } from "@/components/WidgetCard";
import { EmptyState } from "@/components/EmptyState";
import { useFriends } from "@/hooks/useFriends";
import { supabase } from "@/lib/supabase";

type Props = { userId: string };

export default function Friends({ userId }: Props) {
  const { accepted, incoming, outgoing, loading, error, reload } =
    useFriends(userId);
  const [username, setUsername] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function sendRequest(e: React.FormEvent) {
    e.preventDefault();
    const target = username.trim().toLowerCase();
    if (!target) return;
    setSending(true);
    setFeedback(null);

    const { data: match, error: lookupErr } = await supabase
      .from("profile_lookup")
      .select("id, username")
      .eq("username", target)
      .maybeSingle();

    if (lookupErr || !match) {
      setSending(false);
      setFeedback(`No one here goes by "${target}".`);
      return;
    }
    if (match.id === userId) {
      setSending(false);
      setFeedback("You can't befriend yourself.");
      return;
    }

    const { error: insertErr } = await supabase
      .from("friendships")
      .insert({ user_id: userId, friend_id: match.id, status: "pending" });

    setSending(false);
    if (insertErr) {
      setFeedback(
        insertErr.code === "23505"
          ? "You've already got a request going with them."
          : insertErr.message,
      );
      return;
    }
    setUsername("");
    setFeedback(`Request sent to @${target}.`);
    reload();
  }

  async function accept(requesterId: string) {
    const { error: rpcErr } = await supabase.rpc("accept_friend_request", {
      requester: requesterId,
    });
    if (rpcErr) {
      setFeedback(rpcErr.message);
      return;
    }
    reload();
  }

  async function decline(requesterId: string) {
    const { error: delErr } = await supabase
      .from("friendships")
      .delete()
      .eq("user_id", requesterId)
      .eq("friend_id", userId);
    if (delErr) {
      setFeedback(delErr.message);
      return;
    }
    reload();
  }

  async function cancel(friendId: string) {
    const { error: delErr } = await supabase
      .from("friendships")
      .delete()
      .eq("user_id", userId)
      .eq("friend_id", friendId);
    if (delErr) {
      setFeedback(delErr.message);
      return;
    }
    reload();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Friends</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Everything in Bloomgarden is friends-only. Add someone to start.
        </p>
      </div>

      <WidgetCard title="Add a friend">
        <form onSubmit={sendRequest} className="flex items-center gap-2">
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="their username"
            className="flex-1"
          />
          <Button type="submit" disabled={sending || !username.trim()}>
            {sending ? "Sending…" : "Send request"}
          </Button>
        </form>
        {feedback && (
          <p className="mt-3 text-sm text-[var(--color-muted)]">{feedback}</p>
        )}
      </WidgetCard>

      {error && (
        <WidgetCard>
          <p className="text-sm text-red-600">Couldn't load friends: {error}</p>
        </WidgetCard>
      )}

      <WidgetCard title={`Requests${incoming.length ? ` (${incoming.length})` : ""}`}>
        {loading ? (
          <p className="text-sm text-[var(--color-muted)]">Loading…</p>
        ) : incoming.length === 0 ? (
          <EmptyState title="No pending requests" />
        ) : (
          <ul className="space-y-2">
            {incoming.map((edge) => (
              <li
                key={edge.user_id}
                className="flex items-center justify-between gap-3 rounded-pill border border-[var(--color-border)] bg-white/60 px-4 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{edge.profile.display_name}</p>
                  <p className="text-xs text-[var(--color-muted)]">
                    @{edge.profile.username}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" onClick={() => accept(edge.user_id)}>
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => decline(edge.user_id)}
                  >
                    Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </WidgetCard>

      <WidgetCard title={`Friends${accepted.length ? ` (${accepted.length})` : ""}`}>
        {loading ? (
          <p className="text-sm text-[var(--color-muted)]">Loading…</p>
        ) : accepted.length === 0 ? (
          <EmptyState
            title="No friends yet"
            hint="Send a request above — you'll see their garden when they accept."
          />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {accepted.map((edge) => (
              <li key={edge.friend_id}>
                <Link
                  to={`/u/${edge.profile.username}`}
                  className="block rounded-card border border-[var(--color-border)] bg-white/60 px-4 py-3 hover:bg-white"
                >
                  <p className="text-sm font-medium">
                    {edge.profile.display_name}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    @{edge.profile.username}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </WidgetCard>

      {outgoing.length > 0 && (
        <WidgetCard title={`Waiting on (${outgoing.length})`}>
          <ul className="space-y-2">
            {outgoing.map((edge) => (
              <li
                key={edge.friend_id}
                className="flex items-center justify-between gap-3 rounded-pill border border-[var(--color-border)] bg-white/60 px-4 py-2"
              >
                <div>
                  <p className="text-sm">{edge.profile.display_name}</p>
                  <p className="text-xs text-[var(--color-muted)]">
                    @{edge.profile.username}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => cancel(edge.friend_id)}
                >
                  Cancel
                </Button>
              </li>
            ))}
          </ul>
        </WidgetCard>
      )}
    </div>
  );
}
