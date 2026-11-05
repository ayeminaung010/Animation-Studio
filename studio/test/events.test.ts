import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { REPO } from "../server/paths.ts";
import { toJobEvents, toolSummary } from "../server/events.ts";
import { assistantWithToolAndText, init, resultMaxTurns, resultSuccess } from "./fixtures/sdk-messages.ts";

test("init yields the session id only", () => {
  assert.deepEqual(toJobEvents(init, 5), { events: [], sessionId: "sess-1" });
});

test("assistant text and tool calls become events", () => {
  const m = toJobEvents(assistantWithToolAndText, 5);
  assert.deepEqual(m.events, [
    { t: 5, kind: "text", text: "Writing the treatment." },
    { t: 5, kind: "tool", name: "Bash", summary: "npm run stills -- rain-cat" },
  ]);
});

test("success and failure results", () => {
  assert.deepEqual(toJobEvents(resultSuccess, 9).result, { ok: true, costUsd: 0.42, turns: 12, message: "Plan ready." });
  assert.equal(toJobEvents(resultMaxTurns, 9).result!.ok, false);
  assert.match(toJobEvents(resultMaxTurns, 9).result!.message, /max_turns|turns/);
});

test("tool summaries are short and repo-relative", () => {
  assert.equal(toolSummary("Read", { file_path: path.join(REPO, "src/Root.tsx") }), "src/Root.tsx");
  assert.equal(toolSummary("Bash", { command: "a".repeat(300) }).length, 120);
  assert.equal(toolSummary("Glob", {}), "Glob");
});
