// Camera framings and moves, computed from the shot's local frame only.
import { PerspectiveCamera } from "@react-three/drei";
import React, { useMemo } from "react";
import { Easing, interpolate, random } from "remotion";
import * as THREE from "three";
import type { CameraMove, Framing, Vec3 } from "../lib/shots";

/**
 * Visible frame height (world units) at the target, per framing. In 9:16 the width
 * (0.5625 × height) is the tight side, so these are sized for width: a close shot
 * fits a whole head (0.68 wide) with room to spare.
 */
const FRAME_H: Record<Framing, number> = {
  "extreme-wide": 14,
  wide: 6.6,
  medium: 3.6,
  close: 2.0,
  "extreme-close": 1.15,
};

/** How far below a character's head centre to aim, so wider shots show the body. */
const AIM_DROP: Record<Framing, number> = {
  "extreme-wide": 0,
  wide: 0.55,
  medium: 0.4,
  close: 0.12,
  "extreme-close": 0.02,
};

const BASE_FOV = 40;
const distFor = (h: number, fovDeg: number) => h / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));

export interface CameraSpec {
  move: CameraMove;
  from: Framing;
  to: Framing;
  target: Vec3;
  /** True when the target is a character head (aim drops for wide framings). */
  isCharacter: boolean;
  /** Base horizontal angle around the target, radians (0 = straight on). */
  azimuth?: number;
  /** Extra height for the camera, as a fraction of distance. */
  elevation?: number;
  /** Multiplies the framing heights (tiny or huge subjects). */
  frameScale?: number;
}

/** The framing at progress `p` (0 = `from`, 1 = `to`) of the shot's move, without time-based extras (whip, shake). */
export const framingAt = (spec: CameraSpec, p: number) => {
  const { move, from, to, target, isCharacter, azimuth = 0, elevation = 0.12, frameScale = 1 } = spec;
  const h1 = FRAME_H[from] * frameScale;
  let h2 = FRAME_H[to] * frameScale;
  if (move === "push-in" && h2 >= h1) h2 = h1 * 0.78;
  if (move === "pull-out" && h2 <= h1) h2 = h1 * 1.3;
  const h = h1 + (h2 - h1) * p;

  const drop = isCharacter ? AIM_DROP[from] + (AIM_DROP[to] - AIM_DROP[from]) * p : 0;
  const aim = new THREE.Vector3(target[0], target[1] - drop, target[2]);

  let fov = BASE_FOV;
  if (move === "dolly-zoom") fov = 20 + 45 * p;
  const d = distFor(h, fov);

  let az = azimuth;
  if (move === "orbit") az += -0.38 + 0.76 * p;

  const eye = new THREE.Vector3(
    aim.x + Math.sin(az) * d,
    aim.y + d * (from === "extreme-wide" ? 0.28 : elevation),
    aim.z + Math.cos(az) * d,
  );

  const side = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
  if (move === "pan-left" || move === "pan-right") {
    const dir = move === "pan-left" ? -1 : 1;
    // A gentle drift (±8% of frame height) so subjects stay in frame.
    const off = side.clone().multiplyScalar(dir * h * 0.08 * (p * 2 - 1));
    eye.add(off);
    aim.add(off);
  }
  return { eye, aim, fov, h, side };
};

export const cameraAt = (spec: CameraSpec, frame: number, duration: number) => {
  const { move } = spec;
  const p = interpolate(frame, [0, Math.max(1, duration - 1)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.33, 0, 0.2, 1),
  });
  const { eye, aim, fov, h, side } = framingAt(spec, p);
  if (move === "whip") {
    const w = interpolate(frame, [0, 7], [1, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
    aim.add(side.clone().multiplyScalar(h * 1.4 * w));
  }
  if (move === "shake") {
    const k = Math.floor(frame / 2);
    const amp = h * 0.03;
    const jitter = new THREE.Vector3(random(`sx${k}`) - 0.5, random(`sy${k}`) - 0.5, 0).multiplyScalar(amp);
    eye.add(jitter);
    aim.add(jitter.multiplyScalar(0.5));
  }
  return { eye, aim, fov };
};

export const CameraRig: React.FC<{ spec: CameraSpec; frame: number; duration: number }> = ({ spec, frame, duration }) => {
  const { eye, aim, fov } = cameraAt(spec, frame, duration);
  const rotation = useMemo(() => {
    const m = new THREE.Matrix4().lookAt(eye, aim, new THREE.Vector3(0, 1, 0));
    return new THREE.Euler().setFromRotationMatrix(m);
    // eye/aim are rebuilt every frame; their values are the real dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eye.x, eye.y, eye.z, aim.x, aim.y, aim.z]);
  return (
    <PerspectiveCamera makeDefault position={eye} rotation={rotation} fov={fov} near={0.05} far={200} />
  );
};
