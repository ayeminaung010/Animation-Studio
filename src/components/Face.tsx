// Procedural toon face drawn onto the front of the sphere head.
// Ten expressions; `mouthOpen` (0..1) drives speech from the voice track.
import React from "react";
import type { FaceName } from "../lib/shots";
import { Ink } from "./toon";

export const HEAD_R = 0.34;

type Mouth = "flat" | "smile" | "frown" | "open" | "smirk";

interface Brow {
  y: number;
  /** Positive = inner end raised (worry); negative = inner end lowered (anger). */
  inner: number;
}

interface FaceParams {
  eyeW: number;
  eyeH: number;
  lidL: number;
  lidR: number;
  browL: Brow;
  browR: Brow;
  mouth: Mouth;
  mouthW: number;
  mouthH: number;
  mouthX: number;
  tears: boolean;
}

const base: FaceParams = {
  eyeW: 0.045, eyeH: 0.07, lidL: 0, lidR: 0,
  browL: { y: 0.14, inner: 0 }, browR: { y: 0.14, inner: 0 },
  mouth: "flat", mouthW: 0.09, mouthH: 0.03, mouthX: 0, tears: false,
};

const FACES: Record<FaceName, FaceParams> = {
  neutral: base,
  happy: { ...base, eyeH: 0.06, lidL: 0.15, lidR: 0.15, browL: { y: 0.155, inner: -0.15 }, browR: { y: 0.155, inner: -0.15 }, mouth: "smile", mouthW: 0.09 },
  sad: { ...base, eyeW: 0.042, eyeH: 0.062, browL: { y: 0.13, inner: 0.38 }, browR: { y: 0.13, inner: 0.38 }, mouth: "frown", mouthW: 0.075 },
  smug: { ...base, lidL: 0.5, lidR: 0.5, browL: { y: 0.165, inner: -0.25 }, browR: { y: 0.13, inner: 0.05 }, mouth: "smirk", mouthW: 0.07, mouthX: 0.03 },
  shocked: { ...base, eyeW: 0.06, eyeH: 0.092, browL: { y: 0.195, inner: 0.05 }, browR: { y: 0.195, inner: 0.05 }, mouth: "open", mouthW: 0.055, mouthH: 0.07 },
  scared: { ...base, eyeW: 0.055, eyeH: 0.085, browL: { y: 0.175, inner: 0.42 }, browR: { y: 0.175, inner: 0.42 }, mouth: "open", mouthW: 0.07, mouthH: 0.03 },
  angry: { ...base, eyeH: 0.058, browL: { y: 0.12, inner: -0.5 }, browR: { y: 0.12, inner: -0.5 }, mouth: "frown", mouthW: 0.085 },
  suspicious: { ...base, lidL: 0.55, lidR: 0.15, browL: { y: 0.12, inner: -0.2 }, browR: { y: 0.155, inner: 0 }, mouth: "flat", mouthW: 0.07, mouthX: 0.03 },
  crying: { ...base, eyeH: 0.055, lidL: 0.25, lidR: 0.25, browL: { y: 0.13, inner: 0.45 }, browR: { y: 0.13, inner: 0.45 }, mouth: "frown", mouthW: 0.08, tears: true },
  blank: { ...base, eyeW: 0.03, eyeH: 0.03, browL: { y: 0.14, inner: 0 }, browR: { y: 0.14, inner: 0 }, mouth: "flat", mouthW: 0.05 },
};

/** Position + orientation for a flat feature lying on the head's front surface. */
const onSurface = (x: number, y: number, lift = 0.004) => {
  const z = Math.sqrt(Math.max(0, HEAD_R * HEAD_R - x * x - y * y)) + lift;
  return {
    position: [x, y, z] as [number, number, number],
    rotation: [-Math.atan2(y, z), Math.atan2(x, z), 0] as [number, number, number],
  };
};

const ARC = Math.PI * 0.8;

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixBrow = (a: Brow, b: Brow, t: number): Brow => ({ y: mix(a.y, b.y, t), inner: mix(a.inner, b.inner, t) });
/** Numbers blend; the mouth shape and tears switch at the halfway point. */
const blendFace = (a: FaceParams, b: FaceParams, t: number): FaceParams => ({
  eyeW: mix(a.eyeW, b.eyeW, t), eyeH: mix(a.eyeH, b.eyeH, t), lidL: mix(a.lidL, b.lidL, t), lidR: mix(a.lidR, b.lidR, t),
  browL: mixBrow(a.browL, b.browL, t), browR: mixBrow(a.browR, b.browR, t),
  mouth: t < 0.5 ? a.mouth : b.mouth, mouthW: mix(a.mouthW, b.mouthW, t), mouthH: mix(a.mouthH, b.mouthH, t),
  mouthX: mix(a.mouthX, b.mouthX, t), tears: t < 0.5 ? a.tears : b.tears,
});

export const Face: React.FC<{
  face: FaceName;
  mouthOpen?: number;
  frame?: number;
  /** Motion v2: expression blending from `faceFrom` (t = 0) to `face` (t = 1). */
  faceFrom?: FaceName;
  faceT?: number;
  /** Eye offset, radians [yaw (+ = character's left), pitch (+ = down)]. */
  eyes?: [number, number];
  /** Eyelid closure 0..1 on top of the expression's lids. */
  blink?: number;
}> = ({ face, mouthOpen = 0, frame = 0, faceFrom, faceT = 1, eyes = [0, 0], blink = 0 }) => {
  const p = faceFrom && faceT < 1 ? blendFace(FACES[faceFrom], FACES[face], faceT) : FACES[face];
  // The mouth narrows through a shape switch so it morphs instead of popping.
  const morph = faceFrom && faceT < 1 && FACES[faceFrom].mouth !== FACES[face].mouth ? 0.35 + 0.65 * Math.abs(2 * faceT - 1) : 1;
  const eyeY = 0.04;
  const mouthY = -0.11;
  // Gaze slides the eyes over the sphere (onSurface keeps them on it); capped so they stay on the face.
  const gx = Math.max(-0.09, Math.min(0.09, eyes[0] * HEAD_R * 0.55));
  const gy = Math.max(-0.06, Math.min(0.05, -eyes[1] * HEAD_R * 0.4));

  const eye = (side: 1 | -1) => {
    const lid = Math.min(0.92, Math.max(side === 1 ? p.lidL : p.lidR, blink));
    const s = onSurface(side * 0.11 + gx, eyeY + gy);
    return (
      <group key={`eye${side}`} position={s.position} rotation={s.rotation}>
        <Ink scale={[p.eyeW, p.eyeH * (1 - lid), 1]} position={[0, -p.eyeH * lid * 0.5, 0]}>
          <circleGeometry args={[1, 24]} />
        </Ink>
        {p.eyeW > 0.035 && blink < 0.5 ? (
          <Ink color="#ffffff" position={[p.eyeW * 0.35, p.eyeH * 0.35 * (1 - lid), 0.001]} scale={0.012}>
            <circleGeometry args={[1, 12]} />
          </Ink>
        ) : null}
      </group>
    );
  };

  const brow = (side: 1 | -1) => {
    const b = side === 1 ? p.browL : p.browR;
    const s = onSurface(side * 0.115, b.y);
    return (
      <group key={`brow${side}`} position={s.position} rotation={s.rotation}>
        <Ink rotation={[0, 0, -side * b.inner]}>
          <planeGeometry args={[0.1, 0.022]} />
        </Ink>
      </group>
    );
  };

  const speaking = mouthOpen > 0.02;
  const ms = onSurface(p.mouthX, mouthY);
  let mouth: React.ReactNode;
  if (speaking || p.mouth === "open") {
    const h = speaking ? 0.015 + 0.065 * mouthOpen : p.mouthH;
    const w = speaking ? 0.065 : p.mouthW;
    mouth = (
      <Ink scale={[w / 2, h / 2, 1]}>
        <circleGeometry args={[1, 24]} />
      </Ink>
    );
  } else if (p.mouth === "flat") {
    mouth = (
      <Ink>
        <planeGeometry args={[p.mouthW, 0.018]} />
      </Ink>
    );
  } else {
    // Torus arc: rotated so it opens up (smile) or down (frown).
    const smile = p.mouth === "smile" || p.mouth === "smirk";
    const rot = smile ? Math.PI + (Math.PI - ARC) / 2 : (Math.PI - ARC) / 2;
    const r = p.mouthW / 2;
    mouth = (
      <group rotation={[0, 0, p.mouth === "smirk" ? 0.3 : 0]} position={[0, smile ? r * 0.55 : -r * 0.55, 0]}>
        <Ink rotation={[0, 0, rot]} scale={[1, smile ? 0.75 : 0.6, 0.2]}>
          <torusGeometry args={[r, 0.011, 6, 24, ARC]} />
        </Ink>
      </group>
    );
  }

  return (
    <group>
      {eye(1)}
      {eye(-1)}
      {brow(1)}
      {brow(-1)}
      <group position={ms.position} rotation={ms.rotation} scale={[morph, 1, 1]}>
        {mouth}
      </group>
      {p.tears
        ? ([1, -1] as const).map((side) => {
            // Tear slides down the cheek and restarts every 40 frames, driven by the frame.
            const t = (frame % 40) / 40;
            const s = onSurface(side * 0.12, eyeY - 0.07 - t * 0.09, 0.008);
            return (
              <group key={`tear${side}`} position={s.position} rotation={s.rotation}>
                <Ink color="#7EC8F2" scale={[0.018, 0.03, 1]}>
                  <circleGeometry args={[1, 16]} />
                </Ink>
              </group>
            );
          })
        : null}
    </group>
  );
};
