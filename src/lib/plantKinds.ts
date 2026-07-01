/* Map each DB species slug to its own distinct PixelPlant sprite — no two
   species share a kind. Used by the farm scene, shop, seed bag, profile, etc. */

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

const SLUG_TO_KIND: Record<string, PlantKind> = {
  // Common
  daisy: "chamomile",
  jasmine: "jasmine",
  chrysanthemum: "chrysanthemum",
  cosmos: "cosmos",
  magnolia: "magnolia",
  "ornamental-kale": "kale",
  poinsettia: "poinsettia",
  sunflower: "sunflower",
  tulip: "tulip",
  "winter-berry": "berry",
  basil: "herb",

  // Rare
  bougainvillea: "bougainvillea",
  "cherry-blossom": "cherry",
  evergreen: "pine",
  hellebore: "hellebore",
  "japanese-maple": "maple",
  lavender: "lavender",
  peony: "rose",
  "young-oak": "oak",

  // Heirloom
  "ancient-bonsai": "bonsai",
  moonflower: "moonflower",
  "rainbow-rose": "rainbow",
  "wisteria-tree": "wisteria",

  // Legendary
  "dragon-fruit": "dragonfruit",
  "wisteria-arch": "wisteriaArch",
};

export function plantKindFor(slug: string | undefined | null): PlantKind {
  if (!slug) return "chamomile";
  return SLUG_TO_KIND[slug] ?? "chamomile";
}
