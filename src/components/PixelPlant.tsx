/* PixelPlant — chunky 4×4 or minimal 8×8 pixel plant sprites.
   Port of the D2 design system spec (claude-design d2-bold). */

type PlantKind =
  | "strawberry"
  | "sunflower"
  | "tulip"
  | "chamomile"
  | "lavender"
  | "carrot"
  | "pumpkin"
  | "cherry"
  | "oak"
  | "herb"
  | "pine"
  | "rose"
  | "kale";

type Stage = "growing" | "ready";

type Props = {
  kind: PlantKind;
  size?: number;
  stage?: Stage;
  /** 4 = chunky stardew icons, 8 = minimal pixel icons. Default 8. */
  resolution?: 4 | 8;
};

const palettes: Record<PlantKind, Record<string, string>> = {
  strawberry: { R: "#c54838", r: "#9c2e22", Y: "#e8d088", G: "#6a9a3a" },
  sunflower:  { Y: "#e8a838", B: "#5a3818", G: "#6a9a3a" },
  tulip:      { P: "#d88a98", p: "#b66478", G: "#6a9a3a" },
  chamomile:  { W: "#ffffff", Y: "#e8a838", G: "#6a9a3a" },
  lavender:   { V: "#9c8ac8", v: "#7660a0", G: "#6a9a3a" },
  carrot:     { C: "#d88438", c: "#a85820", G: "#6a9a3a" },
  pumpkin:    { P: "#d86830", G: "#6a9a3a" },
  cherry:     { G: "#6a9a3a", P: "#e896aa", B: "#5a3818" },
  // Oak: just trunk + canopy. Two greens for a bit of depth.
  oak:        { G: "#6a9a3a", g: "#4a7028", B: "#5a3818" },
  // Basil / leafy herb: bright leaves on a woody stem.
  herb:       { G: "#5a8a2e", g: "#7fae4a", B: "#6b4a2a" },
  // Evergreen conifer: deep tiered green + trunk.
  pine:       { G: "#2f6b3a", g: "#245530", B: "#6b4a2a" },
  // Layered pink bloom (peony / bougainvillea / rainbow rose).
  rose:       { P: "#e07a9a", p: "#c85a7e", G: "#6a9a3a" },
  // Ornamental kale: green outer leaves cupping a purple heart.
  kale:       { V: "#8a5fb0", v: "#6a4590", G: "#6a9a3a" },
};

const grids4: Record<string, string[]> = {
  _growing: [
    "....",
    ".GG.",
    ".GG.",
    "....",
  ],
  strawberry: [
    ".RR.",
    "RRRr",
    "RYYR",
    ".RR.",
  ],
  sunflower: [
    "YYY.",
    "YBY.",
    "YYY.",
    "....",
  ],
  tulip: [
    "..G.",
    "PPp.",
    "PPP.",
    "....",
  ],
  chamomile: [
    ".W..",
    "WYW.",
    ".W..",
    "....",
  ],
  lavender: [
    "VVV.",
    "VvV.",
    "VVV.",
    "....",
  ],
  carrot: [
    "CCc.",
    "CCc.",
    ".C..",
    ".c..",
  ],
  pumpkin: [
    "..G.",
    "PPPP",
    "PPPP",
    ".PP.",
  ],
  cherry: [
    ".GG.",
    "GPPG",
    ".GG.",
    "..B.",
  ],
  oak: [
    ".GG.",
    "GGGG",
    "GggG",
    "..B.",
  ],
  herb: [
    ".GG.",
    "GGGG",
    ".GG.",
    "..B.",
  ],
  pine: [
    "..G.",
    ".GG.",
    "GGGG",
    "..B.",
  ],
  rose: [
    ".PP.",
    "PppP",
    "PPPP",
    ".G..",
  ],
  kale: [
    ".GG.",
    "GVvG",
    "GVVG",
    ".GG.",
  ],
};

const grids8: Record<string, string[]> = {
  _growing: [
    "........",
    "........",
    "........",
    "...GG...",
    "..GGGG..",
    "...GG...",
    "...GG...",
    "........",
  ],
  strawberry: [
    "........",
    ".G....G.",
    ".GG..GG.",
    "..GGGG..",
    ".RRRRRR.",
    "..RRRR..",
    "...RR...",
    "........",
  ],
  sunflower: [
    "........",
    "..YYYY..",
    ".YYBBYY.",
    ".YYBBYY.",
    "..YYYY..",
    "...G....",
    "...G....",
    "........",
  ],
  tulip: [
    "........",
    "........",
    "..PPPP..",
    ".PPPPPP.",
    "..PPPP..",
    "...G....",
    "...G....",
    "........",
  ],
  chamomile: [
    "........",
    ".W....W.",
    "..WYYW..",
    ".WYYYYW.",
    "..WYYW..",
    ".W..G.W.",
    "....G...",
    "........",
  ],
  lavender: [
    "........",
    ".V.V.V..",
    ".V.V.V..",
    ".V.V.V..",
    ".G.G.G..",
    ".G.G.G..",
    ".GGGGG..",
    "........",
  ],
  carrot: [
    "........",
    "..G.G.G.",
    "..GGGGG.",
    "..CCCCC.",
    "...CCC..",
    "....C...",
    "........",
    "........",
  ],
  pumpkin: [
    "........",
    "....G...",
    "...GG...",
    ".PPPPPP.",
    "PPPPPPPP",
    "PPPPPPPP",
    ".PPPPPP.",
    "........",
  ],
  cherry: [
    "..GGGG..",
    ".GGGGGG.",
    "GGPGGPGG",
    "GGGGGGGG",
    ".GGGGGG.",
    "...BB...",
    "...BB...",
    "........",
  ],
  oak: [
    "..GGGG..",
    ".GGgGgG.",
    "GGGGGGGG",
    "GgGGGGgG",
    ".GGGGGG.",
    "...BB...",
    "...BB...",
    "........",
  ],
  herb: [
    "........",
    "..G..G..",
    ".GGGGGG.",
    "gGGGGGGg",
    ".GGGGGG.",
    "...GG...",
    "...B....",
    "...B....",
  ],
  pine: [
    "...G....",
    "..GgG...",
    ".GGgGG..",
    "..GgG...",
    ".GGgGG..",
    "GGGgGGG.",
    "...B....",
    "...B....",
  ],
  rose: [
    "..PPPP..",
    ".PPppPP.",
    ".PppppP.",
    ".PPppPP.",
    "..PPPP..",
    "...G....",
    "..GG....",
    "...G....",
  ],
  kale: [
    "..GGGG..",
    ".GVVVVG.",
    "GVvvvvVG",
    "GVvvvvVG",
    ".GVvvVG.",
    "..GVVG..",
    "...GG...",
    "........",
  ],
};

export function PixelPlant({
  kind,
  size = 64,
  stage = "ready",
  resolution = 8,
}: Props) {
  const grids = resolution === 4 ? grids4 : grids8;
  const grid = stage === "growing" ? grids._growing : grids[kind] ?? grids.strawberry;
  const palette = palettes[kind] ?? palettes.strawberry;
  const dim = resolution === 4 ? 4 : 8;
  const cell = size / dim;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      style={{ overflow: "visible", display: "block" }}
      aria-hidden="true"
    >
      {grid.map((row, r) =>
        [...row].map((ch, c) => {
          if (ch === "." || !palette[ch]) return null;
          return (
            <rect
              key={`${r}-${c}`}
              x={c * cell}
              y={r * cell}
              width={cell + 0.5}
              height={cell + 0.5}
              fill={palette[ch]}
            />
          );
        }),
      )}
    </svg>
  );
}
