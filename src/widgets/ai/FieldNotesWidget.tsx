import { ExternalLink, Leaf } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";
import { EmptyState } from "@/components/EmptyState";
import type { FieldNotesBrief } from "@/hooks/useBriefs";

type Props = { brief: FieldNotesBrief | null; className?: string };

export function FieldNotesWidget({ brief, className }: Props) {
  if (!brief) {
    return (
      <WidgetCard
        title="Field Notes"
        className={className}
        action={<Leaf size={14} className="text-[var(--color-muted)]" />}
      >
        <EmptyState
          title="No digest yet this week"
          hint="Field Notes arrives on Sundays."
        />
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      title="Field Notes"
      className={className}
      action={
        <span className="text-xs text-[var(--color-muted)]">
          week of {brief.week_start}
        </span>
      }
    >
      <p className="mt-1 text-xs text-[var(--color-muted)]">{brief.summary}</p>
      <ul className="mt-3 space-y-2">
        {brief.bullets_json.map((b, i) => (
          <li
            key={i}
            className="rounded-card border border-[var(--color-border)] bg-white/60 p-3"
          >
            <p className="text-sm font-medium">{b.claim}</p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              {b.why_it_matters}
            </p>
            {b.source_url && (
              <a
                href={b.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--color-accent)] hover:underline"
              >
                <ExternalLink size={10} />
                {b.source_name}
              </a>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[10px] italic text-[var(--color-muted)]">
        {brief.caveat}
      </p>
    </WidgetCard>
  );
}
