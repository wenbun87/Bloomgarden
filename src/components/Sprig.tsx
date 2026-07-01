type SprigVariant = "leaf" | "sprout" | "swirl" | "star" | "vine";

type Props = {
  variant?: SprigVariant;
  size?: number;
  className?: string;
};

export function Sprig({ variant = "leaf", size = 56, className }: Props) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 64 64",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    stroke: "currentColor",
    className,
    "aria-hidden": true,
  } as const;

  switch (variant) {
    case "leaf":
      return (
        <svg {...common}>
          <path
            d="M10 54 C 18 30, 34 14, 56 8 C 50 28, 38 46, 16 56 Z"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M14 50 L 48 16" strokeWidth="1" strokeLinecap="round" />
        </svg>
      );
    case "sprout":
      return (
        <svg {...common}>
          <path
            d="M32 56 V 28"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M32 30 C 22 28, 14 22, 12 12 C 22 14, 30 20, 32 30 Z"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M32 32 C 42 30, 50 24, 52 14 C 42 16, 34 22, 32 32 Z"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "swirl":
      return (
        <svg {...common}>
          <path
            d="M48 32 C 48 23, 41 16, 32 16 C 23 16, 16 23, 16 32 C 16 38, 21 43, 27 43 C 32 43, 36 39, 36 34 C 36 31, 34 29, 31 29"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "star":
      return (
        <svg {...common}>
          <path
            d="M32 12 L 35 28 L 52 32 L 35 36 L 32 52 L 29 36 L 12 32 L 29 28 Z"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "vine":
      return (
        <svg {...common}>
          <path
            d="M8 56 C 16 48, 18 38, 24 32 C 30 26, 38 24, 46 20 C 52 18, 56 14, 58 8"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M22 34 C 18 30, 16 26, 18 22 C 22 24, 24 28, 22 34 Z"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path
            d="M40 22 C 38 18, 38 14, 42 12 C 44 16, 44 20, 40 22 Z"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}
