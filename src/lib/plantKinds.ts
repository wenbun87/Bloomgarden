/* Map DB species slugs to one of 8 PixelPlant kinds based on visual closeness.
   Used by the farm scene to render plants in plots. */

export type PlantKind =
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

const SLUG_TO_KIND: Record<string, PlantKind> = {
  // Direct matches
  tulip: "tulip",
  sunflower: "sunflower",
  lavender: "lavender",
  "cherry-blossom": "cherry",

  // Always-available staples
  daisy: "chamomile",
  basil: "herb",
  "young-oak": "oak",

  // Spring
  magnolia: "rose",
  peony: "rose",

  // Summer
  jasmine: "chamomile",
  bougainvillea: "rose",

  // Autumn
  cosmos: "tulip",
  chrysanthemum: "chamomile",
  "ornamental-kale": "kale",
  "japanese-maple": "cherry",

  // Winter
  poinsettia: "strawberry",
  "winter-berry": "cherry",
  hellebore: "tulip",
  evergreen: "pine",

  // Legendary / heirloom
  "dragon-fruit": "strawberry",
  "wisteria-arch": "lavender",
  "rainbow-rose": "rose",
};

export function plantKindFor(slug: string | undefined | null): PlantKind {
  if (!slug) return "chamomile";
  return SLUG_TO_KIND[slug] ?? "chamomile";
}
