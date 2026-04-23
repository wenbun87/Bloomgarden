// Open Food Facts client + heuristics. Proxies through the Worker's
// /food/search endpoint so it bypasses browser/extension blocks on OFF.

// Hand-curated list of ingredients to flag. Matches are case-insensitive
// substring checks against ingredients_text. Deliberately opinionated —
// tweaks live here, not in a table.
export const CONCERNING_INGREDIENTS: { term: string; label: string; why: string }[] = [
  { term: "palm oil", label: "palm oil", why: "Seed/tropical oil + deforestation impact" },
  { term: "palm kernel", label: "palm kernel oil", why: "Seed/tropical oil" },
  { term: "soybean oil", label: "soybean oil", why: "Industrial seed oil" },
  { term: "corn oil", label: "corn oil", why: "Industrial seed oil" },
  { term: "canola oil", label: "canola oil", why: "Industrial seed oil" },
  { term: "rapeseed oil", label: "rapeseed oil", why: "Industrial seed oil" },
  { term: "cottonseed oil", label: "cottonseed oil", why: "Industrial seed oil" },
  { term: "sunflower oil", label: "sunflower oil", why: "Industrial seed oil (often refined)" },
  { term: "safflower oil", label: "safflower oil", why: "Industrial seed oil (often refined)" },
  { term: "rice bran oil", label: "rice bran oil", why: "Industrial seed oil" },
  { term: "high fructose corn syrup", label: "HFCS", why: "Highly processed sweetener" },
  { term: "glucose-fructose syrup", label: "glucose-fructose syrup", why: "Highly processed sweetener" },
  { term: "corn syrup", label: "corn syrup", why: "Highly processed sweetener" },
  { term: "sodium nitrite", label: "sodium nitrite", why: "Preservative — IARC group 2A when cured" },
  { term: "sodium nitrate", label: "sodium nitrate", why: "Preservative" },
  { term: "bha", label: "BHA", why: "Preservative — IARC group 2B" },
  { term: "bht", label: "BHT", why: "Preservative" },
  { term: "tbhq", label: "TBHQ", why: "Preservative" },
  { term: "red 40", label: "Red 40", why: "Artificial color" },
  { term: "yellow 5", label: "Yellow 5", why: "Artificial color" },
  { term: "yellow 6", label: "Yellow 6", why: "Artificial color" },
  { term: "blue 1", label: "Blue 1", why: "Artificial color" },
  { term: "aspartame", label: "aspartame", why: "Artificial sweetener" },
  { term: "sucralose", label: "sucralose", why: "Artificial sweetener" },
  { term: "acesulfame", label: "acesulfame potassium", why: "Artificial sweetener" },
  { term: "carrageenan", label: "carrageenan", why: "Emulsifier — inflammation concerns in some studies" },
  { term: "polysorbate 80", label: "polysorbate 80", why: "Emulsifier" },
  { term: "mono- and diglycerides", label: "mono- and diglycerides", why: "Emulsifier" },
];

export type OffProduct = {
  code: string;
  product_name: string;
  brands: string;
  nutriscore_grade?: string;
  nova_group?: number;
  ecoscore_grade?: string;
  ingredients_text?: string;
  packaging_materials_tags?: string[];
  serving_size?: string;               // e.g. "30 g", "1 slice (25g)"
  serving_quantity?: string | number;  // numeric grams per serving, when parsed
  nutriments?: {
    "energy-kcal_100g"?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
  };
};

export function servingGrams(p: OffProduct): number | null {
  const raw = p.serving_quantity;
  if (raw == null) return null;
  const n = typeof raw === "number" ? raw : parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type FlaggedIngredient = { label: string; why: string };

export function flagIngredients(text: string | undefined): FlaggedIngredient[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const hits: FlaggedIngredient[] = [];
  const seen = new Set<string>();
  for (const rule of CONCERNING_INGREDIENTS) {
    if (lower.includes(rule.term) && !seen.has(rule.label)) {
      hits.push({ label: rule.label, why: rule.why });
      seen.add(rule.label);
    }
  }
  return hits;
}

// Product is "useful" if it has a name of reasonable length and at least
// calorie data. OFF returns a lot of partial entries that aren't worth showing.
function isUsefulProduct(p: OffProduct): boolean {
  const name = (p.product_name ?? "").trim();
  if (name.length < 2) return false;
  const kcal = p.nutriments?.["energy-kcal_100g"];
  if (kcal == null) return false;
  return true;
}

async function fetchOff(query: string, limit: number): Promise<OffProduct[]> {
  // Routes through your Cloudflare Worker — bypasses browser/extension blocks
  // on openfoodfacts.org and caches the response in KV for 6 hours.
  const url = new URL(`${import.meta.env.VITE_WORKER_URL}/food/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(limit));

  const resp = await fetch(url.toString());
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Food search: HTTP ${resp.status} ${body.slice(0, 200)}`);
  }
  const data = (await resp.json()) as { products?: OffProduct[]; error?: string };
  if (data.error) throw new Error(data.error);
  return (data.products ?? []).filter(isUsefulProduct);
}

// Open Food Facts' search can error or return 0 for long multi-word queries.
// Fall back to progressively shorter queries; any per-attempt error is caught
// so we keep trying. Only the final "nothing worked" throws.
export async function searchProducts(
  query: string,
  limit = 12,
): Promise<OffProduct[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const words = trimmed.split(/\s+/);
  const attempts: string[] = [trimmed];
  if (words.length > 2) attempts.push(words.slice(0, 2).join(" "));
  if (words.length > 1) attempts.push(words[0]);

  let lastError: unknown = null;
  for (const q of attempts) {
    try {
      const hits = await fetchOff(q, limit);
      if (hits.length > 0) return hits;
    } catch (err) {
      lastError = err;
      console.warn("OFF attempt failed:", q, err);
    }
  }
  if (lastError) throw lastError;
  return [];
}

export function caloriesPer100g(p: OffProduct): number {
  return p.nutriments?.["energy-kcal_100g"] ?? 0;
}

export function macrosPer100g(p: OffProduct) {
  return {
    calories: p.nutriments?.["energy-kcal_100g"] ?? 0,
    protein_g: p.nutriments?.proteins_100g ?? 0,
    carbs_g: p.nutriments?.carbohydrates_100g ?? 0,
    fat_g: p.nutriments?.fat_100g ?? 0,
  };
}
