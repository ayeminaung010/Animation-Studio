import { query as sdkQuery } from "@anthropic-ai/claude-agent-sdk";
import { listLemoStyles } from "./engines.ts";
import type { LemoStyle } from "./engines.ts";
import { REPO } from "./paths.ts";
import type { Engine } from "./types.ts";

export type QueryFn = typeof import("@anthropic-ai/claude-agent-sdk").query;

export interface Suggestion {
  engine: Engine;
  style?: string;
  reason: string;
}

const NOT_USABLE = "suggestion was not usable";

function systemPrompt(styles: LemoStyle[]): string {
  return [
    "You pick the animation engine (and, for lemo, the visual style) for a short narrated video idea.",
    "Engines:",
    "- remotion: 3D Twist Shorts, character twist stories in stylized toon 3D.",
    "- lemo: Lemo 2D, illustrated, print, paper, ink, data and map styles.",
    "Lemo styles (slug — name: line):",
    ...styles.map((s) => `${s.slug} — ${s.name}: ${s.line}`),
    'Reply with only JSON: {"engine":"remotion"|"lemo","style":"<slug or omit>","reason":"<one sentence>"}',
  ].join("\n");
}

function parseReply(text: string): Record<string, unknown> {
  const candidates: string[] = [];
  const lazy = /\{[\s\S]*?\}/.exec(text);
  if (lazy) candidates.push(lazy[0]);
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1));
  for (const c of candidates) {
    try {
      const v: unknown = JSON.parse(c);
      if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
    } catch {
      // try the next candidate
    }
  }
  throw new Error(NOT_USABLE);
}

export function makeSuggest(
  query: QueryFn = sdkQuery,
  listStyles: () => LemoStyle[] = listLemoStyles,
): (idea: string) => Promise<Suggestion> {
  return async (idea) => {
    const styles = listStyles();
    const run = query({
      prompt: `Idea: ${idea}`,
      options: {
        cwd: REPO,
        maxTurns: 1,
        tools: [],
        allowedTools: [],
        settingSources: [],
        persistSession: false,
        systemPrompt: systemPrompt(styles),
        canUseTool: async () => ({ behavior: "deny", message: "No tools are available for this request." }),
      },
    });

    let text: string | undefined;
    for await (const msg of run) {
      if (msg.type === "result" && msg.subtype === "success") text = msg.result;
    }
    if (text === undefined) throw new Error(NOT_USABLE);

    const j = parseReply(text);
    const reason = typeof j.reason === "string" ? j.reason : "";
    if (j.engine === "remotion") return { engine: "remotion", reason };
    if (j.engine === "lemo") {
      if (typeof j.style !== "string" || !styles.some((s) => s.slug === j.style)) throw new Error(NOT_USABLE);
      return { engine: "lemo", style: j.style, reason };
    }
    throw new Error(NOT_USABLE);
  };
}
