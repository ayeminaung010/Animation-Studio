import { test } from "node:test";
import assert from "node:assert/strict";
import { makeSuggest } from "../server/suggest.ts";
import type { QueryFn } from "../server/suggest.ts";
import type { LemoStyle } from "../server/engines.ts";
import { resultSuccess, resultMaxTurns } from "./fixtures/sdk-messages.ts";

const styles: LemoStyle[] = [
  { slug: "ink-wash", name: "Ink Wash", category: "Ink", line: "brush and water", uses: [] },
  { slug: "paper-cut", name: "Paper Cut", category: "Paper", line: "layered paper", uses: [] },
];

interface Seen {
  prompt: unknown;
  options: Record<string, any>;
}

function fakeQuery(text: string, seen: Seen[] = [], base: object = resultSuccess): QueryFn {
  return ((args: { prompt: unknown; options: Record<string, any> }) => {
    seen.push({ prompt: args.prompt, options: args.options });
    return (async function* () {
      yield { ...base, result: text };
    })();
  }) as unknown as QueryFn;
}

test("lemo suggestion with a known style resolves to that object", async () => {
  const suggest = makeSuggest(
    fakeQuery('Sure: {"engine":"lemo","style":"ink-wash","reason":"A fable suits ink."}'),
    () => styles,
  );
  assert.deepEqual(await suggest("a fable about a fox"), {
    engine: "lemo",
    style: "ink-wash",
    reason: "A fable suits ink.",
  });
});

test("lemo suggestion with an unknown style is rejected", async () => {
  const suggest = makeSuggest(fakeQuery('{"engine":"lemo","style":"made-up"}'), () => styles);
  await assert.rejects(suggest("x"), /not usable/);
});

test("lemo suggestion without a style is rejected", async () => {
  const suggest = makeSuggest(fakeQuery('{"engine":"lemo","reason":"r"}'), () => styles);
  await assert.rejects(suggest("x"), /not usable/);
});

test("reply without JSON, bad JSON or an unknown engine is rejected", async () => {
  await assert.rejects(makeSuggest(fakeQuery("no json"), () => styles)("x"), /not usable/);
  await assert.rejects(makeSuggest(fakeQuery("{nope}"), () => styles)("x"), /not usable/);
  await assert.rejects(makeSuggest(fakeQuery('{"engine":"blender"}'), () => styles)("x"), /not usable/);
});

test("an error result is rejected", async () => {
  const suggest = makeSuggest(fakeQuery("", [], resultMaxTurns), () => styles);
  await assert.rejects(suggest("x"), /not usable/);
});

test("remotion suggestion drops any style", async () => {
  const suggest = makeSuggest(
    fakeQuery('{"engine":"remotion","style":"ink-wash","reason":"A character twist."}'),
    () => styles,
  );
  const got = await suggest("a twist story");
  assert.deepEqual(got, { engine: "remotion", reason: "A character twist." });
  assert.equal("style" in got, false);
});

test("a missing reason becomes an empty string", async () => {
  const suggest = makeSuggest(fakeQuery('{"engine":"remotion"}'), () => styles);
  assert.deepEqual(await suggest("x"), { engine: "remotion", reason: "" });
});

test("the query is a locked-down single turn with the styles in the system prompt", async () => {
  const seen: Seen[] = [];
  const suggest = makeSuggest(fakeQuery('{"engine":"remotion","reason":"r"}', seen), () => styles);
  await suggest("my idea");
  assert.equal(seen.length, 1);
  const { prompt, options } = seen[0]!;
  assert.match(String(prompt), /my idea/);
  assert.equal(options.maxTurns, 1);
  assert.deepEqual(options.allowedTools, []);
  assert.deepEqual(options.tools, []);
  assert.deepEqual(options.settingSources, []);
  assert.equal(typeof options.systemPrompt, "string");
  assert.match(options.systemPrompt, /ink-wash — Ink Wash: brush and water/);
  assert.match(options.systemPrompt, /paper-cut — Paper Cut: layered paper/);
  const denied = await options.canUseTool("Bash", {}, { signal: new AbortController().signal });
  assert.equal(denied.behavior, "deny");
});
