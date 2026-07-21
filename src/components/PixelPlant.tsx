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
  | "kale"
  | "moonflower"
  | "bonsai"
  | "wisteria"
  | "jasmine"
  | "chrysanthemum"
  | "cosmos"
  | "hellebore"
  | "maple"
  | "berry"
  | "magnolia"
  | "bougainvillea"
  | "rainbow"
  | "poinsettia"
  | "dragonfruit"
  | "wisteriaArch";

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
  // Moonflower: pale periwinkle bloom — reads on a white tile, unlike a daisy.
  moonflower: { M: "#c7d1ee", m: "#9fabda", G: "#6a9a3a" },
  // Ancient bonsai: little canopy over a trunk in a terracotta pot.
  bonsai:     { G: "#6a9a3a", g: "#4a7028", B: "#6b4a2a", P: "#c07a44" },
  // Wisteria tree: trunk with a cascading purple canopy.
  wisteria:   { V: "#9c8ac8", v: "#7660a0", B: "#6b4a2a" },
  // Jasmine: pure-white bloom on a green sprig (no yellow eye — that's the daisy).
  jasmine:      { W: "#ffffff", G: "#6a9a3a", g: "#4a7028" },
  // Chrysanthemum: layered amber-gold mum.
  chrysanthemum:{ A: "#e8a838", a: "#b9761a", G: "#6a9a3a" },
  // Cosmos: airy light-pink petals, soft yellow eye.
  cosmos:       { C: "#e6b8d8", Y: "#e8d088", G: "#6a9a3a" },
  // Hellebore: pale green-white winter rose.
  hellebore:    { W: "#eaf0dc", H: "#bcd299", G: "#6a9a3a" },
  // Japanese maple: fiery red-orange foliage on a trunk.
  maple:        { R: "#c8481f", r: "#98330f", B: "#6b4a2a" },
  // Winter berry: red jewels on a green bush.
  berry:        { G: "#4a7028", R: "#c83838", r: "#9c2222" },
  // Magnolia: soft blush-white petals.
  magnolia:     { M: "#f2dade", m: "#dcaab6", G: "#6a9a3a" },
  // Bougainvillea: vivid magenta.
  bougainvillea:{ P: "#c02878", p: "#8c0f4e", G: "#6a9a3a" },
  // Rainbow rose: multi-colour petals.
  rainbow:      { R: "#d94f4f", O: "#e0913a", Y: "#e6cf5a", G: "#5aa04a", B: "#4f7fd0", V: "#9c6fc0" },
  // Poinsettia: red winter bract with a gold centre.
  poinsettia:   { R: "#c62828", Y: "#e8c848", G: "#4a7028" },
  // Dragon fruit: magenta fruit with green scales.
  dragonfruit:  { P: "#d0407a", p: "#a02858", G: "#5aa04a" },
  // Wisteria arch: a purple trellis arch (vs the lavender sprig / wisteria tree).
  wisteriaArch: { V: "#9c8ac8", v: "#7660a0", G: "#6a9a3a" },
};

// All 4×4 sprites are centered within the grid (the shop/seed-bag/farm all
// render at resolution 4). Trees sit on a 2-wide centred trunk; blooms are
// symmetric about the vertical centre.
const grids4: Record<string, string[]> = {
  _growing: [
    "....",
    ".GG.",
    ".GG.",
    "....",
  ],
  strawberry: [
    ".GG.",
    "RRRR",
    "RYYR",
    ".RR.",
  ],
  sunflower: [
    ".YY.",
    "YBBY",
    "YBBY",
    ".YY.",
  ],
  tulip: [
    ".PP.",
    "PPPP",
    "PPPP",
    ".GG.",
  ],
  chamomile: [
    ".WW.",
    "WYYW",
    "WYYW",
    ".WW.",
  ],
  lavender: [
    ".VV.",
    ".VV.",
    ".GG.",
    ".GG.",
  ],
  carrot: [
    ".GG.",
    "CCCC",
    "CCCC",
    ".CC.",
  ],
  pumpkin: [
    ".GG.",
    "PPPP",
    "PPPP",
    ".PP.",
  ],
  cherry: [
    ".GG.",
    "GPPG",
    "GPPG",
    ".BB.",
  ],
  oak: [
    ".GG.",
    "GGGG",
    "GggG",
    ".BB.",
  ],
  herb: [
    ".gg.",
    "gGGg",
    ".GG.",
    ".BB.",
  ],
  pine: [
    ".GG.",
    ".GG.",
    "GGGG",
    ".BB.",
  ],
  rose: [
    ".PP.",
    "PppP",
    "PppP",
    ".GG.",
  ],
  kale: [
    ".GG.",
    "GVvG",
    "GVvG",
    ".GG.",
  ],
  moonflower: [
    ".MM.",
    "MmmM",
    "MmmM",
    ".MM.",
  ],
  bonsai: [
    ".GG.",
    "GGGG",
    ".BB.",
    "PPPP",
  ],
  wisteria: [
    "VVVV",
    "VvvV",
    ".BB.",
    ".VV.",
  ],
  jasmine: [
    ".WW.",
    "WWWW",
    ".WW.",
    ".gg.",
  ],
  chrysanthemum: [
    ".AA.",
    "AaaA",
    "AaaA",
    ".AA.",
  ],
  cosmos: [
    ".CC.",
    "CYYC",
    ".CC.",
    ".G..",
  ],
  hellebore: [
    ".WW.",
    "WHHW",
    "WHHW",
    ".GG.",
  ],
  maple: [
    ".RR.",
    "RRRR",
    "RrrR",
    ".BB.",
  ],
  berry: [
    ".GG.",
    "GRGR",
    "RGRG",
    ".GG.",
  ],
  magnolia: [
    ".MM.",
    "MmmM",
    "MmmM",
    ".GG.",
  ],
  bougainvillea: [
    ".PP.",
    "PppP",
    "PPPP",
    ".GG.",
  ],
  rainbow: [
    "ROYG",
    "OYGB",
    "YGBV",
    ".GG.",
  ],
  poinsettia: [
    ".RR.",
    "RRRR",
    "RYYR",
    ".GG.",
  ],
  dragonfruit: [
    ".GG.",
    "GPPG",
    "PPPP",
    ".PP.",
  ],
  wisteriaArch: [
    "VVVV",
    "V..V",
    "V..V",
    "vGGv",
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
  moonflower: [
    "..MMMM..",
    ".MMmmMM.",
    ".MmmmmM.",
    ".MmmmmM.",
    ".MMmmMM.",
    "..MMMM..",
    "...GG...",
    "........",
  ],
  bonsai: [
    "..GGGG..",
    ".GGGGGG.",
    "GGGgGGGG",
    ".GGGGGG.",
    "...BB...",
    "...BB...",
    ".PPPPPP.",
    "PPPPPPPP",
  ],
  wisteria: [
    ".VVVVVV.",
    "VVvvvvVV",
    "VVvvvvVV",
    "...BB...",
    "..VBBV..",
    ".V.BB.V.",
    "...BB...",
    "........",
  ],
};

// Fixed sprout color for the growing-stage placeholder. Deliberately NOT
// looked up from the per-kind palette — several kinds (wisteria, maple, …)
// have no "G" entry since their ready sprite never needs green, which
// silently blanked the growing sprite for those kinds. A grid that's shared
// across all kinds shouldn't depend on what any one kind's palette contains.
const GROWING_COLOR = "#6a9a3a";

export function PixelPlant({
  kind,
  size = 64,
  stage = "ready",
  resolution = 8,
}: Props) {
  const grids = resolution === 4 ? grids4 : grids8;
  const growing = stage === "growing";
  const grid = growing ? grids._growing : grids[kind] ?? grids.strawberry;
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
          if (ch === ".") return null;
          const fill = growing ? GROWING_COLOR : palette[ch];
          if (!fill) return null;
          return (
            <rect
              key={`${r}-${c}`}
              x={c * cell}
              y={r * cell}
              width={cell + 0.5}
              height={cell + 0.5}
              fill={fill}
            />
          );
        }),
      )}
    </svg>
  );
}
