// Self-check for dialogue `lines`: node tools/run-ts.mjs tools/dialogue-check.ts
import assert from "node:assert";
import { parseEpisode } from "../src/lib/shots";
import { computeTimings } from "../src/lib/timing";

const shot = {
  id: "s1", text: "Where is my cake? What — cake?", emphasis_word: "cake", characters: [{ id: "mia" }, { id: "tom" }],
  lines: [{ speaker: "mia", text: "Where is my cake?" }, { speaker: "tom", text: "What — cake?" }],
} as never;
const words = ["Where", "is", "my", "cake?", "What —", "cake?"].map((text, i) => ({ text, startMs: i * 300, endMs: i * 300 + 250 }));
const [t] = computeTimings([shot], words, 30);
assert.deepEqual(t.words.map((w) => w.speaker), ["mia", "mia", "mia", "mia", "tom", "tom"]);

const ep = (lines: unknown) => ({
  characters: { mia: {}, tom: {} },
  shots: [{
    id: "s1", text: "Hi there", lighting: "warm-key", camera: { move: "static", from: "wide", to: "wide" },
    transition_in: "cut", characters: [{ id: "mia", face: "happy" }], lines,
  }],
});
parseEpisode(ep([{ speaker: "mia", text: "Hi there" }]));
assert.throws(() => parseEpisode(ep([{ speaker: "mia", text: "Hi" }])), /don't equal/);
parseEpisode(ep([{ speaker: "tom", text: "Hi there" }])); // off-screen speaker is allowed
assert.throws(() => parseEpisode(ep([{ speaker: "zed", text: "Hi there" }])), /not defined/);
console.log("dialogue ok");
