import { Sprig } from "./Sprig";

type Props = {
  /** Optional italic label rendered between the dashed lines. */
  label?: string;
  className?: string;
};

export function SprigRule({ label, className = "" }: Props) {
  return (
    <div
      className={`flex items-center gap-3 py-2 text-[var(--color-mute)] ${className}`}
    >
      <span
        aria-hidden
        className="h-px flex-1"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--color-line) 50%, transparent 0%)",
          backgroundSize: "8px 1px",
          backgroundRepeat: "repeat-x",
        }}
      />
      {label ? (
        <span className="font-display text-sm italic text-[var(--color-grass)]">
          {label}
        </span>
      ) : (
        <Sprig
          variant="leaf"
          size={16}
          className="text-[var(--color-grass)]"
        />
      )}
      <span
        aria-hidden
        className="h-px flex-1"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--color-line) 50%, transparent 0%)",
          backgroundSize: "8px 1px",
          backgroundRepeat: "repeat-x",
        }}
      />
    </div>
  );
}
