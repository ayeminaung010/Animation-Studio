// Unit checks for src/motion (run: npm test). Plain node:assert, no test runner.
import assert from "node:assert/strict";
import { blink, cameraTrack, gesture, SPRINGS, springTrack, type CameraKey, type Vec3 } from "../src/motion";
import { characterMotion, type Performance } from "../src/motion/useCharacterMotion";

const FPS = 30;
const range = (a: number, b: number) => Array.from({ length: b - a }, (_, i) => a + i);

// springTrack settles to its target for every preset.
for (const [name, cfg] of Object.entries(SPRINGS)) {
  const keys = [{ frame: 0, value: 0 }, { frame: 10, value: 1 }];
  const v = springTrack(10 + 6 * FPS, FPS, keys, cfg);
  assert.ok(Math.abs(v - 1) < 1e-3, `springTrack ${name} settled at ${v}, want 1`);
  assert.equal(springTrack(5, FPS, keys, cfg), 0, `springTrack ${name} moved before its key`);
}

// blink: same frame + seed → same value, whatever order frames are rendered in.
const forward = range(0, 600).map((f) => blink(f, FPS, 42));
const backward = range(0, 600).reverse().map((f) => blink(f, FPS, 42)).reverse();
assert.deepEqual(forward, backward, "blink depends on render order");
assert.ok(forward.some((v) => v > 0.9), "blink never closes the eyes in 20 s");
assert.notDeepEqual(forward, range(0, 600).map((f) => blink(f, FPS, 7)), "different seeds blink in unison");

// cameraTrack is continuous: no jump > 2% of scene size between consecutive frames.
// Scene size = 14 world units, the extreme-wide frame height our sets are built to fill (CameraRig FRAME_H).
// Fixture: a two-hander staged like CameraRig framings (wide → medium two-shot → close A → close B).
const SCENE_SIZE = 14;
const WIDE: CameraKey = { frame: 0, pos: [0, 2.5, 9.07], lookAt: [0, 0.85, 0], fov: 40 };
const keys: CameraKey[] = [
  WIDE,
  { frame: 90, pos: [0, 1.6, 4.95], lookAt: [0, 1.0, 0], fov: 40 },
  { frame: 180, pos: [-1.1, 1.6, 2.75], lookAt: [-1.1, 1.27, 0], fov: 40 },
  { frame: 270, pos: [1.1, 1.6, 2.75], lookAt: [1.1, 1.27, 0], fov: 40 },
];
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** Walks the track; returns the peak per-frame step. Asserts no pop (sudden change in acceleration). */
const walk = (ks: CameraKey[], frames: number, maxStep: number) => {
  const pos = range(0, frames).map((f) => cameraTrack(f, FPS, ks));
  const steps = range(1, frames).map((f) => dist(pos[f].pos, pos[f - 1].pos));
  range(1, frames).forEach((f) => {
    assert.ok(steps[f - 1] <= maxStep, `camera pos jumps ${steps[f - 1].toFixed(3)} at frame ${f}`);
    assert.ok(dist(pos[f].lookAt, pos[f - 1].lookAt) <= maxStep, `camera aim jumps at frame ${f}`);
  });
  range(1, steps.length - 1).forEach((i) => {
    const jerk = steps[i + 1] - 2 * steps[i] + steps[i - 1];
    assert.ok(Math.abs(jerk) <= 0.002 * SCENE_SIZE, `camera pops at frame ${i + 1} (jerk ${jerk.toFixed(4)})`);
  });
  return Math.max(...steps);
};
walk(keys, 360, 0.02 * SCENE_SIZE);
// Known limit, measured not asserted: a close → wide pull-out (7 units) peaks above 2% with kit defaults.
// Phase 3 scales rampSec/leadSec with move distance for these.
const pull = walk([keys[3], { ...WIDE, frame: 100 }], 200, Infinity);
console.log(`cameraTrack close→wide peak step = ${((pull / SCENE_SIZE) * 100).toFixed(1)}% of scene size (limit 2%)`);

// gesture: dips below 0 before the hit (anticipation), exceeds 1 just after it (overshoot).
const hit = 40;
const w = (f: number) => gesture(f, FPS, { hitFrame: hit });
assert.ok(Math.min(...range(hit - 10, hit - 1).map(w)) < 0, "gesture has no anticipation dip");
assert.ok(Math.max(...range(hit, hit + 10).map(w)) > 1, "gesture has no overshoot after the hit");
assert.ok(Math.abs(w(hit + 4 * FPS)) < 0.02, "gesture doesn't release back to rest");

// characterMotion: every layer at once, rendered in any order, gives the same channels.
const perf: Performance = {
  seed: 42,
  energy: 1.2,
  actions: [{ action: "idle", from: 0, duration: 60 }, { action: "arms-cross-smug", from: 60, duration: 60 }],
  gaze: [{ frame: 0, yaw: 0 }, { frame: 30, yaw: 0.6 }, { frame: 80, yaw: -0.3, pitch: 0.1 }],
  gestures: [{ pose: "point", hitFrame: 40 }, { pose: "shrug", hitFrame: 95 }],
  speaks: [{ w: "Ice?", start: 20, end: 32 }, { w: "tropics?", start: 36, end: 52 }],
  stress: [36],
  expressions: [{ frame: 0, face: "smug" }, { frame: 70, face: "shocked" }],
};
const fwd = range(0, 120).map((f) => JSON.stringify(characterMotion(f, FPS, perf)));
const rev = range(0, 120).reverse().map((f) => JSON.stringify(characterMotion(f, FPS, perf))).reverse();
assert.deepEqual(fwd, rev, "characterMotion depends on render order");
const at = (f: number) => characterMotion(f, FPS, perf);
assert.equal(at(10).mouth, 0, "mouth moves outside the character's own words");
assert.ok(at(23).mouth > 0.3, "mouth closed mid-syllable while speaking");
assert.ok(at(72).faceT > 0 && at(72).faceT < 1, "expression pops instead of blending");
assert.ok(at(78).faceT > 0.95, "expression blend takes longer than ~8 frames");

console.log("motion tests: all passed");
