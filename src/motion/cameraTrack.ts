// Continuous camera (motion v2): one cameraTrack() per take, plus handheld drift and impact shakes.
// Keys come from CameraRig framings; pure in (frame, fps, track).
import { framingAt, type CameraSpec } from "../components/CameraRig";
import { cameraTrack, handheld, impactShake, lerp, SPRINGS, type CameraKey, type Vec3 } from "./motion-kit";

/** Camera tuning knobs. */
export const CAMERA = {
  /** The camera starts moving this early so it arrives on each key's frame (motion-kit default). */
  leadSec: 1.1,
  /** Target ramp, so moves start with zero acceleration (motion-kit default). */
  rampSec: 0.45,
  /** A key every N frames along a shot's move (from → to framing). */
  stepFrames: 15,
  /** Jumps between framings are split into steps of at most this many world units... */
  maxStep: 0.6,
  /** ...spread over at most this long before the key, so big pull-outs don't whoosh. */
  maxMoveSec: 2,
  /** Handheld amplitude (motion-kit units are sized for a 1-unit-tall rig; ours are 1.75). */
  handheld: 1.5,
  /** Impact shake multiplier, same scaling. */
  shake: 1.75,
};

export interface TrackSpec {
  keys: CameraKey[];
  shakes?: { frame: number; strength: number }[];
  seed: number;
  handheld?: number;
}

const toVec = (v: { x: number; y: number; z: number }): Vec3 => [v.x, v.y, v.z];
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const lerpV = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Keys along one shot's move, starting at `from`. `specAt(frame)` lets the aim follow a moving subject. */
export const moveKeys = (specAt: (frame: number) => CameraSpec, from: number, duration: number): CameraKey[] => {
  const n = Math.max(1, Math.round(duration / CAMERA.stepFrames));
  return Array.from({ length: n + 1 }, (_, j) => {
    const frame = from + Math.round((j * duration) / n);
    const r = framingAt(specAt(frame - from), j / n);
    return { frame, pos: toVec(r.eye), lookAt: toVec(r.aim), fov: r.fov };
  });
};

/** Splits big jumps into evenly spaced steps that finish on the original key's frame. */
export const densify = (keys: CameraKey[], fps: number): CameraKey[] => {
  const out: CameraKey[] = keys.slice(0, 1);
  for (const b of keys.slice(1)) {
    const a = out[out.length - 1];
    const n = Math.ceil(Math.max(dist(a.pos, b.pos), dist(a.lookAt, b.lookAt)) / CAMERA.maxStep);
    const window = Math.min(b.frame - a.frame, Math.round(CAMERA.maxMoveSec * fps));
    for (let j = 1; j < n && window > 0; j++) {
      const t = j / n;
      out.push({
        frame: b.frame - window + Math.round(t * window),
        pos: lerpV(a.pos, b.pos, t),
        lookAt: lerpV(a.lookAt, b.lookAt, t),
        fov: lerp(a.fov, b.fov, t),
      });
    }
    out.push(b);
  }
  return out;
};

/** Camera position, aim, fov and handheld rotation at a frame. */
export const trackAt = (frame: number, fps: number, t: TrackSpec) => {
  const c = cameraTrack(frame, fps, t.keys, CAMERA.leadSec, SPRINGS.camera, CAMERA.rampSec);
  const h = handheld(frame, fps, t.seed, t.handheld ?? CAMERA.handheld);
  const s = (t.shakes ?? []).map((k) => impactShake(frame, fps, k.frame, k.strength * CAMERA.shake, t.seed));
  const pos: Vec3 = [0, 1, 2].map((i) => c.pos[i] + h.pos[i] + s.reduce((a, v) => a + v[i], 0)) as Vec3;
  return { pos, lookAt: c.lookAt, fov: c.fov, rot: h.rot };
};
