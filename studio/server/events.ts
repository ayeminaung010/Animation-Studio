import path from "node:path";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { REPO } from "./paths.ts";
import type { JobEvent } from "./types.ts";

export interface Mapped {
  events: JobEvent[];
  sessionId?: string;
  result?: { ok: boolean; costUsd: number; turns: number; message: string };
}

const MAX_SUMMARY = 120;

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function repoRelative(file: string): string {
  if (!path.isAbsolute(file)) return file;
  const rel = path.relative(REPO, file);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) return file;
  return rel;
}

export function toolSummary(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case "Bash": {
      const command = str(input.command);
      return command ? command.split("\n")[0].slice(0, MAX_SUMMARY) : name;
    }
    case "Read":
    case "Write":
    case "Edit": {
      const file = str(input.file_path);
      return file ? repoRelative(file) : name;
    }
    case "Skill":
      return str(input.skill) ?? str(input.command) ?? name;
    default:
      return name;
  }
}

export function toJobEvents(msg: SDKMessage, now: number): Mapped {
  if (msg.type === "system") {
    if (msg.subtype === "init") return { events: [], sessionId: msg.session_id };
    return { events: [] };
  }

  if (msg.type === "assistant") {
    const events: JobEvent[] = [];
    const content: unknown = msg.message?.content;
    if (!Array.isArray(content)) return { events };
    for (const block of content as Array<Record<string, unknown>>) {
      if (block.type === "text") {
        const text = typeof block.text === "string" ? block.text.trim() : "";
        if (text) events.push({ t: now, kind: "text", text });
      } else if (block.type === "tool_use") {
        const name = typeof block.name === "string" ? block.name : "tool";
        const input =
          block.input && typeof block.input === "object" ? (block.input as Record<string, unknown>) : {};
        events.push({ t: now, kind: "tool", name, summary: toolSummary(name, input) });
      }
    }
    return { events };
  }

  if (msg.type === "result") {
    const costUsd = msg.total_cost_usd;
    const turns = msg.num_turns;
    let ok: boolean;
    let message: string;
    if (msg.subtype === "success") {
      ok = !msg.is_error;
      message = msg.result;
    } else {
      ok = false;
      message = (msg.errors ?? []).join("\n") || msg.subtype;
    }
    return {
      events: [{ t: now, kind: "result", ok, costUsd, turns, message }],
      result: { ok, costUsd, turns, message },
    };
  }

  return { events: [] };
}
