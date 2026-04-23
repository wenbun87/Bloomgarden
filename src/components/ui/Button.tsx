import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const button = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--color-accent)] text-white hover:brightness-95 shadow-sm",
        soft:
          "bg-[var(--color-accent-soft)] text-[var(--color-ink)] hover:brightness-98",
        ghost: "hover:bg-black/5 text-[var(--color-ink)]",
        outline:
          "border border-[var(--color-border)] bg-white/60 text-[var(--color-ink)] hover:bg-white",
      },
      size: {
        sm: "h-8 px-3 text-sm rounded-pill",
        md: "h-10 px-4 text-sm rounded-pill",
        lg: "h-12 px-6 text-base rounded-pill",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button>;

export const Button = React.forwardRef<HTMLButtonElement, Props>(
  ({ className, variant, size, ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(button({ variant, size }), className)}
      {...rest}
    />
  ),
);
Button.displayName = "Button";
