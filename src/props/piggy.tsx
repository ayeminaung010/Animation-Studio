// The piggy bank: Mom's secret. Full → half → low on a kitchen scale, then cracked open.
import React from "react";
import { Easing, interpolate } from "remotion";
import * as THREE from "three";
import { Ink, T } from "../components/toon";
import { canvasTexture, FONT } from "../components/textures";
import { crackFrame, sundayIndex, type PropProps } from "./types";

const PINK = "#F4A3B5";
const PINK_DARK = "#E07D96";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Snout, eyes, ears, legs, tail. `half` limits parts to one side when broken open. */
const PiggyParts: React.FC<{ half?: 1 | -1 }> = ({ half }) => {
  const keep = (x: number) => half === undefined || Math.sign(x || half) === half;
  return (
    <group>
      {keep(0.0001) || half === undefined ? (
        <group>
          <T color={PINK_DARK} position={[0, 0.22, 0.25]} rotation={[Math.PI / 2, 0, 0]} outline={0.01}>
            <cylinderGeometry args={[0.075, 0.08, 0.07, 18]} />
          </T>
          {[0.025, -0.025].map((x) => (
            <Ink key={x} position={[x, 0.22, 0.287]}>
              <circleGeometry args={[0.012, 10]} />
            </Ink>
          ))}
        </group>
      ) : null}
      {[0.09, -0.09].filter(keep).map((x) => (
        <group key={x}>
          <Ink position={[x, 0.3, 0.2]} rotation={[-0.4, x > 0 ? 0.4 : -0.4, 0]}>
            <circleGeometry args={[0.022, 12]} />
          </Ink>
          <T color={PINK_DARK} position={[x * 1.1, 0.4, 0.08]} rotation={[0.3, 0, x > 0 ? -0.5 : 0.5]} outline={0.01}>
            <coneGeometry args={[0.05, 0.1, 4]} />
          </T>
        </group>
      ))}
      {[
        [0.12, 0.1], [-0.12, 0.1], [0.12, -0.1], [-0.12, -0.1],
      ].filter(([x]) => keep(x)).map(([x, z]) => (
        <T key={`${x}${z}`} color={PINK_DARK} position={[x, 0.04, z]} outline={0.01}>
          <cylinderGeometry args={[0.04, 0.04, 0.08, 10]} />
        </T>
      ))}
      {keep(-0.0001) ? (
        <T color={PINK_DARK} position={[0, 0.25, -0.24]} rotation={[0, Math.PI / 2, 0]} outline={0.008}>
          <torusGeometry args={[0.03, 0.01, 6, 14, Math.PI * 1.6]} />
        </T>
      ) : null}
    </group>
  );
};

const Body: React.FC<{ phiStart?: number; phiLength?: number }> = ({ phiStart = 0, phiLength = Math.PI * 2 }) => (
  <T color={PINK} position={[0, 0.22, 0]} scale={[1.2, 0.95, 1.0]} outline={0.016}
    side={phiLength < Math.PI * 2 ? THREE.DoubleSide : THREE.FrontSide}>
    <sphereGeometry args={[0.2, 30, 20, phiStart, phiLength]} />
  </T>
);

const Slot: React.FC = () => (
  <Ink position={[0, 0.411, 0]} rotation={[-Math.PI / 2, 0, 0]}>
    <planeGeometry args={[0.1, 0.02]} />
  </Ink>
);

export const PiggyBank: React.FC<PropProps> = () => (
  <group>
    <Body />
    <Slot />
    <PiggyParts />
  </group>
);

/** Clue shot: the piggy sits on a kitchen scale. Each Sunday the needle drops and it rises. */
export const PiggyOnScale: React.FC<PropProps> = ({ f, d }) => {
  const k = sundayIndex(f, d);
  const flipAt = [0.2, 0.45, 0.7].map((x) => Math.round(d * x));
  const last = k > 0 ? flipAt[k - 1] : 0;
  const settle = k > 0 ? interpolate(f, [last, last + 8], [0, 1], { ...clamp, easing: Easing.out(Easing.back(3)) }) : 1;
  const level = (n: number) => 1 - n * 0.3; // 1 → 0.1 as it empties
  const weight = level(Math.max(0, k - 1)) + (level(k) - level(Math.max(0, k - 1))) * settle;
  const rise = (1 - weight) * 0.12;
  const dial = canvasTexture("scale-dial", 256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#FFF7E0";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#1A1A1A";
    ctx.lineWidth = 8;
    for (let i = 0; i <= 10; i++) {
      const a = -1.2 + (2.4 * i) / 10 - Math.PI / 2;
      const r1 = i % 5 === 0 ? 70 : 88;
      ctx.beginPath();
      ctx.moveTo(w / 2 + Math.cos(a) * r1, h / 2 + Math.sin(a) * r1);
      ctx.lineTo(w / 2 + Math.cos(a) * 110, h / 2 + Math.sin(a) * 110);
      ctx.stroke();
    }
    ctx.fillStyle = "#C0392B";
    ctx.font = `bold 44px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("kg", w / 2, h * 0.78);
  });
  return (
    <group>
      {/* scale base + dial */}
      <T color="#D9DEE5" position={[0, 0.07, 0]} outline={0.014}>
        <boxGeometry args={[0.5, 0.14, 0.4]} />
      </T>
      <T color="#FFFFFF" map={dial} position={[0, 0.07, 0.202]} outline={false}>
        <circleGeometry args={[0.055, 24]} />
      </T>
      <Ink position={[0, 0.07, 0.205]} rotation={[0, 0, -1.2 + 2.4 * (1 - weight)]}>
        <planeGeometry args={[0.008, 0.1]} />
      </Ink>
      {/* spring under the platform: visibly longer as the piggy gets lighter */}
      <T color="#9AA3AE" position={[0, 0.18 + rise / 2, 0]} scale={[1, 1 + rise * 6, 1]} outline={0.008}>
        <cylinderGeometry args={[0.04, 0.04, 0.08, 10]} />
      </T>
      <T color="#D9DEE5" position={[0, 0.22 + rise, 0]} outline={0.012}>
        <cylinderGeometry args={[0.22, 0.22, 0.025, 28]} />
      </T>
      <group position={[0, 0.235 + rise, 0]} scale={0.95}>
        <Body />
        <Slot />
        <PiggyParts />
      </group>
    </group>
  );
};

/** Twist setup: crack lines spread, then the piggy splits in two. */
export const PiggyCracking: React.FC<PropProps> = ({ f, d }) => {
  const at = crackFrame(d);
  const crack = interpolate(f, [at - 10, at], [0, 1], clamp);
  const split = interpolate(f, [at, at + 12], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const jolt = interpolate(f, [at - 2, at, at + 4], [0, -0.03, 0], clamp);
  if (split <= 0) {
    return (
      <group position={[0, jolt, 0]}>
        <Body />
        <Slot />
        <PiggyParts />
        <Ink position={[0, 0.3, 0.205]} scale={[1, crack, 1]}>
          <planeGeometry args={[0.012, 0.2]} />
        </Ink>
        <Ink position={[0.02, 0.24, 0.212]} rotation={[0, 0, 0.6]} scale={[1, crack, 1]}>
          <planeGeometry args={[0.01, 0.12]} />
        </Ink>
      </group>
    );
  }
  return (
    <group>
      {/* No coins: the inside is packed with folded paper */}
      <T color="#FFFDF4" position={[0, 0.2, 0]} scale={[1.05 + 0.2 * split, 0.8, 0.85]} outline={0.012}>
        <icosahedronGeometry args={[0.17, 1]} />
      </T>
      {([1, -1] as const).map((side) => (
        <group key={side} position={[side * 0.12 * split, 0, 0]} rotation={[0, 0, -side * 0.9 * split]}>
          {/* SphereGeometry phi π/2..3π/2 is the +x half */}
          <Body phiStart={side === 1 ? Math.PI / 2 : Math.PI * 1.5} phiLength={Math.PI} />
          <PiggyParts half={side} />
        </group>
      ))}
    </group>
  );
};
