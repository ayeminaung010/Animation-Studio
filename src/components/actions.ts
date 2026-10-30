// Character actions as pure functions of the shot's local frame.
// Every pose comes from (frame, duration): no clocks, no unseeded randomness.
import { Easing, interpolate, random } from "remotion";

export type Euler3 = [number, number, number];

export interface Pose {
  /** Offsets from the character's mark (world units). */
  x: number;
  y: number;
  z: number;
  rotY: number;
  lean: number;
  tilt: number;
  head: Euler3;
  armL: Euler3;
  armR: Euler3;
  legL: number;
  legR: number;
  /** 0..1 sitting (hips drop, legs forward). */
  sit: number;
  /** 0..1 kneeling (hips drop, legs fold back). */
  kneel: number;
  squash: number;
}

// Arm euler: x < 0 swings the hand forward; z > 0 swings the left hand out (left arm is +x).
export const restPose = (): Pose => ({
  x: 0, y: 0, z: 0, rotY: 0, lean: 0, tilt: 0,
  head: [0, 0, 0],
  armL: [0, 0, 0.14],
  armR: [0, 0, -0.14],
  legL: 0, legR: 0, sit: 0, kneel: 0, squash: 1,
});

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = Easing.bezier(0.16, 1, 0.3, 1);
/** 0→1 between frames a and b, eased. */
const ramp = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], { ...clamp, easing: ease });
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wobble = (f: number, speed: number, amp: number, phase = 0) => Math.sin(f * speed + phase) * amp;

type ActionFn = (f: number, d: number, p: Pose) => Pose;

const ACTIONS: Record<string, ActionFn> = {
  idle: (f, _d, p) => ({ ...p, head: [0, wobble(f, 0.05, 0.08), 0] }),

  "say-sorry-wince": (f, _d, p) => {
    const t = ramp(f, 0, 8);
    return {
      ...p, lean: 0.16 * t, squash: 1 - 0.06 * t,
      head: [0.18 * t, 0, 0.12 * t],
      armL: [lerp(0, -1.0, t), 0, lerp(0.14, -0.35, t)],
      armR: [lerp(0, -1.0, t), 0, lerp(-0.14, 0.35, t)],
    };
  },

  "bump-cart": (f, _d, p) => {
    const push = ramp(f, 0, 10);
    const jolt = interpolate(f, [10, 13, 20], [0, 1, 0], clamp);
    return {
      ...p, z: 0.35 * push - 0.06 * jolt, lean: 0.2 * push - 0.25 * jolt,
      armL: [-1.25, 0, 0.1], armR: [-1.25, 0, -0.1],
      legL: wobble(f, 0.6, 0.35 * (1 - push)), legR: -wobble(f, 0.6, 0.35 * (1 - push)),
      head: [-0.1 * jolt, 0, 0],
    };
  },

  recoil: (f, _d, p) => {
    const t = ramp(f, 8, 14);
    return {
      ...p, z: -0.12 * t, lean: -0.28 * t,
      armL: [lerp(0, -2.1, t), 0, lerp(0.14, 0.45, t)],
      armR: [lerp(0, -2.1, t), 0, lerp(-0.14, -0.45, t)],
      head: [-0.15 * t, 0, 0],
    };
  },

  "hold-cake-alone": (f, d, p) => {
    const slump = ramp(f, 0, d);
    return {
      ...p, lean: 0.08 + 0.08 * slump, squash: 1 - 0.04 * slump,
      armL: [-1.15, 0, -0.15], armR: [-1.15, 0, 0.15],
      head: [0.25 + 0.1 * slump, 0, 0],
    };
  },

  "ignore-phone": (f, _d, p) => ({
    ...p, rotY: 0.45, armR: [-1.4, 0, 0.25], armL: [0, 0, 0.14],
    head: [-0.1, -0.5 + wobble(f, 0.06, 0.05), 0.08],
  }),

  "stare-at-phone": (f, _d, p) => ({
    ...p, lean: 0.08, armL: [-1.2, 0, -0.25], armR: [-1.2, 0, 0.25],
    head: [0.38 + wobble(f, 0.04, 0.02), 0, 0],
  }),

  flinch: (f, _d, p) => {
    const hit = interpolate(f, [2, 5, 14], [0, 1, 0.7], clamp);
    const shake = random(`flinch-${Math.floor(f / 2)}`) - 0.5;
    return {
      ...p, y: 0.05 * interpolate(f, [2, 5, 9], [0, 1, 0], clamp), lean: -0.3 * hit,
      squash: 1 - 0.08 * hit, x: shake * 0.03 * hit,
      armL: [-2.3 * hit, 0, 0.5 * hit], armR: [-2.3 * hit, 0, -0.5 * hit],
      head: [-0.2 * hit, 0, 0.1 * hit],
    };
  },

  "arms-cross-smug": (f, _d, p) => {
    const t = ramp(f, 0, 10);
    return {
      ...p, lean: -0.06 * t,
      armL: [lerp(0, -1.35, t), 0, lerp(0.14, -1.05, t)],
      armR: [lerp(0, -1.2, t), 0, lerp(-0.14, 1.0, t)],
      head: [-0.15 * t, 0, 0.12 * t + wobble(f, 0.08, 0.02)],
    };
  },

  "stand-proud": (f, _d, p) => {
    const t = ramp(f, 0, 12);
    return {
      ...p, lean: -0.1 * t, squash: 1 + 0.03 * t,
      armL: [0, 0, lerp(0.14, 0.7, t)],
      armR: [lerp(0, -0.3, t), 0, lerp(-0.14, -2.4, t) + wobble(f, 0.25, 0.12 * t)],
      head: [-0.18 * t, 0, 0],
    };
  },

  "wave-hello": (f, _d, p) => ({
    ...p, head: [0, 0, 0.1],
    armR: [-0.2, 0, -2.5 + wobble(f, 0.45, 0.3)],
    tilt: wobble(f, 0.45, 0.03),
  }),

  "check-phone": (f, _d, p) => ({
    ...p, rotY: -0.25, armR: [-1.3, 0, 0.3], armL: [0, 0, 0.14],
    head: [0.35, wobble(f, 0.05, 0.04), 0],
  }),

  "yell-point": (f, _d, p) => {
    const jab = Math.max(0, Math.sin(f * 0.8));
    return {
      ...p, lean: 0.22 + 0.05 * jab, squash: 1 + 0.03 * jab, y: 0.02 * jab,
      armR: [-1.55 + 0.15 * jab, 0, -0.05], armL: [0.2, 0, 0.3],
      head: [-0.1, 0, wobble(f, 0.8, 0.06)],
    };
  },

  "hold-tray-shrink": (f, d, p) => {
    const t = ramp(f, 4, d * 0.6);
    const tremble = (random(`tray-${f}`) - 0.5) * 0.02;
    return {
      ...p, lean: -0.1 * t, squash: 1 - 0.1 * t, x: tremble,
      armL: [-1.2, 0, 0.05], armR: [-1.2, 0, -0.05],
      head: [0.2 * t, 0, -0.1 * t],
    };
  },

  "look-at-watch": (f, d, p) => {
    const up = ramp(f, d * 0.45, d * 0.75);
    return {
      ...p, armL: [-1.35, 0, -0.55],
      head: [lerp(0.35, -0.05, up), lerp(0.2, wobble(f, 0.12, 0.6), up), 0],
    };
  },

  "sit-couch-cheer": (f, _d, p) => {
    const pump = Math.max(0, Math.sin(f * 0.55));
    return {
      ...p, sit: 1, y: 0.03 * pump, lean: -0.08,
      armL: [-0.2, 0, 2.5 + 0.2 * pump], armR: [-0.2, 0, -2.5 - 0.2 * pump],
      head: [-0.2, 0, wobble(f, 0.55, 0.08)],
    };
  },

  "sneer-turn-away": (f, _d, p) => {
    const turn = ramp(f, 10, 24);
    return {
      ...p, rotY: -2.3 * turn,
      head: [-0.1, 1.2 * turn, 0.1],
      armR: [0, 0, lerp(-0.14, -1.2, interpolate(f, [4, 10, 18], [0, 1, 0], clamp))],
    };
  },

  "clutch-cardigan": (f, d, p) => {
    const t = ramp(f, 0, d * 0.5);
    return {
      ...p, lean: 0.12 * t, squash: 1 - 0.05 * t,
      armL: [lerp(0, -1.05, t), 0, lerp(0.14, -0.55, t)],
      armR: [lerp(0, -1.0, t), 0, lerp(-0.14, 0.55, t)],
      head: [0.25 * t, 0, -0.08 * t],
    };
  },

  "single-tear": (f, _d, p) => ({ ...p, head: [0.12 + wobble(f, 0.05, 0.02), 0, -0.06], squash: 0.98 }),

  "wave-forgive": (f, d, p) => {
    const look = interpolate(f, [0, d * 0.35, d * 0.5], [1, 1, 0], clamp);
    return {
      ...p,
      armL: [-1.0, 0, -0.2],
      armR: [lerp(-0.2, 0, look), 0, lerp(-2.4 + wobble(f, 0.4, 0.3), -0.14, look)],
      head: [0.35 * look, 0, 0.12 * (1 - look)],
    };
  },

  shrug: (f, _d, p) => {
    const t = interpolate(f, [4, 10, 30, 40], [0, 1, 1, 0.6], clamp);
    return {
      ...p, y: 0.03 * t, squash: 1 + 0.02 * t,
      armL: [-0.45 * t, 0, lerp(0.14, 1.15, t)], armR: [-0.45 * t, 0, lerp(-0.14, -1.15, t)],
      head: [-0.05, 0, 0.2 * t],
    };
  },

  /** Seated, knees bouncing, hands shaking in the lap, small head tremble. */
  "sit-nervous": (f, _d, p) => {
    const j = (k: string) => (random(`nerv-${k}-${Math.floor(f / 2)}`) - 0.5) * 0.12;
    return {
      ...p, sit: 1, lean: 0.08, y: Math.abs(Math.sin(f * 0.9)) * 0.012,
      armL: [-0.75 + j("l"), 0, 0.12], armR: [-0.75 + j("r"), 0, -0.12],
      head: [0.05 + j("h") * 0.3, wobble(f, 0.07, 0.06), j("t") * 0.3],
    };
  },
  /** Seated behind a desk, forearms forward on it, small talking nods. */
  "sit-desk": (f, _d, p) => ({
    ...p, sit: 1, lean: 0.1, armL: [-1.25, 0, 0.18], armR: [-1.25 + wobble(f, 0.2, 0.12), 0, -0.18],
    head: [wobble(f, 0.18, 0.04), wobble(f, 0.05, 0.05), 0],
  }),
  /** Seated, leans back, raises one fist with pride. */
  "sit-proud": (f, _d, p) => {
    const t = ramp(f, 0, 12);
    return {
      ...p, sit: 1, lean: -0.12 * t, squash: 1 + 0.03 * t,
      armL: [-0.7, 0, 0.12], armR: [lerp(-0.7, -2.6, t), 0, lerp(-0.12, -0.4, t) + wobble(f, 0.3, 0.08 * t)],
      head: [-0.15 * t, 0, 0.08 * t],
    };
  },
  /** Gets up out of the chair, then slumps: head down, arms hanging. */
  "stand-up-sad": (f, _d, p) => {
    const up = ramp(f, 4, 22);
    const slump = ramp(f, 22, 40);
    return {
      ...p, sit: 1 - up, lean: 0.12 * slump, squash: 1 - 0.04 * slump,
      armL: [0.05 * slump, 0, 0.08], armR: [0.05 * slump, 0, -0.08], head: [0.45 * slump, 0, 0],
    };
  },
  /** Standing, jolts back in surprise with both hands up. */
  "stand-shocked": (f, _d, p) => {
    const hit = interpolate(f, [0, 4, 14], [0, 1, 0.8], clamp);
    return {
      ...p, y: 0.06 * interpolate(f, [0, 4, 9], [0, 1, 0], clamp), lean: -0.18 * hit,
      armL: [-1.8 * hit, 0, 0.6 * hit], armR: [-1.8 * hit, 0, -0.6 * hit], head: [-0.15 * hit, 0, 0],
    };
  },
  "sit-sofa": (f, _d, p) => ({ ...p, sit: 1, armL: [-0.65, 0, 0.1], armR: [-0.65, 0, -0.1], head: [0.05, -0.35 + wobble(f, 0.04, 0.03), 0] }),

  "pat-hand": (f, _d, p) => ({
    ...p, sit: 1, lean: 0.06,
    // Right arm is on the -x side: negative z reaches across toward someone on her right.
    armR: [-0.8 + Math.abs(Math.sin(f * 0.35)) * 0.15, 0, -0.85],
    armL: [-0.6, 0, 0.1],
    head: [0.1, 0.35, 0.12],
  }),

  "speak-gentle": (f, _d, p) => ({
    ...p, head: [0.04 + wobble(f, 0.18, 0.04), 0, 0.12 + wobble(f, 0.07, 0.03)],
    armL: [-0.5, 0, -0.3], armR: [-0.5, 0, 0.3],
  }),

  "crack-piggy": (f, d, p) => {
    const crack = Math.round(d * 0.45);
    const lift = ramp(f, 0, crack - 6);
    const slam = interpolate(f, [crack - 6, crack, crack + 8], [0, 1, 0.8], clamp);
    return {
      ...p, kneel: 1,
      armL: [-1.2 - 0.7 * lift + 0.9 * slam, 0, -0.2], armR: [-1.2 - 0.7 * lift + 0.9 * slam, 0, 0.2],
      lean: 0.15 + 0.15 * slam, head: [0.35, 0, 0],
    };
  },

  kneel: (f, _d, p) => {
    const t = ramp(f, 0, 8);
    return { ...p, kneel: t, lean: -0.1 * t, armL: [-0.3, 0, 0.3], armR: [-0.3, 0, -0.3], head: [0.15 - 0.3 * t, wobble(f, 0.05, 0.05), 0] };
  },

  "kneel-cry": (f, _d, p) => {
    const sob = Math.max(0, Math.sin(f * 0.5));
    return {
      ...p, kneel: 1, lean: 0.2 + 0.04 * sob, y: 0.01 * sob,
      armL: [-2.05, 0, -0.6], armR: [-2.05, 0, 0.6],
      head: [0.35 + 0.04 * sob, 0, 0],
    };
  },

  "kneel-still": (_f, _d, p) => ({ ...p, kneel: 1, lean: 0.25, armL: [-0.15, 0, 0.1], armR: [-0.15, 0, -0.1], head: [0.5, 0, 0], squash: 0.97 }),

  // ---------- sin-eater ----------
  /** Right hand lifts the bread to the mouth in bites; head dips to meet it. */
  "eat-bread": (f, _d, p) => {
    const bite = Math.max(0, Math.sin(f * 0.35));
    return {
      ...p, lean: 0.1, armR: [-2.0 - 0.35 * bite, 0, 0.45], armL: [-0.5, 0, 0.2],
      head: [0.15 + 0.1 * bite, 0, wobble(f, 0.7, 0.03)],
    };
  },
  /** Lying on the back, head towards −x, hands folded on the chest. Mark y sets the bier height. */
  "lie-dead": (_f, _d, p) => ({
    ...p, rotY: Math.PI / 2, lean: -Math.PI / 2, armL: [-1.3, 0, -0.75], armR: [-1.3, 0, 0.75], head: [0, 0, 0],
  }),
  "hand-bread-over": (f, _d, p) => {
    const t = ramp(f, 2, 12);
    return { ...p, lean: 0.12 * t, armR: [lerp(0, -1.45, t), 0, lerp(-0.14, 0.15, t)], head: [0.1 * t, 0, 0] };
  },
  "place-bread": (f, d, p) => {
    const t = ramp(f, 0, d * 0.5);
    return {
      ...p, lean: 0.35 * t, armL: [lerp(0, -1.1, t), 0, -0.2], armR: [lerp(0, -1.1, t), 0, 0.2],
      head: [0.3 * t, 0, 0],
    };
  },
  /** Walks a step or two towards camera. */
  "walk-in": (f, d, p) => {
    const step = Math.sin(f * 0.45);
    return {
      ...p, z: interpolate(f, [0, d], [-0.5, 0.15], clamp), y: 0.02 * Math.abs(step),
      legL: 0.35 * step, legR: -0.35 * step, armL: [-0.35 * step, 0, 0.14], armR: [0.35 * step, 0, -0.14],
      head: [0.15, 0, 0],
    };
  },
  "look-out-window": (f, _d, p) => ({
    ...p, lean: 0.06, armL: [-0.9, 0, -0.2], armR: [-0.9, 0, 0.2],
    head: [0.05, wobble(f, 0.04, 0.25), 0.08],
  }),
  /** Turns from the oven (behind-left) to face camera holding a fresh loaf in both hands. */
  "pull-bread-from-oven": (f, _d, p) => {
    const t = ramp(f, 0, 14);
    return {
      ...p, rotY: lerp(1.6, 0.15, t), lean: 0.05,
      armL: [-1.25, 0, -0.25], armR: [-1.25, 0, 0.25], head: [-0.05, 0, 0.1 * t],
    };
  },
  "sit-alone": (f, _d, p) => ({
    ...p, sit: 1, lean: 0.28, squash: 0.97, armL: [-0.7, 0, -0.1], armR: [-0.7, 0, 0.1],
    head: [0.35 + wobble(f, 0.05, 0.02), 0, 0],
  }),
  /** Drops coins into a jar one at a time. */
  "count-coins": (f, _d, p) => {
    const drop = Math.max(0, Math.sin(f * 0.3));
    return { ...p, lean: 0.15, armR: [-1.2 - 0.3 * drop, 0, 0.3], armL: [-0.9, 0, -0.25], head: [0.35, 0, 0] };
  },
  /** Hand shading the eyes, gazing off down the road. */
  "look-far": (f, _d, p) => {
    const t = ramp(f, 0, 12);
    return {
      ...p, lean: 0.05 * t, armR: [lerp(0, -2.75, t), 0, lerp(-0.14, 0.75, t)],
      head: [-0.1 * t, -0.25 * t + wobble(f, 0.05, 0.05), 0],
    };
  },
  /** Holds a coin up to look at it. */
  "hold-coin": (f, _d, p) => {
    const t = ramp(f, 0, 10);
    return { ...p, armR: [lerp(0, -1.9, t), 0, lerp(-0.14, 0.35, t)], head: [0.12 * t, -0.15 * t, 0.06 * t] };
  },
  "give-coin": (f, _d, p) => {
    const t = ramp(f, 3, 14);
    return { ...p, lean: 0.08 * t, armR: [lerp(0, -1.5, t), 0, lerp(-0.14, 0.25, t)], head: [-0.08, 0, 0.06] };
  },
  /** Leans aside with a hand cupped at the mouth. */
  whisper: (f, _d, p) => {
    const t = ramp(f, 0, 10);
    return { ...p, tilt: -0.14 * t, lean: 0.08 * t, armL: [lerp(0, -2.3, t), 0, lerp(0.14, -0.6, t)], head: [0.05, 0, -0.15 * t + wobble(f, 0.3, 0.02)] };
  },
  /** Lunges to grab someone's arm (the other character on −x… set facing in the layout). */
  "grab-arm": (f, _d, p) => {
    const t = ramp(f, 0, 7);
    return { ...p, lean: 0.18 * t, x: 0.08 * t, armR: [lerp(0, -1.55, t), 0, lerp(-0.14, 0.1, t)], armL: [-0.4 * t, 0, 0.3], head: [-0.05, 0, 0] };
  },
  /** Slowly raises the bottle beside her face. */
  "hold-poison": (f, d, p) => {
    const t = ramp(f, 0, d * 0.5);
    return { ...p, armR: [lerp(0, -2.2, t), 0, lerp(-0.14, 0.45, t)], head: [-0.05 * t, -0.12 * t, 0.12 * t] };
  },
  /** Holds the book in front (book slams on its own cue). */
  "close-book": (f, _d, p) => ({
    ...p, armL: [-1.15, 0, -0.32], armR: [-1.15, 0, 0.32], head: [0.08, 0, wobble(f, 0.06, 0.03)],
  }),

  // ---------- best-man-heist ----------
  /** Runs with a bride over the shoulder: forward lean, fast legs, one arm holding her legs. */
  "carry-run": (f, d, p) => {
    const step = Math.sin(f * 0.7);
    return {
      ...p, x: interpolate(f, [0, d], [-0.25, 0.25], clamp), y: 0.05 * Math.abs(step), lean: 0.22,
      legL: 0.7 * step, legR: -0.7 * step, armL: [-1.1, 0, 0.5], armR: [-1.2, 0, -0.5 + 0.1 * step],
      head: [0.1, 0, wobble(f, 0.7, 0.05)],
    };
  },
  /** Draped across a carrier's shoulder: body horizontal, head hanging, legs kicking. */
  "carried-over-shoulder": (f, d, p) => {
    const kick = Math.sin(f * 0.7);
    return {
      ...p, x: interpolate(f, [0, d], [-0.15, 0.35], clamp), y: 0.6 + 0.05 * Math.abs(kick), tilt: 1.4,
      legL: 0.5 * kick, legR: -0.5 * kick, armL: [-0.4, 0, 0.8 + 0.2 * kick], armR: [-0.4, 0, -0.8 - 0.2 * kick],
      head: [0.1, 0, -0.5],
    };
  },
  /** Walks across the frame while counting on the fingers. */
  "pace-count": (f, d, p) => {
    const step = Math.sin(f * 0.45);
    return {
      ...p, x: interpolate(f, [0, d], [-0.5, 0.5], clamp), y: 0.02 * Math.abs(step),
      legL: 0.35 * step, legR: -0.35 * step, armL: [-0.35 * step, 0, 0.14], armR: [-1.2, 0, -0.2],
      head: [0.05, wobble(f, 0.2, 0.3), 0],
    };
  },
  /** Standing guard, nods off: head sinks, sways, jerks up once. */
  "sleep-standing": (f, d, p) => {
    const sink = ramp(f, 0, d * 0.6);
    const jerk = interpolate(f, [d * 0.7, d * 0.75, d * 0.82], [0, 1, 0], clamp);
    return {
      ...p, lean: 0.12 * sink - 0.1 * jerk, squash: 1 - 0.03 * sink, tilt: wobble(f, 0.08, 0.04 * sink),
      armL: [0, 0, 0.14], armR: [-0.1, 0, -0.14],
      head: [0.65 * sink - 0.5 * jerk, 0, 0.15 * sink],
    };
  },
  /** Right hand pulls the sword out and up; stance widens. */
  "draw-sword": (f, _d, p) => {
    const t = ramp(f, 0, 9);
    return {
      ...p, lean: -0.08 * t, armR: [lerp(0, -0.4, t), 0, lerp(-0.14, -2.4, t)], armL: [-0.3 * t, 0, 0.6 * t],
      head: [-0.12 * t, 0, 0],
    };
  },
  /** Big yawn: head tips back, hand comes up to the mouth. */
  yawn: (f, d, p) => {
    const t = interpolate(f, [2, d * 0.35, d * 0.75, d], [0, 1, 1, 0.3], clamp);
    return {
      ...p, squash: 1 + 0.04 * t, lean: -0.08 * t, armR: [lerp(0, -2.3, t), 0, lerp(-0.14, 0.5, t)],
      head: [-0.3 * t, 0, 0.1 * t],
    };
  },
  /** Sly wink: head tilts toward the camera, one finger up to the cheek. */
  wink: (f, _d, p) => {
    const t = ramp(f, 3, 10);
    return {
      ...p, tilt: -0.05 * t, armL: [lerp(0, -2.1, t), 0, lerp(0.14, -0.5, t)],
      head: [-0.05 * t, 0, 0.22 * t + wobble(f, 0.3, 0.02)],
    };
  },
  /** Two slow, small nods. */
  nod: (f, _d, p) => ({ ...p, head: [0.18 * Math.max(0, Math.sin(f * 0.3)) + 0.04, 0, 0] }),

  /** Leans hard into something heavy in front, both hands on it, shoving in pulses. */
  "push-heavy": (f, _d, p) => {
    const shove = Math.max(0, Math.sin(f * 0.22));
    return {
      ...p, lean: 0.38 + 0.06 * shove, z: 0.02 * shove, squash: 1 - 0.03 * shove,
      armL: [-1.45, 0, 0.12], armR: [-1.45, 0, -0.12],
      legL: -0.35, legR: 0.3, head: [-0.25, 0, 0],
    };
  },
  /** Big belly laugh: bouncing, leaning back, arms out. */
  "laugh-bounce": (f, _d, p) => {
    const b = Math.abs(Math.sin(f * 0.35));
    return {
      ...p, y: 0.04 * b, lean: -0.15 - 0.08 * b, squash: 1 - 0.04 * b,
      armL: [-0.3, 0, 0.55 + 0.15 * b], armR: [-0.3, 0, -0.55 - 0.15 * b],
      head: [-0.3 - 0.1 * b, 0, wobble(f, 0.35, 0.05)],
    };
  },
  /** Slow "no" head shake, arms behind the back. */
  "shake-head": (f, _d, p) => ({
    ...p, lean: -0.04, armL: [0.35, 0, 0.1], armR: [0.35, 0, -0.1],
    head: [0.08, Math.sin(f * 0.25) * 0.35 * interpolate(f, [0, 8, 40, 55], [0, 1, 1, 0.2], clamp), 0],
  }),
  /** Calm double pat on something at waist height beside him (his left). */
  "pat-sack": (f, _d, p) => {
    const pat = Math.max(0, Math.sin(f * 0.3));
    return { ...p, rotY: 0.2, armL: [-0.55 + 0.25 * pat, 0, 0.45], head: [-0.06, 0.2, 0.08] };
  },
  /** Hammer swings: right arm up and down. */
  hammer: (f, _d, p) => {
    const swing = (Math.sin(f * 0.4) + 1) / 2;
    return { ...p, lean: 0.12, armR: [-1.2 - 1.3 * swing, 0, -0.15], armL: [-0.6, 0, 0.2], head: [0.15, 0, 0] };
  },
  /** Bends to look down into a hole in front. */
  "peer-down": (f, _d, p) => ({
    ...p, lean: 0.45, armL: [-0.2, 0, 0.4], armR: [-0.2, 0, -0.4], head: [0.45, wobble(f, 0.06, 0.1), 0],
  }),
  /** Lifts a glass (right hand) to the mouth and keeps it there. */
  "sip-drink": (f, _d, p) => {
    const t = ramp(f, 2, 14);
    return { ...p, armR: [lerp(-0.6, -2.2, t), 0, lerp(-0.14, 0.45, t)], head: [-0.25 * t, 0, 0] };
  },
  /** Walks in place with a crate held in front at chest height. */
  "carry-crate": (f, _d, p) => {
    const s = Math.sin(f * 0.3);
    return {
      ...p, lean: 0.1, y: 0.015 * Math.abs(s), legL: 0.4 * s, legR: -0.4 * s,
      armL: [-1.25, 0, -0.1], armR: [-1.25, 0, 0.1], head: [0.05, 0, 0],
    };
  },
  /** Touches the hat brim with the right hand and a little bow. */
  "tip-hat": (f, _d, p) => {
    const t = interpolate(f, [4, 12, 26, 34], [0, 1, 1, 0.3], clamp);
    return { ...p, lean: 0.12 * t, armR: [-0.4 * t, 0, lerp(-0.14, -2.7, t)], head: [0.12 * t, 0, 0.06] };
  },
};

export const ACTION_NAMES = Object.keys(ACTIONS);

export const poseFor = (action: string, frame: number, duration: number): Pose => {
  const fn = ACTIONS[action];
  if (!fn) throw new Error(`Unknown character action "${action}". Add it to src/components/actions.ts`);
  const p = fn(frame, duration, restPose());
  // Breathing so nobody is ever frozen.
  return { ...p, y: p.y + Math.sin(frame * 0.12) * 0.006 };
};
