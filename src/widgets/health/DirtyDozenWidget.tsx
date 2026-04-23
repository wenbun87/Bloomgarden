import { Apple } from "lucide-react";
import { WidgetCard } from "@/components/WidgetCard";

// EWG's Dirty Dozen — produce with the highest pesticide loads in conventional
// (non-organic) form. Updated yearly by the Environmental Working Group.
// Source: https://www.ewg.org/foodnews/dirty-dozen.php
const DIRTY_DOZEN = [
  "Strawberries",
  "Spinach",
  "Kale / collard & mustard greens",
  "Grapes",
  "Peaches",
  "Pears",
  "Nectarines",
  "Apples",
  "Bell & hot peppers",
  "Cherries",
  "Blueberries",
  "Green beans",
];

type Props = { className?: string };

export function DirtyDozenWidget({ className }: Props) {
  return (
    <WidgetCard
      title="The Dirty Dozen"
      className={className}
      action={<Apple size={14} className="text-[var(--color-muted)]" />}
    >
      <p className="text-sm font-medium text-[var(--color-ink)]">
        Buy these organic, always!
      </p>
      <p className="mt-1 text-xs text-[var(--color-muted)]">
        Produce that consistently carries the highest pesticide residues in
        conventional form (EWG).
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-1 text-xs">
        {DIRTY_DOZEN.map((item, i) => (
          <li
            key={item}
            className="flex items-center gap-2 rounded-pill bg-white/70 px-3 py-1"
          >
            <span className="tabular-nums text-[var(--color-muted)]">
              {i + 1}.
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
