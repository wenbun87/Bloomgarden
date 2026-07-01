import { useBriefs } from "@/hooks/useBriefs";
import { ForecastWidget } from "@/widgets/ai/ForecastWidget";
import { GreenhouseWidget } from "@/widgets/ai/GreenhouseWidget";
import { FieldNotesWidget } from "@/widgets/ai/FieldNotesWidget";

export default function Briefs() {
  const { forecast, fieldNotes, portfolio, loading } = useBriefs();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Briefs</h1>
        <p className="page-sub">
          Daily market weather, weekly research from the field, and a shared
          AI-run portfolio that everyone watches.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--color-muted)]">Loading…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ForecastWidget brief={forecast} />
          <GreenhouseWidget portfolio={portfolio} />
          <FieldNotesWidget brief={fieldNotes} className="lg:col-span-2" />
        </div>
      )}
    </div>
  );
}
