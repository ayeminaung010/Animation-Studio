// Shot staging shared by ShotView (v1/v2 shots) and the v1 → v2 migration: prop placements and
// the camera's aim. Pure functions of the shot, its LAYOUT entry and a shot-local frame.
import type { CameraSpec } from "../components/CameraRig";
import { poseFor } from "../components/actions";
import { headWorld, markWorld, poseDrop } from "../components/Character";
import type { Shot, Vec3 } from "./shots";
import type { StartAt } from "./timing";

export interface Placement {
  /** World position, or an offset inside the slot when `hand`/`head`/`front` is set. */
  at?: Vec3;
  rot?: Vec3;
  scale?: number;
  hand?: "L" | "R";
  head?: boolean;
  front?: boolean;
  /** Character that holds/wears/carries the prop. */
  char?: string;
  /** Offset from the prop position to where the camera should aim. */
  focus?: Vec3;
  /** Delay the prop's own animation: a frame, or a spoken word in this shot (it starts on that word). */
  startAt?: StartAt;
}


export interface ShotLayout {
  /** Placement per prop name; the i-th occurrence in the shot list uses the i-th entry. */
  props?: Record<string, Placement[]>;
  /** Props not in the shot list that the scene still needs (a phone in a hand…). */
  extra?: { name: string; place: Placement }[];
  chars?: Record<string, { facing?: number; offset?: Vec3 }>;
  /** Override the camera's aim point (world). */
  target?: Vec3;
  /** Multiply the framing heights (for tiny or huge subjects). */
  frameScale?: number;
  azimuth?: number;
  elevation?: number;
  bulb?: Vec3;
}

export interface Placed {
  name: string;
  place: Placement;
}

export const add = (a: Vec3, b: Vec3 = [0, 0, 0]): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const rotY = (v: Vec3, a: number): Vec3 => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];

/** Every prop occurrence in the shot with its placement (the i-th occurrence uses the i-th entry). */
export const placementsFor = (shot: Shot, layout: ShotLayout): Placed[] => {
  const seen: Record<string, number> = {};
  return [
    ...shot.props.map((name) => {
      const i = seen[name] ?? 0;
      seen[name] = i + 1;
      const list = layout.props?.[name] ?? [];
      return { name, place: list[i] ?? list[list.length - 1] ?? {} };
    }),
    ...(layout.extra ?? []),
  ];
};

/** Camera spec at a shot-local frame: aim at a layout override, a character's head, or a placed prop. */
export const cameraSpecAt = (shot: Shot, layout: ShotLayout, placed: Placed[], fr: number, d: number): CameraSpec => {
  const chars = layout.chars ?? {};
  const tName = shot.camera.target;
  const tChar = shot.characters.find((c) => c.id === tName);
  let target: Vec3 = [0, 1.2, 0];
  let isCharacter = false;
  if (layout.target) {
    target = layout.target;
  } else if (tChar) {
    // Aim at the head where the pose actually puts it (kneeling, sitting, leaning).
    const pose = poseFor(tChar.action, fr, d);
    target = headWorld(tChar.pos, chars[tChar.id]?.offset, poseDrop(pose) + Math.max(0, pose.lean) * 0.55);
    isCharacter = true;
  } else {
    const p = placed.find((x) => x.name === tName)?.place;
    if (p?.char) {
      const c = shot.characters.find((x) => x.id === p.char);
      if (c) {
        const facing = chars[c.id]?.facing ?? 0;
        target = add(add(markWorld(c.pos, chars[c.id]?.offset), rotY(p.at ?? [0, 0, 0], facing)), p.focus);
      }
    } else if (p) {
      target = add(p.at ?? [0, 0, 0], p.focus);
    }
  }
  return {
    move: shot.camera.move,
    from: shot.camera.from,
    to: shot.camera.to,
    target,
    isCharacter,
    azimuth: layout.azimuth,
    elevation: layout.elevation,
    frameScale: layout.frameScale,
  };
};
