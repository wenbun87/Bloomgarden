import { useProfile } from "@/hooks/useProfile";
import { useGarden } from "@/hooks/useGarden";
import { useMessages } from "@/hooks/useMessages";
import { FarmScene } from "@/widgets/garden/FarmScene";
import { SeedBag } from "@/widgets/garden/SeedBag";
import { DisplayWall } from "@/widgets/garden/DisplayWall";
import { ShopWidget } from "@/widgets/economy/ShopWidget";
import { MailboxWidget } from "@/widgets/social/MailboxWidget";
import { useHiddenWidgets } from "@/hooks/useHiddenWidgets";
import { currentUtcSeason } from "@/lib/dates";

type Props = { userId: string };

export default function Garden({ userId }: Props) {
  const { profile, reload: reloadProfile } = useProfile(userId);
  const garden = useGarden(userId);
  const messages = useMessages(userId);
  const widgets = useHiddenWidgets(userId);

  function reloadAll() {
    reloadProfile();
    garden.reload();
    messages.reload();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Garden</h1>
        <p className="page-sub">
          Plant seeds with earned coins. Keep them for display or sell for more.
        </p>
      </div>

      <FarmScene
        plotCount={garden.plotCount}
        plantingsByPlot={garden.plantingsByPlot}
        seeds={garden.seeds}
        onChanged={reloadAll}
      />

      <DisplayWall displayed={garden.displayed} onChanged={reloadAll} />

      <SeedBag seeds={garden.seeds} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ShopWidget
          species={garden.species}
          coinBalance={profile?.coin_balance ?? 0}
          lifetimeCoins={profile?.lifetime_coins ?? 0}
          plotCount={garden.plotCount}
          currentSeason={currentUtcSeason()}
          onChanged={reloadAll}
        />
        {!widgets.hidden.has("garden:mailbox") && (
          <MailboxWidget
            userId={userId}
            inbox={messages.inbox}
            unreadCount={messages.unreadCount}
            coinBalance={profile?.coin_balance ?? 0}
            lifetimeCoins={profile?.lifetime_coins ?? 0}
            onChanged={reloadAll}
          />
        )}
      </div>
    </div>
  );
}
