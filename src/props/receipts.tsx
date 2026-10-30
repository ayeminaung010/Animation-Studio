// Receipts and money: the hero props of The Apology Tax.
import React, { useEffect, useMemo } from "react";
import { Easing, interpolate, random, spring } from "remotion";
import * as THREE from "three";
import { T, toonGradient } from "../components/toon";
import { receiptTexture, signTexture } from "../components/textures";
import type { PropProps } from "./types";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const useReceiptMaterial = (tex: THREE.Texture) => {
  const mat = useMemo(
    () => new THREE.MeshToonMaterial({ map: tex, gradientMap: toonGradient(), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
    [tex],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
};

const SORRY_LINES = [
  { text: "TOWN BANK", size: 64, bold: true },
  { text: "---", size: 0 },
  { text: "APOLOGY", size: 46 },
  { text: "x1", size: 40, gap: 30 },
  { text: "SORRY", size: 120, bold: true, color: "#C0392B" },
  { text: "---", size: 0 },
  { text: "$1.00", size: 120, bold: true },
];

/** Pops in with a spring, then floats and slowly turns. Pops at `delay` frames. */
export const FloatingReceipt: React.FC<PropProps & { delay?: number }> = ({ f, fps, delay = 4 }) => {
  const tex = receiptTexture("sorry-1", SORRY_LINES);
  const mat = useReceiptMaterial(tex);
  const pop = spring({ frame: f - delay, fps, config: { damping: 9, stiffness: 160 } });
  return (
    <group scale={pop} rotation={[0, Math.sin(f * 0.06) * 0.25, Math.sin(f * 0.09) * 0.06]} position={[0, Math.sin(f * 0.1) * 0.03, 0]}>
      <mesh material={mat}>
        <planeGeometry args={[0.34, 0.6]} />
      </mesh>
    </group>
  );
};

/** The twist: SORRY — FOR JERRY. Large and readable, paid by Mom. */
export const ReceiptHero: React.FC<PropProps> = ({ f }) => {
  const tex = receiptTexture(
    "hero",
    [
      { text: "TOWN BANK", size: 60, bold: true },
      { text: "APOLOGY RECEIPT", size: 34, gap: 4 },
      { text: "---", size: 0 },
      { text: "SORRY", size: 132, bold: true, color: "#C0392B", gap: 0 },
      { text: "— FOR —", size: 58, bold: true, gap: 0 },
      { text: "JERRY", size: 132, bold: true, color: "#C0392B" },
      { text: "---", size: 0 },
      { text: "AMOUNT  $1.00", size: 44 },
      { text: "PAID BY: MOM", size: 54, bold: true },
    ],
    512,
    1024,
  );
  const mat = useReceiptMaterial(tex);
  return (
    <group rotation={[-0.05, Math.sin(f * 0.03) * 0.05, 0.02]}>
      <mesh material={mat}>
        <planeGeometry args={[0.5, 1.0]} />
      </mesh>
    </group>
  );
};

const smallReceipt = () =>
  receiptTexture(
    "small",
    [
      { text: "TOWN BANK", size: 70, bold: true },
      { text: "---", size: 0 },
      { text: "SORRY", size: 120, bold: true, color: "#C0392B" },
      { text: "FOR JERRY", size: 70, bold: true },
      { text: "---", size: 0 },
      { text: "$1.00", size: 100, bold: true },
    ],
  );

/** Thousands of receipts bursting out of the broken piggy bank, then settling. */
export const ReceiptAvalanche: React.FC<PropProps> = ({ f }) => {
  const mat = useReceiptMaterial(smallReceipt());
  const N = 90;
  return (
    <group>
      {Array.from({ length: N }, (_, i) => {
        const r = (k: string) => random(`aval-${k}-${i}`);
        const delay = r("d") * 26;
        const t = Math.max(0, f - delay) / 30;
        const ang = r("a") * Math.PI * 2;
        const speed = 0.6 + r("s") * 1.4;
        const vy = 1.6 + r("v") * 2.2;
        const floor = 0.01 + r("h") * 0.12 + Math.min(0.25, i * 0.003);
        // Ballistic arc from the piggy bank's mouth; lands at its own floor height.
        const landAt = (vy + Math.sqrt(vy * vy + 19.6 * (0.25 - floor))) / 9.8;
        const tt = Math.min(t, landAt);
        const landed = t >= landAt;
        const y = landed ? floor : 0.25 + vy * tt - 4.9 * tt * tt;
        const dist = speed * tt * 0.9;
        const spin = landed ? r("rz") * 6 : t * (4 + r("w") * 8);
        return (
          <mesh key={i} material={mat} visible={f >= delay}
            position={[Math.cos(ang) * dist, y, Math.sin(ang) * dist * 0.7]}
            rotation={[landed ? -Math.PI / 2 : spin, r("ry") * 6, landed ? r("rz") * 6 : spin * 0.6]}
            scale={0.9 + r("sc") * 0.5}>
            <planeGeometry args={[0.12, 0.21]} />
          </mesh>
        );
      })}
    </group>
  );
};

/** A settled drift of receipts covering the floor. */
export const ReceiptPile: React.FC<PropProps> = () => {
  const mat = useReceiptMaterial(smallReceipt());
  return (
    <group>
      {Array.from({ length: 140 }, (_, i) => {
        const r = (k: string) => random(`pile-${k}-${i}`);
        const rad = Math.sqrt(r("r")) * 1.6;
        const a = r("a") * Math.PI * 2;
        return (
          <mesh key={i} material={mat} position={[Math.cos(a) * rad, 0.01 + r("h") * 0.04 + (1.6 - rad) * 0.05, Math.sin(a) * rad * 0.8]}
            rotation={[-Math.PI / 2 + (r("t") - 0.5) * 0.5, 0, r("z") * 6]} scale={1 + r("s") * 0.4}>
            <planeGeometry args={[0.12, 0.21]} />
          </mesh>
        );
      })}
    </group>
  );
};

/** Dollar bills fluttering up and away toward the bank. */
export const DollarBills: React.FC<PropProps> = ({ f }) => {
  const tex = signTexture("$1", "#7FBF6A", "#1E4D2B", 512, 256);
  return (
    <group>
      {[0, 1, 2].map((i) => {
        const t = Math.max(0, f - 6 - i * 5) / 30;
        return (
          <T key={i} color="#FFFFFF" map={tex} outline={0.008} side={THREE.DoubleSide}
            position={[0.15 * i + t * 0.9, 0.2 * i + t * 1.4, -t * 0.8]}
            rotation={[Math.sin(f * 0.3 + i) * 0.6, t * 2 + i, Math.sin(f * 0.25 + i) * 0.4]}
            scale={interpolate(f, [6 + i * 5, 12 + i * 5], [0, 1], { ...clamp, easing: Easing.out(Easing.back(2)) })}>
            <planeGeometry args={[0.36, 0.17]} />
          </T>
        );
      })}
    </group>
  );
};

export const GoldCoinPile: React.FC<PropProps> = ({ f }) => (
  <group>
    {Array.from({ length: 34 }, (_, i) => {
      const r = (k: string) => random(`coin-${k}-${i}`);
      const a = r("a") * Math.PI * 2;
      const rad = Math.sqrt(r("r")) * 0.6;
      const fall = interpolate(f, [i * 0.6, i * 0.6 + 8], [1.5, 0], { ...clamp, easing: Easing.bounce });
      return (
        <T key={i} color="#F2C14E" emissive="#7A5200" emissiveIntensity={0.25} outline={0.008}
          position={[Math.cos(a) * rad, 0.03 + (0.6 - rad) * 0.35 + r("h") * 0.05 + fall, Math.sin(a) * rad]}
          rotation={[(r("x") - 0.5) * 0.8, 0, (r("z") - 0.5) * 0.8]}>
          <cylinderGeometry args={[0.09, 0.09, 0.025, 18]} />
        </T>
      );
    })}
  </group>
);
