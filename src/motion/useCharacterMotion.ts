// Every motion channel for one character at one frame (motion v2). Pure in (frame, fps, performance).
// Layers, in order: base action pose → idle + breathe + blink → gaze chain → gestures → speech →
// follow-through → expression blend. Frames are local to whatever the caller counts from (shot or scene).
import { useVideoConfig } from "remotion";
import { poseFor, type Euler3, type Pose } from "../components/actions";
import type { FaceName } from "../lib/shots";
import { GESTURES, mirror, type GesturePose } from "./gestures";
import {
  blink, breathe, clamp01, followThrough, gazeChain, gesture, idle, lerp, mouth, SPRINGS, springStep, talkNods,
  type GazeKey, type WordTiming,
} from "./motion-kit";

export interface ActionSpan {
  action: string;
  /** Frame the action starts (its own frame 0). */
  from: number;
  duration: number;
}

export interface GestureCue {
  pose: GesturePose;
  /** Defaults to the pose's own side (R, or both for shrug/smash/…). */
  arm?: "L" | "R" | "both";
  hitFrame: number;
  hold?: number;
}

export interface Performance {
  seed: number;
  /** 0.5 calm listener … 1.0 normal … 1.6 nervous. */
  energy?: number;
  /** Base body poses from actions.ts; consecutive ones spring into each other. */
  actions?: ActionSpan[];
  gaze?: GazeKey[];
  gestures?: GestureCue[];
  /** Words this character speaks (frames). Mouth stays closed outside them. */
  speaks?: WordTiming[];
  /** Frames of stressed words (head nods while speaking). */
  stress?: number[];
  expressions?: { frame: number; face: FaceName }[];
  /** Extra forced blinks (reactions). */
  blinks?: number[];
}

export interface CharacterMotion {
  pose: Pose;
  /** Extra shoulder height (breath + shrug), per arm. */
  shoulderL: number;
  shoulderR: number;
  bendL: number;
  bendR: number;
  /** Forearm bend-plane twist and arm stretch (gestures only). */
  twistL: number;
  twistR: number;
  stretchL: number;
  stretchR: number;
  /** Chest scale [x, y] from breathing. */
  chest: [number, number];
  /** Eye offset on the head, radians [yaw, pitch] (+yaw = character's left, +pitch = down). */
  eyes: [number, number];
  blink: number;
  mouth: number;
  speaking: boolean;
  face: FaceName;
  faceFrom: FaceName;
  faceT: number;
  /** Hat lag rotation (radians). */
  hatLag: Euler3;
  /** Scarf / tie tail lag (radians about x). */
  tailLag: number;
}

/** Character height in world units (idle offsets come in character-heights). */
const HEIGHT = 1.75;
/** Hat and tail lag multipliers on the follow-through offset. */
const HAT_LAG = 1.6;
const TAIL_LAG = 2.2;

const lerp3 = (a: Euler3, b: Euler3, t: number): Euler3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const add3 = (a: Euler3, b: Euler3, k = 1): Euler3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

export const lerpPose = (a: Pose, b: Pose, t: number): Pose => ({
  x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t), rotY: lerp(a.rotY, b.rotY, t),
  lean: lerp(a.lean, b.lean, t), tilt: lerp(a.tilt, b.tilt, t),
  head: lerp3(a.head, b.head, t), armL: lerp3(a.armL, b.armL, t), armR: lerp3(a.armR, b.armR, t),
  legL: lerp(a.legL, b.legL, t), legR: lerp(a.legR, b.legR, t),
  sit: lerp(a.sit, b.sit, t), kneel: lerp(a.kneel, b.kneel, t), squash: lerp(a.squash, b.squash, t),
});

/** Action pose at a frame; a new action springs in from the previous one instead of popping. */
const basePose = (f: number, fps: number, actions: ActionSpan[]): Pose => {
  let k = 0;
  while (k + 1 < actions.length && actions[k + 1].from <= f) k++;
  const at = (a: ActionSpan) => poseFor(a.action, Math.max(0, f - a.from), a.duration);
  const cur = at(actions[k]);
  if (k === 0) return cur;
  return lerpPose(at(actions[k - 1]), cur, springStep((f - actions[k].from) / fps, SPRINGS.body));
};

/** Head + body angles from the always-on layers (no gestures); follow-through samples this over past frames. */
const bodyAt = (f: number, fps: number, p: Performance, gazeKeys: GazeKey[]) => {
  const pose = p.actions?.length ? basePose(f, fps, p.actions) : poseFor("idle", f, 1);
  const id = idle(f, fps, p.seed, p.energy ?? 1);
  const gz = gazeChain(f, fps, gazeKeys);
  const nod = p.speaks?.length && p.stress?.length ? talkNods(f, fps, p.stress) : 0;
  return { pose, id, gz, nod, pitch: pose.lean + pose.head[0] + id.headPitch + gz.headPitch + nod, tilt: pose.tilt + id.lean + pose.head[2] + id.headTilt };
};

export const characterMotion = (frame: number, fps: number, p: Performance): CharacterMotion => {
  const gazeKeys = p.gaze?.length ? p.gaze : [{ frame: 0, yaw: 0 }];
  const now = bodyAt(frame, fps, p, gazeKeys);
  const { id, gz, nod } = now;
  const br = breathe(frame, fps, p.seed);

  // 1–2. idle + gaze chain on top of the action pose
  const pose: Pose = {
    ...now.pose,
    x: now.pose.x + id.hipX * HEIGHT,
    y: now.pose.y + id.hipY * HEIGHT,
    tilt: now.pose.tilt + id.lean,
    rotY: now.pose.rotY + gz.bodyYaw,
    head: add3(now.pose.head, [id.headPitch + gz.headPitch + nod, id.headYaw + gz.headYaw, id.headTilt]),
    armL: add3(now.pose.armL, [id.armL, 0, 0]),
    armR: add3(now.pose.armR, [id.armR, 0, 0]),
  };

  // 3. gestures: per arm the strongest weight wins; body extras add up
  let bendL = 0;
  let bendR = 0;
  let twistL = 0;
  let twistR = 0;
  let stretchL = 1;
  let stretchR = 1;
  let lift = 0;
  let wL = 0;
  let wR = 0;
  const armL = pose.armL;
  const armR = pose.armR;
  for (const g of p.gestures ?? []) {
    const t = GESTURES[g.pose];
    const w = gesture(frame, fps, { hitFrame: g.hitFrame, hold: g.hold, windup: t.windup });
    const side = g.arm ?? t.side;
    const osc = t.osc ? Math.sin(frame * t.osc.speed) * t.osc.amp * clamp01(w) : 0;
    const target: Euler3 = t.osc?.channel === "z" ? add3(t.arm, [0, 0, -osc]) : t.arm;
    const bend = t.bend + (t.osc?.channel === "bend" ? osc : 0);
    if (side !== "L" && Math.abs(w) > Math.abs(wR)) {
      wR = w;
      pose.armR = lerp3(armR, target, w);
      bendR = bend * w;
      twistR = (t.twist ?? 0) * clamp01(w);
      stretchR = 1 + ((t.stretch ?? 1) - 1) * clamp01(w);
    }
    if (side !== "R" && Math.abs(w) > Math.abs(wL)) {
      wL = w;
      pose.armL = lerp3(armL, mirror(target), w);
      bendL = bend * w;
      twistL = -(t.twist ?? 0) * clamp01(w);
      stretchL = 1 + ((t.stretch ?? 1) - 1) * clamp01(w);
    }
    pose.lean += (t.lean ?? 0) * w;
    if (t.head) pose.head = add3(pose.head, t.head, w);
    lift += (t.shoulder ?? 0) * Math.max(0, w);
  }

  // 4. speech: only inside this character's own words
  const speaking = (p.speaks ?? []).some((w) => frame >= w.start && frame <= w.end);
  const mouthOpen = p.speaks?.length ? mouth(frame, p.speaks, p.seed) : 0;

  // 5. follow-through: hat and tail lag behind head/body motion
  const f0 = Math.max(0, frame - 75);
  const past = Array.from({ length: frame - f0 + 1 }, (_, i) => (i === frame - f0 ? now : bodyAt(f0 + i, fps, p, gazeKeys)));
  const sample = (key: "pitch" | "tilt" | "lean") => (f: number) => {
    const b = past[Math.min(past.length - 1, Math.max(0, f - f0))];
    return key === "lean" ? b.pose.lean : b[key];
  };
  const lag = (key: "pitch" | "tilt" | "lean") => followThrough(frame, fps, sample(key)) - sample(key)(frame);

  // 6. expressions spring over ~5 frames; blink on big turns and on expression changes
  const ex = p.expressions ?? [];
  let k = -1;
  while (k + 1 < ex.length && ex[k + 1].frame <= frame) k++;
  const face = ex[Math.max(0, k)]?.face ?? "neutral";
  const faceFrom = k > 0 ? ex[k - 1].face : face;
  const faceT = k > 0 ? clamp01(springStep((frame - ex[k].frame) / fps, SPRINGS.head)) : 1;
  const forced = [...gz.blinkAt, ...ex.slice(1).map((e) => e.frame), ...(p.blinks ?? [])];

  return {
    pose,
    shoulderL: br.shoulderY + lift,
    shoulderR: br.shoulderY + lift,
    bendL,
    bendR,
    twistL,
    twistR,
    stretchL,
    stretchR,
    chest: [br.chestScaleX, br.chestScaleY],
    eyes: [gz.eyesYaw, gz.eyesPitch],
    blink: blink(frame, fps, p.seed, forced),
    mouth: mouthOpen,
    speaking,
    face,
    faceFrom,
    faceT,
    hatLag: [lag("pitch") * HAT_LAG, 0, lag("tilt") * HAT_LAG],
    tailLag: lag("lean") * TAIL_LAG,
  };
};

/** Hook form: frame is the caller's local frame (shot or scene), fps from the composition. */
export const useCharacterMotion = (p: Performance, frame: number) => characterMotion(frame, useVideoConfig().fps, p);
