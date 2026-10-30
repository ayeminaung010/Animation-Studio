// Gesture poses (engine v1.1 vocabulary) as target joint rotations, blended by gesture() weight.
// Arms are given for the RIGHT arm (on −x); the left arm mirrors them: [x, −y, −z].
// Arm euler: x < 0 swings the hand forward; z < 0 swings the right arm outward.
import type { Euler3 } from "../components/actions";

export const GESTURE_POSES = [
  "point", "raise", "shrug", "wave", "handsOnHips", "smash", "pour", "slam", "grab_collar",
  "count_money", "hand_over", "facepalm", "fist_pump", "cover_mouth", "thumbs_back",
] as const;
export type GesturePose = (typeof GESTURE_POSES)[number];

export interface GestureTarget {
  arm: Euler3;
  /** Elbow bend (radians, forearm swings forward/up). */
  bend: number;
  /** Turns the bend plane about the arm's own axis (+π/2 bends the right forearm inward). */
  twist?: number;
  /** Rubber-hose arm length multiplier, for reaches the 0.42 arm can't make (face, mouth). */
  stretch?: number;
  /** Arm used when the shot says `arm: "auto"`. */
  side: "R" | "both";
  lean?: number;
  head?: Euler3;
  /** Shoulder lift (world units), only on the positive part of the weight. */
  shoulder?: number;
  /** Wind-up fraction for anticipation (motion-kit default 0.18). */
  windup?: number;
  /** Keeps moving while held: wave flaps the arm, count_money flicks the forearm. */
  osc?: { channel: "z" | "bend"; amp: number; speed: number };
}

export const GESTURES: Record<GesturePose, GestureTarget> = {
  point: { arm: [-1.55, 0, -0.05], bend: 0, side: "R", lean: 0.1, head: [-0.05, 0, 0] },
  raise: { arm: [-0.2, 0, -2.75], bend: 0.15, side: "R", head: [-0.1, 0, 0] },
  shrug: { arm: [-0.45, 0, -1.15], bend: 0.5, side: "both", shoulder: 0.045, head: [-0.05, 0, 0.2] },
  wave: { arm: [-0.2, 0, -2.5], bend: 0.35, side: "R", head: [0, 0, 0.1], osc: { channel: "z", amp: 0.3, speed: 0.45 } },
  handsOnHips: { arm: [0.15, 0, -0.95], bend: 1.9, twist: Math.PI / 2, side: "both", lean: -0.06, head: [-0.1, 0, 0] },
  smash: { arm: [-1.0, 0, -0.1], bend: 0, side: "both", lean: 0.35, windup: 0.55, head: [0.15, 0, 0] },
  pour: { arm: [-1.3, 0, 0.2], bend: 0.3, side: "R", head: [0.25, 0, 0] },
  slam: { arm: [-0.9, 0, -0.1], bend: 0.2, side: "R", lean: 0.25, windup: 0.45, head: [0.12, 0, 0] },
  grab_collar: { arm: [-1.5, 0, 0.25], bend: 0.3, side: "both", lean: 0.2 },
  count_money: { arm: [-1.0, 0, 0.25], bend: 0.8, side: "both", lean: 0.1, head: [0.3, 0, 0], osc: { channel: "bend", amp: 0.25, speed: 0.5 } },
  hand_over: { arm: [-1.5, 0, 0.25], bend: 0, side: "R", lean: 0.08, head: [-0.08, 0, 0.06] },
  facepalm: { arm: [-2.21, 0, 0.28], bend: 0.35, stretch: 1.45, side: "R", head: [0.35, 0, 0] },
  fist_pump: { arm: [-0.4, 0, -0.3], bend: 2.2, side: "R", windup: 0.3, head: [-0.15, 0, 0] },
  cover_mouth: { arm: [-2.39, 0, 0.46], bend: 0.3, stretch: 1.38, side: "R", lean: -0.05, head: [-0.05, 0, 0] },
  thumbs_back: { arm: [0.35, 0, -1.3], bend: 1.9, twist: -Math.PI / 2, side: "R", head: [0, -0.25, 0] },
};

export const mirror = (e: Euler3): Euler3 => [e[0], -e[1], -e[2]];
