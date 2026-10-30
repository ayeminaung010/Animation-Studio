/**
 * motion-kit.ts — natural-motion helpers for Remotion + Three.js toon shorts.
 *
 * Every function is PURE in (frame, fps, seed, data). No timers, no state,
 * no Math.random(). That is what Remotion needs: any frame can be rendered
 * in any order on any worker and come out identical.
 *
 * The core trick is spring SUPERPOSITION: a value that changes at several
 * key frames is the sum of analytic spring step-responses, one per change.
 * You get overshoot, settle and smooth re-targeting mid-motion without
 * simulating anything frame by frame.
 *
 * Layers a character should always have on screen (the "Living Frame"):
 *   idle()        weight shift, sway, head drift       — never fully still
 *   breathe()     chest/shoulder rise                   — 3.5–4.5 s cycle
 *   blink()       seeded, irregular, sometimes double   — every 2–5 s
 *   gazeChain()   eyes lead → head follows → body last  — reads as "thinking"
 *   gesture()     anticipation → action → overshoot → settle → release
 *   followThrough() hats, ties, papers lag and wobble behind the body
 *   mouth()/talkNods() only while that character speaks
 * Camera:
 *   cameraTrack() one continuous spline per set, springs between framings
 *   handheld()    tiny low-frequency drift so locked-off shots still breathe
 */

export type Vec3 = [number, number, number];

export interface SpringConfig {
  /** Higher = faster. 60–200 for body, 300–600 for eyes. */
  stiffness: number;
  /** Lower = more overshoot. Critical damping is 2*sqrt(stiffness*mass). */
  damping: number;
  mass?: number;
}

export const SPRINGS = {
  /** Eyes: fast, crisp, tiny overshoot. */
  eyes: { stiffness: 520, damping: 34 },
  /** Head: quick with a visible settle. */
  head: { stiffness: 140, damping: 15 },
  /** Torso/body turns: heavier. */
  body: { stiffness: 60, damping: 12 },
  /** Arms in gestures: snappy, a little bounce. */
  arm: { stiffness: 180, damping: 13 },
  /** Floppy secondary (hat brims, ties, paper). */
  floppy: { stiffness: 90, damping: 6 },
  /** Camera: smooth, no visible overshoot. */
  camera: { stiffness: 18, damping: 8.2 },
} satisfies Record<string, SpringConfig>;

/* ------------------------------------------------------------------ */
/* Deterministic randomness                                            */
/* ------------------------------------------------------------------ */

/** Integer hash → [0,1). Stable across machines. */
export function hash01(a: number, b = 0): number {
  let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth 1D value noise in [-1,1]. */
export function noise1D(t: number, seed = 0): number {
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * f * (f * (f * 6 - 15) + 10); // quintic fade
  const a = hash01(i, seed) * 2 - 1;
  const b = hash01(i + 1, seed) * 2 - 1;
  return a + (b - a) * u;
}

/** Fractal noise: organic drift. ~[-1,1]. */
export function fbm(t: number, seed = 0, octaves = 3): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise1D(t * freq, seed + o * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

/* ------------------------------------------------------------------ */
/* Easing                                                              */
/* ------------------------------------------------------------------ */

export const ease = {
  inOutSine: (x: number) => -(Math.cos(Math.PI * x) - 1) / 2,
  inOutCubic: (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outCubic: (x: number) => 1 - Math.pow(1 - x, 3),
  outBack: (x: number, s = 1.70158) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2),
};

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ------------------------------------------------------------------ */
/* Springs                                                             */
/* ------------------------------------------------------------------ */

/**
 * Analytic step response of a damped spring: 0 at t<=0, → 1 as t → ∞.
 * Zero initial velocity, so motion always eases out of rest.
 */
export function springStep(tSec: number, cfg: SpringConfig): number {
  if (tSec <= 0) return 0;
  const m = cfg.mass ?? 1;
  const w0 = Math.sqrt(cfg.stiffness / m);
  const zeta = cfg.damping / (2 * Math.sqrt(cfg.stiffness * m));
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const e = Math.exp(-zeta * w0 * tSec);
    return 1 - e * (Math.cos(wd * tSec) + ((zeta * w0) / wd) * Math.sin(wd * tSec));
  }
  if (zeta === 1) {
    return 1 - Math.exp(-w0 * tSec) * (1 + w0 * tSec);
  }
  const s = Math.sqrt(zeta * zeta - 1);
  const r1 = -w0 * (zeta - s);
  const r2 = -w0 * (zeta + s);
  return 1 + (r2 * Math.exp(r1 * tSec) - r1 * Math.exp(r2 * tSec)) / (r1 - r2);
}

export interface Key<T = number> {
  frame: number;
  value: T;
}

/**
 * Value that springs to each new key value at that key's frame.
 * Keys must be sorted by frame. Before the first key → first value.
 * Re-targeting mid-motion is seamless because responses superpose.
 */
export function springTrack(frame: number, fps: number, keys: Key[], cfg: SpringConfig, rampSec = 0): number {
  if (keys.length === 0) return 0;
  const step = rampSec > 0 ? (t: number) => springStepSoft(t, cfg, rampSec) : (t: number) => springStep(t, cfg);
  let v = keys[0].value;
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (k.frame > frame) break;
    v += (k.value - keys[i - 1].value) * step((frame - k.frame) / fps);
  }
  return v;
}

/**
 * Spring step whose TARGET ramps in over `rampSec` instead of jumping.
 * A plain spring has full acceleration on its first frame (a visible kick);
 * this starts with zero acceleration — use it for cameras and big body moves.
 */
export function springStepSoft(tSec: number, cfg: SpringConfig, rampSec: number, samples = 12): number {
  if (tSec <= 0) return 0;
  let s = 0;
  for (let i = 0; i < samples; i++) {
    s += springStep(tSec - ((i + 0.5) / samples) * rampSec, cfg);
  }
  return s / samples;
}

/** springTrack for Vec3 keys. */
export function springTrack3(frame: number, fps: number, keys: Key<Vec3>[], cfg: SpringConfig): Vec3 {
  return [0, 1, 2].map((c) =>
    springTrack(frame, fps, keys.map((k) => ({ frame: k.frame, value: k.value[c] })), cfg),
  ) as Vec3;
}

/**
 * Secondary motion: a springy, lagging copy of any signal.
 * Use `followThrough(...) - signal(frame)` as the wobble offset for a hat
 * brim, tie or clipboard. Exact discrete superposition over `windowFrames`.
 */
export function followThrough(
  frame: number,
  fps: number,
  signal: (f: number) => number,
  cfg: SpringConfig = SPRINGS.floppy,
  windowFrames = 75,
): number {
  const f0 = Math.max(0, frame - windowFrames);
  let v = signal(f0);
  let prev = v;
  for (let k = f0 + 1; k <= frame; k++) {
    const s = signal(k);
    v += (s - prev) * springStep((frame - k) / fps + 1 / fps, cfg);
    prev = s;
  }
  return v;
}

/* ------------------------------------------------------------------ */
/* Character layers                                                    */
/* ------------------------------------------------------------------ */

export interface IdlePose {
  /** Lateral hip offset in character-heights. */
  hipX: number;
  /** Small vertical bob. */
  hipY: number;
  /** Whole-body lean (radians, Z axis). */
  lean: number;
  headTilt: number;
  headYaw: number;
  headPitch: number;
  /** Per-arm swing (radians). */
  armL: number;
  armR: number;
}

/**
 * Always-on idle. `energy` 0.5 = calm listener, 1 = normal, 1.6 = nervous.
 * Different seeds per character so a crowd never moves in unison.
 */
export function idle(frame: number, fps: number, seed: number, energy = 1): IdlePose {
  const t = frame / fps;
  const e = energy;
  return {
    hipX: fbm(t * 0.22, seed + 1) * 0.018 * e,
    hipY: fbm(t * 0.5, seed + 2) * 0.004 * e,
    lean: fbm(t * 0.25, seed + 3) * 0.035 * e,
    headTilt: fbm(t * 0.35, seed + 4) * 0.07 * e,
    headYaw: fbm(t * 0.28, seed + 5) * 0.09 * e,
    headPitch: fbm(t * 0.4, seed + 6) * 0.04 * e,
    armL: fbm(t * 0.3, seed + 7) * 0.06 * e,
    armR: fbm(t * 0.3, seed + 8) * 0.06 * e,
  };
}

/** Breathing: chest scale and shoulder lift. Period 3.5–4.5 s per seed. */
export function breathe(frame: number, fps: number, seed: number, rate = 1) {
  const period = (3.5 + hash01(seed, 77) * 1.0) / rate;
  const phase = hash01(seed, 78) * Math.PI * 2;
  const s = Math.sin((2 * Math.PI * frame) / fps / period + phase);
  const inhale = Math.max(0, s); // inhale is slower/visible, exhale relaxes
  return { chestScaleY: 1 + 0.018 * inhale, chestScaleX: 1 + 0.008 * inhale, shoulderY: 0.006 * s };
}

/**
 * Eyelid closure 0 (open) … 1 (closed). Irregular 2–5 s intervals,
 * 18% double blinks, fast close (2 frames) and slower open (4 frames).
 * Pass `forceAt` frames to add blinks on cuts or on emotion changes.
 */
export function blink(frame: number, fps: number, seed: number, forceAt: number[] = []): number {
  const close = 0.065 * fps;
  const open = 0.13 * fps;
  const shape = (d: number) => {
    if (d < 0 || d > close + open) return 0;
    return d < close ? ease.outCubic(d / close) : 1 - ease.inOutSine((d - close) / open);
  };
  let best = 0;
  for (const f of forceAt) best = Math.max(best, shape(frame - f));
  let t = hash01(seed, 900) * 2 * fps; // first blink within 2 s
  for (let i = 0; t <= frame + 1 && i < 10000; i++) {
    best = Math.max(best, shape(frame - t));
    if (hash01(seed, i * 2 + 1) < 0.18) best = Math.max(best, shape(frame - (t + close + open + 2)));
    t += (2 + hash01(seed, i * 2) * 3) * fps;
  }
  return best;
}

export interface GazeKey {
  frame: number;
  /** Yaw toward target, radians (+ = character's left). */
  yaw: number;
  pitch?: number;
}

/**
 * Eyes → head → body chain. Eyes snap first, head follows ~4 frames later
 * and takes ~60% of the turn, body takes ~25% and arrives last. A blink is
 * returned for big head turns (>0.5 rad), like real people do.
 */
export function gazeChain(frame: number, fps: number, keys: GazeKey[]) {
  const yawKeys = keys.map((k) => ({ frame: k.frame, value: k.yaw }));
  const pitchKeys = keys.map((k) => ({ frame: k.frame, value: k.pitch ?? 0 }));
  const delay = (ks: Key[], d: number) => ks.map((k, i) => ({ frame: i === 0 ? k.frame : k.frame + d, value: k.value }));
  const eyesYaw = springTrack(frame, fps, yawKeys, SPRINGS.eyes);
  const headYaw = springTrack(frame, fps, delay(yawKeys, 4), SPRINGS.head) * 0.6;
  const bodyYaw = springTrack(frame, fps, delay(yawKeys, 9), SPRINGS.body) * 0.25;
  const headPitch = springTrack(frame, fps, delay(pitchKeys, 3), SPRINGS.head) * 0.7;
  const eyesPitch = springTrack(frame, fps, pitchKeys, SPRINGS.eyes);
  const blinkAt = keys
    .filter((k, i) => i > 0 && Math.abs(k.yaw - keys[i - 1].yaw) > 0.5)
    .map((k) => k.frame + 2);
  return {
    // eyes report what is LEFT after head+body, so the total always hits the target
    eyesYaw: eyesYaw - headYaw - bodyYaw,
    eyesPitch: eyesPitch - headPitch,
    headYaw,
    headPitch,
    bodyYaw,
    blinkAt,
  };
}

export interface GestureSpec {
  /** Frame the gesture HITS (usually the stressed word's first frame). */
  hitFrame: number;
  /** Frames of wind-up before the hit (6–10 reads well at 30 fps). */
  anticipation?: number;
  /** How far it winds back, as a fraction of the gesture (0.1–0.3). */
  windup?: number;
  /** Frames held after the hit before releasing. */
  hold?: number;
  cfg?: SpringConfig;
}

/**
 * Gesture weight 0…1 (can briefly exceed 1 or dip below 0). Drive any pose
 * blend with it: arm = lerp(restPose, pointPose, w). Built-in
 * anticipation → overshoot → settle → release.
 */
export function gesture(frame: number, fps: number, g: GestureSpec): number {
  const a = g.anticipation ?? 8;
  const hold = g.hold ?? Math.round(fps * 0.9);
  const keys: Key[] = [
    { frame: -1e6, value: 0 },
    { frame: g.hitFrame - a, value: -(g.windup ?? 0.18) },
    { frame: g.hitFrame - 2, value: 1 },
    { frame: g.hitFrame + hold, value: 0 },
  ];
  return springTrack(frame, fps, keys, g.cfg ?? SPRINGS.arm);
}

/** Sum several gestures on one channel (e.g. many points over a scene). */
export function gestures(frame: number, fps: number, specs: GestureSpec[]): number {
  return specs.reduce((s, g) => s + gesture(frame, fps, g), 0);
}

export interface WordTiming {
  w: string;
  /** frames */
  start: number;
  end: number;
}

const syllables = (w: string) => Math.max(1, (w.toLowerCase().match(/[aeiouy]+/g) ?? []).length);

/**
 * Mouth openness 0…1 from word timings — cheap, convincing toon lip-flap.
 * One open/close per syllable, slightly random heights, closes between words.
 */
export function mouth(frame: number, words: WordTiming[], seed = 0): number {
  for (let i = 0; i < words.length; i++) {
    const wd = words[i];
    if (frame < wd.start || frame > wd.end) continue;
    const n = syllables(wd.w);
    const p = (frame - wd.start) / Math.max(1, wd.end - wd.start);
    const syl = Math.min(n - 1, Math.floor(p * n));
    const local = p * n - syl;
    const height = 0.55 + 0.45 * hash01(seed + i, syl);
    return height * Math.sin(Math.PI * local);
  }
  return 0;
}

/** Small head nods on stressed words while speaking (radians, add to pitch). */
export function talkNods(frame: number, fps: number, stressFrames: number[], amount = 0.12): number {
  return stressFrames.reduce(
    (s, f) => s + gesture(frame, fps, { hitFrame: f, anticipation: 4, windup: 0.3, hold: 5, cfg: SPRINGS.head }) * amount,
    0,
  );
}

/* ------------------------------------------------------------------ */
/* Camera                                                              */
/* ------------------------------------------------------------------ */

export interface CameraKey {
  /** Frame the camera should be SETTLED at this framing. */
  frame: number;
  pos: Vec3;
  lookAt: Vec3;
  fov: number;
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function sampleSpline(points: Vec3[], u: number): Vec3 {
  const n = points.length;
  if (n === 1) return points[0];
  const uu = Math.min(n - 1, Math.max(0, u));
  const i = Math.min(n - 2, Math.floor(uu));
  const t = uu - i;
  const P = (j: number) => points[Math.min(n - 1, Math.max(0, j))];
  return [0, 1, 2].map((c) => catmullRom(P(i - 1)[c], P(i)[c], P(i + 1)[c], P(i + 2)[c], t)) as Vec3;
}

/**
 * One continuous camera move through a list of framings. The camera starts
 * travelling `leadSec` before each key so it ARRIVES on the key frame, and a
 * spring on the spline parameter means it never starts or stops on a dime.
 * Use one track per set; only change track on a deliberate CUT.
 */
export function cameraTrack(
  frame: number,
  fps: number,
  keys: CameraKey[],
  leadSec = 1.1,
  cfg: SpringConfig = SPRINGS.camera,
  rampSec = 0.45,
) {
  const lead = Math.round(leadSec * fps);
  const uKeys = keys.map((k, i) => ({ frame: i === 0 ? -1e6 : k.frame - lead, value: i }));
  const u = springTrack(frame, fps, uKeys, cfg, rampSec);
  const pos = sampleSpline(keys.map((k) => k.pos), u);
  const lookAt = sampleSpline(keys.map((k) => k.lookAt), u);
  const fovKeys = keys.map((k, i) => ({ frame: i === 0 ? -1e6 : k.frame - lead, value: k.fov }));
  const fov = springTrack(frame, fps, fovKeys, cfg, rampSec);
  // Slow "creep": the camera is never parked, even between framings.
  const t = frame / fps;
  const creep = 0.04 * fbm(t * 0.12, 991);
  const dir = [lookAt[0] - pos[0], lookAt[1] - pos[1], lookAt[2] - pos[2]];
  const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const crept: Vec3 = [pos[0] + (dir[0] / len) * creep, pos[1] + (dir[1] / len) * creep, pos[2] + (dir[2] / len) * creep];
  return { pos: crept, lookAt, fov, u };
}

/** Low-frequency handheld drift. amp 1 ≈ 1 cm / 0.3°. Add to pos and rotation. */
export function handheld(frame: number, fps: number, seed: number, amp = 1) {
  const t = frame / fps;
  return {
    pos: [fbm(t * 0.45, seed + 11) * 0.01 * amp, fbm(t * 0.4, seed + 12) * 0.008 * amp, 0] as Vec3,
    rot: [fbm(t * 0.35, seed + 13) * 0.005 * amp, fbm(t * 0.3, seed + 14) * 0.005 * amp, fbm(t * 0.25, seed + 15) * 0.003 * amp] as Vec3,
  };
}

/** Impact shake that decays (cannon, wave crash, slam). */
export function impactShake(frame: number, fps: number, hitFrame: number, strength = 1, seed = 0) {
  const d = (frame - hitFrame) / fps;
  if (d < 0 || d > 1.2) return [0, 0, 0] as Vec3;
  const env = Math.exp(-d * 5) * strength;
  return [noise1D(d * 22, seed) * 0.05 * env, noise1D(d * 25, seed + 1) * 0.05 * env, noise1D(d * 18, seed + 2) * 0.02 * env] as Vec3;
}

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */

/** Find the first frame of a word (case-insensitive), searching from `fromFrame`. */
export function atWord(words: WordTiming[], word: string, fromFrame = 0): number {
  const w = word.toLowerCase().replace(/[^a-z0-9']/g, '');
  const hit = words.find((x) => x.start >= fromFrame && x.w.toLowerCase().replace(/[^a-z0-9']/g, '') === w);
  if (!hit) throw new Error(`atWord: "${word}" not found after frame ${fromFrame}`);
  return hit.start;
}

/** Listener reaction: react `delay` frames after a speaker's word (6–10 is human). */
export const reactAt = (wordFrame: number, delay = 7) => wordFrame + delay;
