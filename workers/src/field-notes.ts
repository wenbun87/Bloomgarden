import type { Env } from "./env";
import { adminClient } from "./supabase";
import { groqJson } from "./groq";
import { fetchFeed, type FeedItem } from "./rss";

// Field Notes — weekly longevity/wellness digest from configurable RSS feeds.

type FieldNotesBrief = {
  intro: string;
  bullets: {
    claim: string;
    why_it_matters: string;
    source_url: string;
    source_name: string;
  }[];
  caveat: string;
};

function weekStartUtc(): string {
  const d = new Date();
  const day = d.getUTCDay(); // 0=Sun
  const offset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + offset);
  return monday.toISOString().slice(0, 10);
}

export async function runFieldNotes(env: Env): Promise<void> {
  const supabase = adminClient(env);
  const week = weekStartUtc();

  const { data: existing } = await supabase
    .from("research_briefs")
    .select("week_start")
    .eq("week_start", week)
    .maybeSingle();
  if (existing) {
    console.log(`field-notes: already ran for ${week}`);
    return;
  }

  const { data: feeds } = await supabase
    .from("research_feeds")
    .select("id, url, name")
    .eq("enabled", true);
  if (!feeds || feeds.length === 0) {
    console.log("field-notes: no enabled feeds");
    return;
  }

  // Fetch all feeds in parallel; per-feed failure is logged but doesn't block.
  const results = await Promise.all(
    feeds.map(async (f) => {
      try {
        const items = await fetchFeed(f.url, f.name);
        await supabase
          .from("research_feeds")
          .update({ last_fetched_at: new Date().toISOString() })
          .eq("id", f.id);
        return items;
      } catch (e) {
        console.error(`field-notes: feed failed ${f.name}:`, e);
        return [] as FeedItem[];
      }
    }),
  );

  // Keep only items from the past 8 days (a little slack on the week boundary).
  const cutoff = Date.now() - 8 * 24 * 3600 * 1000;
  const recent = results
    .flat()
    .filter((i) => i.published_at.getTime() >= cutoff)
    .slice(0, 30);  // cap payload size to the LLM

  if (recent.length === 0) {
    console.log("field-notes: no recent items");
    return;
  }

  const digest = await groqJson<FieldNotesBrief>(env, {
    system:
      "You write Field Notes — a weekly digest of longevity and wellness research for Bloomgarden. Tone: a curious naturalist, sober, cited, never prescriptive. Output JSON {intro: string (one sentence), bullets: [{claim: string, why_it_matters: string, source_url: string, source_name: string}] (3-5 bullets), caveat: string (one sentence, starts 'These are research summaries — not medical advice.')}. Only use source_url values that appeared in the input; do NOT invent URLs. Flag conflicting findings when present.",
    user: JSON.stringify({
      week_of: week,
      items: recent.map((i) => ({
        title: i.title,
        summary: i.summary,
        url: i.link,
        source: i.source,
      })),
    }),
    temperature: 0.3,
  });

  await supabase.from("research_briefs").upsert({
    week_start: week,
    summary: digest.intro,
    bullets_json: digest.bullets,
    caveat: digest.caveat,
  });

  console.log(`field-notes: wrote brief for ${week}`);
}
