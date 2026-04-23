// Minimal RSS/Atom parser built on regex. Good enough for our weekly digest —
// skips items that fail to parse rather than blowing up the whole pipeline.

export type FeedItem = {
  title: string;
  link: string;
  summary: string;
  published_at: Date;
  source: string;
};

function stripTags(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function pick(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = re.exec(block);
  return match ? match[1] : "";
}

function pickAttr(block: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]+)"`, "i");
  const match = re.exec(block);
  return match ? match[1] : "";
}

export async function fetchFeed(
  url: string,
  sourceName: string,
): Promise<FeedItem[]> {
  const resp = await fetch(url, {
    headers: { "User-Agent": "Bloomgarden/1.0" },
  });
  if (!resp.ok) throw new Error(`${sourceName}: HTTP ${resp.status}`);
  const xml = await resp.text();
  const items: FeedItem[] = [];

  // RSS 2.0: <item>...</item>
  const rssItems = xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi);
  for (const m of rssItems) {
    try {
      const block = m[0];
      const title = stripTags(pick(block, "title"));
      const link = stripTags(pick(block, "link"));
      const desc = stripTags(
        pick(block, "description") || pick(block, "content:encoded"),
      );
      const pub = pick(block, "pubDate") || pick(block, "dc:date");
      if (!title || !link) continue;
      items.push({
        title,
        link,
        summary: desc.slice(0, 500),
        published_at: pub ? new Date(pub) : new Date(),
        source: sourceName,
      });
    } catch {
      // Skip malformed item
    }
  }

  // Atom: <entry>...</entry>
  if (items.length === 0) {
    const atomItems = xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi);
    for (const m of atomItems) {
      try {
        const block = m[0];
        const title = stripTags(pick(block, "title"));
        const link = pickAttr(block, "link", "href") || stripTags(pick(block, "link"));
        const desc = stripTags(pick(block, "summary") || pick(block, "content"));
        const pub = pick(block, "updated") || pick(block, "published");
        if (!title || !link) continue;
        items.push({
          title,
          link,
          summary: desc.slice(0, 500),
          published_at: pub ? new Date(pub) : new Date(),
          source: sourceName,
        });
      } catch {
        // Skip malformed entry
      }
    }
  }

  return items;
}
