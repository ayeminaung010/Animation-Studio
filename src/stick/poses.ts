// Poses as pure functions of the shot-local frame. Angles are absolute, in radians from straight
// down; positive swings toward screen right. armL/legL are drawn on screen right, armR/legR on
// screen left (mirrored with `flip`). Grandpa's phone sits in the armR hand.
import { random } from "remotion";

export interface Pose {
  /** Torso tilt (radians, + leans toward screen right). */
  lean: number;
  /** Head tilt relative to the torso. */
  head: number;
  armL: [number, number];
  armR: [number, number];
  legL: [number, number];
  legR: [number, number];
  /** Body offset up (px at scale 1): bob, jump. */
  lift: number;
}

const TAU = Math.PI * 2;
const wave = (f: number, fps: number, hz: number, seed: string) => Math.sin((f / fps) * hz * TAU + random(seed) * TAU);

const stand = (f: number, fps: number, name: string): Pose => ({
  lean: 0.02 * wave(f, fps, 0.3, `${name}-lean`),
  head: 0.03 * wave(f, fps, 0.25, `${name}-head`),
  armL: [0.22, 0.12],
  armR: [-0.22, -0.12],
  legL: [0.14, 0.08],
  legR: [-0.14, -0.08],
  lift: 3 * wave(f, fps, 0.4, `${name}-breath`),
});

const EAR_R: [number, number] = [-2.0, -2.98];

export const POSES = {
  idle: (f: number, fps: number) => stand(f, fps, "idle"),
  "phone-ear": (f: number, fps: number) => ({ ...stand(f, fps, "phone"), armR: EAR_R, armL: [0.35, -0.5] as [number, number], head: -0.08 }),
  talk: (f: number, fps: number) => {
    const g = wave(f, fps, 1.4, "talk-hand");
    return { ...stand(f, fps, "talk"), armR: EAR_R, armL: [1.0 + 0.25 * g, 2.0 + 0.35 * g] as [number, number] };
  },
  facepalm: (f: number, fps: number) => ({ ...stand(f, fps, "facepalm"), armR: EAR_R, armL: [2.3, -2.2] as [number, number], head: 0.25, lean: 0.08 }),
  shrug: (f: number, fps: number) => {
    const up = 6 * Math.abs(wave(f, fps, 0.6, "shrug"));
    return { ...stand(f, fps, "shrug"), armR: [-1.05, -2.5] as [number, number], armL: [1.05, 2.5] as [number, number], head: 0.12, lift: up };
  },
  type: (f: number, fps: number) => {
    const j = 0.15 * wave(f, fps, 7, "type-r");
    const k = 0.15 * wave(f, fps, 6.3, "type-l");
    return { ...stand(f, fps, "type"), armR: [-0.4, 0.5 + j] as [number, number], armL: [0.4, -0.5 + k] as [number, number], head: 0.1 };
  },
  point: (f: number, fps: number) => {
    const jab = 0.08 * wave(f, fps, 2, "point");
    return { ...stand(f, fps, "point"), armR: EAR_R, armL: [1.55 + jab, 1.6 + jab] as [number, number] };
  },
  slump: (f: number, fps: number) => ({ ...stand(f, fps, "slump"), armR: [-0.06, 0] as [number, number], armL: [0.06, 0] as [number, number], head: 0.4, lean: 0.06, lift: -12 }),
  jump: (f: number, fps: number) => {
    const hop = Math.abs(Math.sin((f / fps) * 2.4 * Math.PI));
    return { ...stand(f, fps, "jump"), armR: [-2.2, -2.5] as [number, number], armL: [2.2, 2.5] as [number, number], legL: [0.35, -0.1] as [number, number], legR: [-0.35, 0.1] as [number, number], lift: 40 * hop };
  },
  "lean-in": (f: number, fps: number) => ({ ...stand(f, fps, "lean"), armR: EAR_R, armL: [0.5, -0.3] as [number, number], lean: -0.12, head: -0.15 }),
  wave: (f: number, fps: number) => ({ ...stand(f, fps, "wave"), armR: EAR_R, armL: [2.3, 2.9 + 0.4 * wave(f, fps, 1.6, "wave")] as [number, number] }),
  "hug-phone": (f: number, fps: number) => ({ ...stand(f, fps, "hug"), armR: EAR_R, armL: [2.6, -1.8] as [number, number], head: -0.18 }),
} satisfies Record<string, (f: number, fps: number) => Pose>;

export type PoseName = keyof typeof POSES;

export const pose = (name: string): ((f: number, fps: number) => Pose) => {
  const p = (POSES as Record<string, (f: number, fps: number) => Pose>)[name];
  if (!p) throw new Error(`Unknown pose "${name}" — add it to POSES in src/stick/poses.ts`);
  return p;
};
