/**
 * Stickman.tsx — a toon stickman rig for @remotion/three that stays alive.
 *
 * Every frame it combines these layers (motion-kit.ts):
 *   idle + breathe + blink  (always on)
 *   gazeChain               (eyes → head → body)
 *   gestures                (anticipation / overshoot / settle)
 *   mouth + talkNods        (only while this character speaks)
 *   followThrough           (hat wobbles behind the head)
 *
 * Swap the primitive meshes for your own models. Keep the pivot structure:
 * root → hips → torso → (head → hat) + (shoulderL/R → arm) ; hips → legs.
 */
import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import {
  idle, breathe, blink, gazeChain, gesture, mouth, talkNods, followThrough,
  lerp, type GazeKey, type WordTiming, type Vec3,
} from './motion-kit';

export type GesturePose = 'point' | 'raise' | 'shrug' | 'wave' | 'handsOnHips';

export interface Performance {
  /** Where the character looks over time. */
  gaze?: GazeKey[];
  /** Gestures, each hitting on a word frame. */
  gestures?: { arm: 'L' | 'R' | 'both'; pose: GesturePose; hitFrame: number; hold?: number }[];
  /** Word timings this character SPEAKS (frames). */
  speaks?: WordTiming[];
  /** Frames of stressed words (nods). */
  stress?: number[];
  /** Expression swaps: brow raise / mouth smile amount, springing between keys. */
  smile?: { frame: number; value: number }[];
  /** 0.5 calm … 1.6 nervous. */
  energy?: number;
}

export interface StickmanProps {
  seed: number;
  position: Vec3;
  facing?: number;
  torsoColor?: string;
  hatColor?: string;
  performance?: Performance;
}

const INK = '#16161f';

// Arm target rotations [shoulderZ, shoulderX] per pose, for the RIGHT arm.
const POSES: Record<GesturePose, [number, number]> = {
  point: [1.45, -0.35],
  raise: [2.6, 0],
  shrug: [0.75, 0.5],
  wave: [2.3, -0.2],
  handsOnHips: [0.55, 0.9],
};

export const Stickman: React.FC<StickmanProps> = ({
  seed, position, facing = 0, torsoColor = '#7fe3c4', hatColor = '#1b1b1b', performance = {},
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = performance;
  const energy = p.energy ?? 1;

  const id = idle(frame, fps, seed, energy);
  const br = breathe(frame, fps, seed);
  const gz = gazeChain(frame, fps, p.gaze ?? [{ frame: 0, yaw: 0 }]);
  const lid = blink(frame, fps, seed, gz.blinkAt);

  // Gestures → per-arm blend weights and target poses
  let armR = { w: 0, pose: POSES.point };
  let armL = { w: 0, pose: POSES.point };
  for (const g of p.gestures ?? []) {
    const w = gesture(frame, fps, { hitFrame: g.hitFrame, hold: g.hold });
    if (g.arm !== 'L' && Math.abs(w) > Math.abs(armR.w)) armR = { w, pose: POSES[g.pose] };
    if (g.arm !== 'R' && Math.abs(w) > Math.abs(armL.w)) armL = { w, pose: POSES[g.pose] };
  }
  const restZ = 0.12;
  const rShoulderZ = lerp(restZ, armR.pose[0], armR.w) + id.armR;
  const rShoulderX = lerp(0, armR.pose[1], armR.w);
  const lShoulderZ = -(lerp(restZ, armL.pose[0], armL.w) + id.armL);
  const lShoulderX = lerp(0, armL.pose[1], armL.w);

  // Shrugs lift the shoulders too (body sells the gesture, not just the arm)
  const shrugLift = (p.gestures ?? [])
    .filter((g) => g.pose === 'shrug')
    .reduce((s, g) => s + Math.max(0, gesture(frame, fps, { hitFrame: g.hitFrame, hold: g.hold })) * 0.035, 0);

  // Speech
  const mouthOpen = p.speaks ? mouth(frame, p.speaks, seed) : 0;
  const nod = p.stress ? talkNods(frame, fps, p.stress) : 0;

  // Head angles = idle + gaze + nods
  const headYaw = id.headYaw + gz.headYaw;
  const headPitch = id.headPitch + gz.headPitch + nod;
  const headTilt = id.headTilt;

  // Hat follow-through: lags behind head tilt/pitch and wobbles
  const headTiltAt = (f: number) => idle(f, fps, seed, energy).headTilt;
  const headPitchAt = (f: number) =>
    idle(f, fps, seed, energy).headPitch + gazeChain(f, fps, p.gaze ?? [{ frame: 0, yaw: 0 }]).headPitch +
    (p.stress ? talkNods(f, fps, p.stress) : 0);
  const hatLagZ = (followThrough(frame, fps, headTiltAt) - headTilt) * 1.6;
  const hatLagX = (followThrough(frame, fps, headPitchAt) - headPitch) * 1.6;

  const smile = (p.smile ?? []).reduce((s, k) => (frame >= k.frame ? k.value : s), 0.3);

  return (
    <group position={position} rotation={[0, facing + gz.bodyYaw, 0]}>
      {/* hips: weight shift + lean */}
      <group position={[id.hipX, 0.42 + id.hipY, 0]} rotation={[0, 0, id.lean]}>
        {/* legs (counter the lean so feet stay planted) */}
        {[-0.05, 0.05].map((x) => (
          <mesh key={x} position={[x - id.hipX * 0.6, -0.21, 0]} rotation={[0, 0, -id.lean]}>
            <cylinderGeometry args={[0.012, 0.012, 0.42, 8]} />
            <meshToonMaterial color={INK} />
          </mesh>
        ))}
        {/* torso with breathing */}
        <group position={[0, 0.16 + shrugLift * 0.3, 0]} scale={[br.chestScaleX, br.chestScaleY, br.chestScaleX]}>
          <mesh>
            <capsuleGeometry args={[0.1, 0.12, 6, 16]} />
            <meshToonMaterial color={torsoColor} />
          </mesh>
          {/* arms */}
          {(
            [
              [0.1, rShoulderZ, rShoulderX],
              [-0.1, lShoulderZ, lShoulderX],
            ] as const
          ).map(([x, z, rx], i) => (
            <group key={i} position={[x, 0.1 + br.shoulderY + shrugLift, 0]} rotation={[rx, 0, z]}>
              <mesh position={[0, -0.16, 0]}>
                <cylinderGeometry args={[0.011, 0.011, 0.32, 8]} />
                <meshToonMaterial color={INK} />
              </mesh>
              <mesh position={[0, -0.33, 0]}>
                <sphereGeometry args={[0.025, 12, 12]} />
                <meshToonMaterial color="#f4efe6" />
              </mesh>
            </group>
          ))}
          {/* head */}
          <group position={[0, 0.36, 0]} rotation={[headPitch, headYaw, headTilt]}>
            <mesh>
              <sphereGeometry args={[0.2, 32, 32]} />
              <meshToonMaterial color="#ffffff" />
            </mesh>
            {/* eyes: scale Y for blink, offset X for gaze */}
            {[-0.33, 0.33].map((base) => {
              // place eyes ON the sphere surface so they never slide off when looking sideways
              const th = base + gz.eyesYaw * 0.55;
              const ph = 0.15 - gz.eyesPitch * 0.4;
              const r = 0.19;
              return (
              <mesh key={base} position={[r * Math.sin(th) * Math.cos(ph), r * Math.sin(ph), r * Math.cos(th) * Math.cos(ph)]} scale={[1, Math.max(0.08, 1 - lid), 1]}>
                <sphereGeometry args={[0.022, 12, 12]} />
                <meshBasicMaterial color={INK} />
              </mesh>
              );
            })}
            {/* mouth: opens with speech, curves with smile */}
            <mesh position={[0, -0.07, 0.19]} scale={[1 + smile * 0.3, 0.25 + mouthOpen * 1.6, 1]}>
              <sphereGeometry args={[0.028, 12, 12]} />
              <meshBasicMaterial color={INK} />
            </mesh>
            {/* hat with follow-through */}
            <group position={[0, 0.18, 0]} rotation={[hatLagX, 0, hatLagZ]}>
              <mesh position={[0, 0.01, 0]}>
                <cylinderGeometry args={[0.2, 0.2, 0.015, 32]} />
                <meshToonMaterial color={hatColor} />
              </mesh>
              <mesh position={[0, 0.1, 0]}>
                <cylinderGeometry args={[0.12, 0.13, 0.19, 32]} />
                <meshToonMaterial color={hatColor} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
};
