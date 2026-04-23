import { useBriefs } from "@/hooks/useBriefs";
import { useAccounts } from "@/hooks/useAccounts";
import { useWishlist } from "@/hooks/useWishlist";
import { useHiddenWidgets } from "@/hooks/useHiddenWidgets";
import { NetWorthWidget } from "@/widgets/stats/NetWorthWidget";
import { WishlistWidget } from "@/widgets/stats/WishlistWidget";
import { ForecastWidget } from "@/widgets/ai/ForecastWidget";
import { GreenhouseWidget } from "@/widgets/ai/GreenhouseWidget";

type Props = { userId: string };

export default function Wealth({ userId }: Props) {
  const { forecast, portfolio, loading } = useBriefs();
  const accountsState = useAccounts(userId);
  const wishlist = useWishlist(userId);
  const widgets = useHiddenWidgets(userId);
  const h = widgets.hidden;

  const showWishlist = !h.has("orchard:wishlist");
  const showForecast = !h.has("orchard:forecast");
  const showGreenhouse = !h.has("orchard:greenhouse");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Orchard</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Your net worth over time, a daily market forecast, and a shared
          AI-tended portfolio everyone watches together.
        </p>
      </div>

      <div className={showWishlist ? "grid gap-4 lg:grid-cols-2" : ""}>
        <NetWorthWidget
          userId={userId}
          accounts={accountsState.accounts}
          history={accountsState.history}
          onChanged={accountsState.reload}
        />
        {showWishlist && (
          <WishlistWidget
            userId={userId}
            items={wishlist.items}
            onChanged={wishlist.reload}
          />
        )}
      </div>

      {(showForecast || showGreenhouse) &&
        (loading ? (
          <p className="text-sm text-[var(--color-muted)]">Loading…</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {showForecast && <ForecastWidget brief={forecast} />}
            {showGreenhouse && <GreenhouseWidget portfolio={portfolio} />}
          </div>
        ))}
    </div>
  );
}
