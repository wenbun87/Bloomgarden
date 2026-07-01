import { Link } from "react-router-dom";
import { PixelPlant } from "@/components/PixelPlant";
import { cn } from "@/lib/utils";

function seasonInfo() {
  const d = new Date();
  const m = d.getMonth();
  let season: "spring" | "summer" | "autumn" | "winter" = "spring";
  if (m <= 1 || m === 11) season = "winter";
  else if (m <= 4) season = "spring";
  else if (m <= 7) season = "summer";
  else season = "autumn";

  const seasonStarts: Record<typeof season, [number, number]> = {
    spring: [2, 1],
    summer: [5, 1],
    autumn: [8, 1],
    winter: [11, 1],
  };
  const [sm, sd] = seasonStarts[season];
  const startDate = new Date(d.getFullYear(), sm, sd);
  if (d < startDate) startDate.setFullYear(d.getFullYear() - 1);
  const dayOfSeason = Math.floor(
    (d.getTime() - startDate.getTime()) / 86_400_000,
  ) + 1;

  return { season, dayOfSeason };
}

const TAGLINES_BY_SEASON: Record<string, string[]> = {
  spring: [
    "The strawberry patch is sprouting.",
    "Soft rain. Things are waking up.",
    "Tulips are pushing through.",
  ],
  summer: [
    "The sunflowers are reaching.",
    "Long days, warm dirt.",
    "Lavender hums with bees.",
  ],
  autumn: [
    "Pumpkins are heavy on the vine.",
    "The light is gold.",
    "Time to harvest what you grew.",
  ],
  winter: [
    "The garden is sleeping.",
    "Plan what you'll plant in spring.",
    "Quiet ground, gathering strength.",
  ],
};

export function HeroStrip() {
  const { season, dayOfSeason } = seasonInfo();
  const taglines = TAGLINES_BY_SEASON[season] ?? TAGLINES_BY_SEASON.spring;
  const idx = dayOfSeason % taglines.length;
  const tagline = taglines[idx];

  const plants: Array<
    "sunflower" | "tulip" | "strawberry" | "lavender" | "chamomile" | "carrot"
  > = ["sunflower", "tulip", "strawberry", "lavender", "chamomile", "carrot"];

  return (
    <div
      className="relative overflow-hidden rounded-[16px] border border-[var(--color-line)]"
      style={{
        minHeight: 220,
        background:
          "linear-gradient(180deg, var(--color-sky) 0%, var(--color-sky) 54%, var(--color-grass) 54%, var(--color-grass) 100%)",
      }}
    >
      {/* Soft sun glow over sky */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 20% 30%, rgba(244,193,82,0.45), transparent 45%)",
        }}
      />

      {/* Sun */}
      <div
        aria-hidden
        className="pointer-events-none absolute h-[44px] w-[44px] sm:h-[50px] sm:w-[50px]"
        style={{
          top: 22,
          right: 24,
          borderRadius: 999,
          background: "var(--color-sun)",
          boxShadow: "0 0 32px var(--color-sun)",
        }}
      />

      {/* Content stack */}
      <div className="relative flex h-full min-h-[220px] flex-col p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/95">
          {season} · day {dayOfSeason}
        </div>

        <h2 className="font-display mt-1 max-w-[200px] text-[22px] font-semibold leading-[1.15] text-white sm:max-w-[300px] sm:text-[26px]">
          {tagline}
        </h2>

        {/* Bottom row: CTA + plants strip share the grass band */}
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <Link
            to="/garden"
            className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-white px-3 py-1.5 text-xs font-bold text-[var(--color-grass-deep)] transition hover:brightness-95"
            style={{ boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.1)" }}
          >
            Visit garden →
          </Link>

          <div className="flex min-w-0 items-end justify-end gap-1.5 overflow-hidden sm:gap-3">
            {plants.map((k, i) => (
              <div
                key={k}
                className={cn(
                  "shrink-0 origin-bottom scale-[0.7] sm:scale-100",
                  i >= 4 && "hidden sm:block",
                )}
              >
                <PixelPlant kind={k} size={64} resolution={4} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
