import { useState } from "react";
import { Mail, PenSquare } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { EmptyState } from "@/components/EmptyState";
import { PixelPlant } from "@/components/PixelPlant";
import { plantKindFor } from "@/lib/plantKinds";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { formatDistanceToNow } from "date-fns";
import type { Message } from "@/hooks/useMessages";
import { SendMessageDialog } from "./SendMessageDialog";
import { cn } from "@/lib/utils";

type Props = {
  userId: string;
  inbox: Message[];
  unreadCount: number;
  coinBalance: number;
  lifetimeCoins: number;
  onChanged: () => void;
  className?: string;
};

export function MailboxWidget({
  userId,
  inbox,
  unreadCount,
  coinBalance,
  lifetimeCoins,
  onChanged,
  className,
}: Props) {
  const [composing, setComposing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  async function open(m: Message) {
    setOpenId(openId === m.id ? null : m.id);
    if (!m.read_at) {
      await supabase.rpc("mark_message_read", { message_id_in: m.id });
      onChanged();
    }
  }

  return (
    <WidgetCard
      title="Mailbox"
      className={className}
      action={
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="flex items-center gap-1 rounded-pill bg-[var(--color-accent)] px-2 py-0.5 text-[10px] font-medium text-white">
              <Mail size={10} />
              {unreadCount} new
            </span>
          )}
          <button
            type="button"
            onClick={() => setComposing((v) => !v)}
            className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:brightness-90"
          >
            <PenSquare size={12} />
            {composing ? "Close" : "Send"}
          </button>
        </div>
      }
    >
      {composing && (
        <SendMessageDialog
          userId={userId}
          coinBalance={coinBalance}
          lifetimeCoins={lifetimeCoins}
          onCancel={() => setComposing(false)}
          onSent={() => {
            setComposing(false);
            onChanged();
          }}
        />
      )}

      {inbox.length === 0 && !composing ? (
        <EmptyState
          title="No messages yet"
          hint="Send a friend a seed or a note to start a garden thread."
          action={
            <Button size="sm" variant="soft" onClick={() => setComposing(true)}>
              <PenSquare size={11} />
              Write one
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {inbox.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => open(m)}
                className={cn(
                  "w-full py-2 text-left",
                  !m.read_at && "bg-[var(--color-accent-soft)]/30",
                )}
              >
                <div className="flex items-center gap-2 px-2">
                  {m.species && (
                    <PixelPlant
                      kind={plantKindFor(m.species.slug)}
                      size={22}
                      resolution={4}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 text-sm">
                      <span
                        className={cn(
                          !m.read_at && "font-semibold",
                        )}
                      >
                        {m.sender.display_name}
                      </span>
                      {m.species && (
                        <span className="text-[10px] text-[var(--color-muted)]">
                          sent a {m.species.name} seed
                        </span>
                      )}
                    </p>
                    {m.body && (
                      <p className="truncate text-xs text-[var(--color-muted)]">
                        {m.body}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-[var(--color-muted)]">
                    {formatDistanceToNow(new Date(m.created_at), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                {openId === m.id && m.body && (
                  <div className="mt-2 px-2 pb-2 text-sm leading-relaxed">
                    {m.body}
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

    </WidgetCard>
  );
}
