import type { Env } from "./env";

// Groq uses an OpenAI-compatible chat-completions API. JSON mode is opt-in.
// Model choice: llama-3.3-70b-versatile balances quality + free-tier speed.
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function groqJson<T>(
  env: Env,
  opts: {
    system: string;
    user: string;
    model?: string;
    temperature?: number;
    retries?: number;
  },
): Promise<T> {
  const body = {
    model: opts.model ?? DEFAULT_MODEL,
    temperature: opts.temperature ?? 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ] satisfies ChatMessage[],
  };

  const retries = opts.retries ?? 2;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`groq ${resp.status}: ${text.slice(0, 500)}`);
      }
      const data = (await resp.json()) as {
        choices: { message: { content: string } }[];
      };
      const raw = data.choices[0]?.message.content;
      if (!raw) throw new Error("groq: empty response");
      return JSON.parse(raw) as T;
    } catch (err) {
      lastErr = err;
      // Exponential backoff on failure: 500ms, 1500ms, 4500ms
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * 3 ** attempt));
      }
    }
  }
  throw lastErr;
}
