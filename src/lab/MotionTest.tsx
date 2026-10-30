// 6-second motion regression test: motion-upgrade/demo rebuilt as hand-written v1.1 contract data
// (no migration) and rendered through the v2 path. Two characters, one line, a point on "mirror",
// a reaction 7 frames late, a shrug, and one continuous camera track (push → arc → settle).
// npx remotion still src/index.ts motion-test out/stills/motion-test.png --frame=60
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Captions } from "../components/Captions";
import { SceneView } from "../components/SceneView";
import { validateProject, type ProjectV11 } from "../lib/scenes";
import { resolveScene } from "../motion/resolveScene";

export const MOTION_TEST_FRAMES = 180;

// Word timings from the demo (frames); the hero's "Well…" carries the shrug.
const words = [
  { w: "Wait,", start: 12, end: 26 }, { w: "what's", start: 28, end: 36 }, { w: "a", start: 37, end: 39 },
  { w: "mirror", start: 40, end: 54 }, { w: "going", start: 55, end: 62 }, { w: "to", start: 63, end: 66 },
  { w: "do?", start: 67, end: 84 }, { w: "Well…", start: 108, end: 122 },
];

// Demo distances × 1.75 (its rig is 1 unit tall, ours ≈ 1.75).
const project: ProjectV11 = validateProject({
  meta: { title: "Motion test", slug: "motion-test", width: 1080, height: 1920, fps: 30, durationInFrames: MOTION_TEST_FRAMES, targetSec: 6 },
  cast: [
    { id: "cast.skeptic", role: "skeptic", x_def: { preset: "custom", outfit_color: "#2D3550", hair: "peaked-cap" } },
    { id: "cast.hero", role: "hero", x_def: { preset: "custom", outfit_color: "#56D1B7", hair: "top-hat", accessory: "scarf" } },
  ],
  sets: [{ id: "set.deck", x_set: "ship-deck" }],
  vo: { words },
  scenes: [{
    id: "scene.01",
    set: "set.deck",
    fromWord: 0,
    toWord: 7,
    camera: {
      keys: [
        { atWord: 0, move: "HOLD", pos: [0.15, 1.8, 7.2], lookAt: [0, 1.3, 0], fov: 38 },
        { atWord: 3, move: "PUSH", pos: [-0.96, 1.75, 4.1], lookAt: [-0.52, 1.49, 0], fov: 36 },
        { atWord: 7, move: "ARC", pos: [1.22, 1.75, 4.0], lookAt: [0.6, 1.49, 0], fov: 35 },
      ],
      leadSec: 1.1,
      handheld: 1,
    },
    performances: [
      {
        cast: "cast.skeptic", seed: 11, pos: [-0.63, 0, 0], facing: 0.35, energy: 1.4, speaks: true,
        speakWords: [0, 6], stress: [3, 6],
        gaze: [{ atWord: 0, target: "cast.hero" }],
        gestures: [{ atWord: 3, arm: "R", pose: "point", hold: 26 }],
        expressions: [{ atWord: 0, expr: "scoff" }],
      },
      {
        cast: "cast.hero", seed: 42, pos: [0.63, 0, 0], facing: -0.3, energy: 0.7, speaks: true,
        speakWords: [7, 7],
        gaze: [{ atWord: 0, target: "camera" }, { atWord: 0, target: "cast.skeptic", reactDelay: 19 }, { atWord: 7, target: "camera", reactDelay: 8 }],
        gestures: [{ atWord: 7, arm: "both", pose: "shrug", hold: 20 }],
        expressions: [{ atWord: 0, expr: "smug" }, { atWord: 7, expr: "grin" }],
      },
    ],
  }],
});
const scene = resolveScene(project, 0, 30);
const captionWords = words.map((w) => ({ text: w.w, startMs: (w.start / 30) * 1000, endMs: (w.end / 30) * 1000 }));

export const MotionTest: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "black" }}>
    <Sequence durationInFrames={MOTION_TEST_FRAMES}>
      <SceneView scene={scene} />
    </Sequence>
    <Captions words={captionWords} emphasis={new Set([3])} yRatio={0.7} />
  </AbsoluteFill>
);
