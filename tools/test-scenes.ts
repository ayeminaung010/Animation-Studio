// Checks for the v1.1 contract: migration, validator, scene resolver (run: npm test).
// Uses a small fixture episode: Ice King's episode file loads fonts on import, which fails in node.
import assert from "node:assert/strict";
import { assertGapsFilled, BED, musicDbAt, MUSIC_DB, runtimeProblem } from "../src/lib/cues";
import { migrateV1toV2 } from "../src/lib/migrate";
import { isHardCut, validateProject, type ProjectV11 } from "../src/lib/scenes";
import type { Episode, Shot, Word } from "../src/lib/shots";
import { computeTimings, onePerSentence } from "../src/lib/timing";
import { resolveScene } from "../src/motion/resolveScene";

const FPS = 30;
const shot = (id: string, set: string, text: string, extra: Partial<Shot> = {}): Shot => ({
  id, beat: "B", text, set, characters: [], props: [], lighting: "warm-key",
  camera: { move: "push-in", from: "medium", to: "close", target: "hero" },
  sfx: [], emphasis_word: text.split(" ")[1], transition_in: "cut", ...extra,
});
const hero = { id: "hero", pos: [0, 0, 0] as [number, number, number], face: "smug" as const, action: "idle" };
const pal = { id: "pal", pos: [0.4, 0, 0] as [number, number, number], face: "happy" as const, action: "yell-point" };
const episode: Episode = {
  slug: "fixture", title: "Fixture", fps: FPS, width: 1080, height: 1920,
  characters: { hero: { preset: "everyman" }, pal: { preset: "everyman" } },
  shots: [
    shot("s1", "cold-dock", "one two three four", { characters: [hero] }),
    shot("s2", "cold-dock", "five six seven eight", {
      characters: [hero, pal], lines: [{ speaker: "pal", text: "five six" }, { speaker: "hero", text: "seven eight" }],
    }),
    shot("s3", "ship-deck", "nine ten eleven twelve", { camera: { move: "static", from: "wide", to: "wide", target: "x" } }),
    shot("s4", "cold-dock", "thirteen fourteen fifteen sixteen", { characters: [hero], transition_in: "match-cut" }),
    shot("s5", "ship-deck", "seventeen eighteen nineteen twenty", { camera: { move: "static", from: "wide", to: "wide", target: "x" } }),
  ],
};
// 20 words, 1.2 s apart → 24 s → a budget of 2 hard cuts for the 3 set changes.
const words: Word[] = Array.from({ length: 20 }, (_, i) => ({ text: episode.shots.flatMap((s) => s.text.split(" "))[i], startMs: 500 + i * 1200, endMs: 500 + i * 1200 + 600 }));
const layout = Object.fromEntries(episode.shots.map((s) => [s.id, {}]));

const p = validateProject(migrateV1toV2(episode, words, layout));
assert.equal(p.scenes.length, 4, "s1+s2 share a set and should merge");
assert.deepEqual(p.scenes.map((s) => [s.fromWord, s.toWord]), [[0, 7], [8, 11], [12, 15], [16, 19]]);
const outs = p.scenes.slice(0, -1).map((s) => s.transitionOut?.type);
assert.equal(outs.filter(isHardCut).length, 2, `hard cuts over budget: ${outs.join(",")}`);
assert.ok(outs.includes("MATCH"), "the designed match-cut should be kept first");

const s1 = p.scenes[0];
const perf = (id: string) => s1.performances.find((x) => x.cast === `cast.${id}`)!;
assert.deepEqual(perf("hero").x_present, [0, 7]);
assert.deepEqual(perf("pal").x_present, [4, 7], "pal is only on set for s2");
assert.deepEqual(perf("pal").speakWords, [[4, 5]]);
assert.deepEqual(perf("hero").speakWords, [[6, 7]]);
assert.ok(perf("hero").gaze!.some((g) => g.target === "cast.pal" && g.reactDelay === 7), "listener should react to the speaker late");
assert.equal(perf("pal").gestures![0].pose, "point", "yell-point should become a point gesture");

// Resolver: presence springs in on pal's words; same frame, same result in any order.
const r = resolveScene(p, 0, FPS);
const palR = r.cast.find((c) => c.id === "pal")!;
assert.equal(palR.scaleAt(0), 0, "pal is on set before their shot");
assert.ok(palR.scaleAt(r.duration - 1) > 0.99, "pal is missing in their own shot");
const once = JSON.stringify(Array.from({ length: r.duration }, (_, f) => [r.cast.map((c) => c.posAt(f)), r.punchAt(f)]));
const again = JSON.stringify(Array.from({ length: r.duration }, (_, k) => r.duration - 1 - k).reverse().map((f) => [r.cast.map((c) => c.posAt(f)), r.punchAt(f)]));
assert.equal(once, again, "resolved scene depends on evaluation order");

// Validator: each broken project fails loudly with the reason.
const broken = (fn: (q: ProjectV11) => void, msg: RegExp) => {
  const q: ProjectV11 = JSON.parse(JSON.stringify(p));
  fn(q);
  assert.throws(() => validateProject(q), msg);
};
broken((q) => { q.scenes[1].set = "set.moon"; }, /unknown set "set.moon"/);
broken((q) => { q.scenes[1].fromWord = 9; }, /contiguous/);
broken((q) => { q.scenes[0].performances = q.scenes[0].performances.filter((x) => x.cast !== "cast.pal"); }, /cast.pal is in frame .* no performance/);
broken((q) => { q.scenes[0].performances[0].gestures = [{ atWord: 2, pose: "moonwalk" as never }]; }, /unknown gesture/);
broken((q) => { q.scenes[0].performances[0].gaze = [{ atWord: 30, target: "camera" }]; }, /outside 0–7/);

// Audio: music sits at MUSIC_DB under words, rises 12 dB only in real pauses (not 0.3 s gaps).
const talk: Word[] = [
  { text: "a", startMs: 1000, endMs: 1500 }, { text: "b.", startMs: 1800, endMs: 2300 }, { text: "c", startMs: 5000, endMs: 5500 },
];
const duck = musicDbAt(talk, FPS);
assert.equal(duck(36), MUSIC_DB, "music should duck under a word");
assert.equal(duck(50), MUSIC_DB, "a 0.3 s gap (frames 45–54) should not pump the music");
assert.equal(duck(110), MUSIC_DB + 12, "music should come up in a long pause");
assert.ok(duck(148) < MUSIC_DB + 12, "music should dip before the next word starts");
assert.throws(() => assertGapsFilled(talk, null), /gaps over 0.25s/);
assert.equal(assertGapsFilled(talk, BED).length, 2);

// Runtime: 24 s against a 20 s target is over; against 60 s it isn't.
const tm = computeTimings(episode.shots, words, FPS);
assert.match(runtimeProblem(tm, words, 20) ?? "", /over the 20 s target: trim ~\d+ words/);
assert.equal(runtimeProblem(tm, words, 60), null);

// Captions: one yellow word per sentence.
const sentences: Word[] = ["One", "big", "day.", "Two", "more"].map((text, i) => ({ text, startMs: i * 300, endMs: i * 300 + 200 }));
assert.deepEqual([...onePerSentence(sentences, new Set([0, 2, 3, 4]))], [0, 3]);

console.log("scene tests: all passed");
