// Small hand-sized props.
import React from "react";
import { Easing, interpolate } from "remotion";
import * as THREE from "three";
import { Ink, T } from "../components/toon";
import { canvasTexture, FONT, signTexture } from "../components/textures";
import { sundayIndex, type PropProps } from "./types";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const ShoppingCart: React.FC<PropProps & { color?: string }> = ({ color = "#C8CDD3" }) => (
  <group>
    {/* basket: four thin walls + floor */}
    <T color={color} position={[0, 0.62, 0]} outline={0.012}>
      <boxGeometry args={[0.55, 0.02, 0.75]} />
    </T>
    {[
      { p: [0.27, 0.8, 0], s: [0.02, 0.36, 0.75] },
      { p: [-0.27, 0.8, 0], s: [0.02, 0.36, 0.75] },
      { p: [0, 0.8, 0.37], s: [0.55, 0.36, 0.02] },
      { p: [0, 0.8, -0.37], s: [0.55, 0.36, 0.02] },
    ].map((w, i) => (
      <T key={i} color={color} position={w.p as [number, number, number]} outline={0.01} transparent opacity={0.9}>
        <boxGeometry args={w.s as [number, number, number]} />
      </T>
    ))}
    <T color="#C0392B" position={[0, 1.05, -0.45]} rotation={[0, 0, Math.PI / 2]} outline={0.01}>
      <cylinderGeometry args={[0.025, 0.025, 0.6, 8]} />
    </T>
    {[0.22, -0.22].map((x) => (
      <Ink key={x} position={[x, 0.3, 0]}>
        <boxGeometry args={[0.025, 0.6, 0.025]} />
      </Ink>
    ))}
    {[
      [0.22, 0.3], [-0.22, 0.3], [0.22, -0.3], [-0.22, -0.3],
    ].map(([x, z]) => (
      <Ink key={`${x}${z}`} position={[x, 0.05, z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 0.04, 12]} />
      </Ink>
    ))}
    <T color="#F2C14E" position={[0.08, 0.72, 0.1]} outline={0.01}>
      <boxGeometry args={[0.2, 0.18, 0.14]} />
    </T>
    <T color="#7BC67E" position={[-0.1, 0.7, -0.15]} outline={0.01}>
      <sphereGeometry args={[0.08, 12, 10]} />
    </T>
  </group>
);

/** The candle fizzles out a few frames in, with a puff of smoke. */
export const BirthdayCake: React.FC<PropProps> = ({ f }) => {
  const flame = interpolate(f, [10, 18], [1, 0], { ...clamp, easing: Easing.in(Easing.quad) });
  const smoke = interpolate(f, [16, 40], [0, 1], clamp);
  return (
    <group>
      <T color="#FFFFFF" position={[0, 0.02, 0]} outline={0.01}>
        <cylinderGeometry args={[0.24, 0.24, 0.02, 24]} />
      </T>
      <T color="#F7A6C3" position={[0, 0.1, 0]} outline={0.015}>
        <cylinderGeometry args={[0.19, 0.19, 0.14, 24]} />
      </T>
      <T color="#FFF7E0" position={[0, 0.2, 0]} outline={0.015}>
        <cylinderGeometry args={[0.13, 0.13, 0.08, 24]} />
      </T>
      <T color="#7FB4E6" position={[0, 0.3, 0]} outline={0.008}>
        <cylinderGeometry args={[0.012, 0.012, 0.13, 8]} />
      </T>
      {flame > 0.01 ? (
        <T color="#FFD54F" emissive="#FF9F1C" emissiveIntensity={2} position={[0, 0.39, 0]} scale={[flame, flame * (1 + 0.15 * Math.sin(f * 1.3)), flame]} outline={false}>
          <coneGeometry args={[0.025, 0.07, 10]} />
        </T>
      ) : null}
      {smoke > 0 && smoke < 1 ? (
        <T color="#D8D8DC" position={[0.02 * Math.sin(f * 0.3), 0.42 + smoke * 0.3, 0]} scale={0.02 + smoke * 0.06} transparent opacity={1 - smoke} outline={false}>
          <sphereGeometry args={[1, 10, 8]} />
        </T>
      ) : null}
    </group>
  );
};

export const PartyHat: React.FC<PropProps> = () => {
  const stripes = canvasTexture("hat-stripes", 128, 128, (ctx, w, h) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? "#F2C14E" : "#3FA7D6";
      ctx.fillRect(0, (i / 8) * h, w, h / 8);
    }
  });
  return (
    <group>
      <T color="#FFFFFF" map={stripes} outline={0.012}>
        <coneGeometry args={[0.13, 0.32, 16]} />
      </T>
      <T color="#F06D9C" position={[0, 0.18, 0]} outline={0.008}>
        <sphereGeometry args={[0.04, 10, 8]} />
      </T>
    </group>
  );
};

export const Smartphone: React.FC<PropProps & { lit?: boolean }> = ({ f, lit = true }) => (
  <group rotation={[-0.3, 0, 0]}>
    <T color="#26262B" outline={0.01}>
      <boxGeometry args={[0.11, 0.2, 0.015]} />
    </T>
    <T color="#3FA7D6" emissive="#BFE6FF" emissiveIntensity={lit ? 0.9 + 0.1 * Math.sin(f * 0.5) : 0} position={[0, 0, 0.009]} outline={false}>
      <planeGeometry args={[0.095, 0.175]} />
    </T>
  </group>
);

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** A year of pages flipping past: one month every few frames. */
export const WallCalendarFlipping: React.FC<PropProps> = ({ f, d }) => {
  const perPage = Math.max(2, Math.floor(d / 13));
  const idx = Math.min(11, Math.floor(f / perPage));
  const flip = (f % perPage) / perPage;
  const page = (m: string) => signTexture(m, "#FFFFFF", "#C0392B", 512, 512);
  return (
    <group>
      <T color="#FFFFFF" map={page(MONTHS[Math.min(11, idx + 1)])} outline={0.015}>
        <planeGeometry args={[0.6, 0.6]} />
      </T>
      {idx < 11 ? (
        <group position={[0, 0.3, 0.01]} rotation={[-flip * Math.PI * 0.9, 0, 0]}>
          <T color="#FFFFFF" map={page(MONTHS[idx])} position={[0, -0.3, 0]} outline={0.012} side={THREE.DoubleSide}>
            <planeGeometry args={[0.6, 0.6]} />
          </T>
        </group>
      ) : null}
      <T color="#C0392B" position={[0, 0.32, 0.01]} outline={0.01}>
        <boxGeometry args={[0.64, 0.06, 0.03]} />
      </T>
    </group>
  );
};

const sundayPage = (n: number) =>
  canvasTexture(`sunday-${n}`, 512, 512, (ctx, w, h) => {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#C0392B";
    ctx.fillRect(0, 0, w, 130);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold 84px ${FONT}`;
    ctx.fillText("SUNDAY", w / 2, 68);
    ctx.fillStyle = "#1A1A1A";
    ctx.font = `bold 260px ${FONT}`;
    ctx.fillText(String(n), w / 2, 320);
  });

/** Clue shot: three Sundays tear away. Synced with the piggy scale via sundayIndex. */
export const CalendarSundayFlip: React.FC<PropProps> = ({ f, d }) => {
  const dates = [3, 10, 17, 24];
  const k = sundayIndex(f, d);
  const flipAt = [0.2, 0.45, 0.7].map((x) => Math.round(d * x));
  const tearing = k < 3 ? interpolate(f, [flipAt[k] - 6, flipAt[k]], [0, 1], clamp) : 0;
  return (
    <group>
      <T color="#FFFFFF" map={sundayPage(dates[Math.min(3, k + 1)])} outline={0.015}>
        <planeGeometry args={[0.5, 0.5]} />
      </T>
      {k < 3 ? (
        <group position={[0, 0.25, 0.01]} rotation={[-tearing * 1.6, 0, tearing * 0.3]}>
          <T color="#FFFFFF" map={sundayPage(dates[k])} position={[0, -0.25, 0]} outline={0.012} side={THREE.DoubleSide}>
            <planeGeometry args={[0.5, 0.5]} />
          </T>
        </group>
      ) : null}
    </group>
  );
};

export const SoupBowl: React.FC<PropProps> = () => (
  <group>
    <T color="#FFFFFF" position={[0, 0.06, 0]} outline={0.012} side={THREE.DoubleSide}>
      <sphereGeometry args={[0.13, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
    </T>
    <T color="#D9A441" position={[0, 0.055, 0]} rotation={[-Math.PI / 2, 0, 0]} outline={false}>
      <circleGeometry args={[0.115, 20]} />
    </T>
    <T color="#7BC67E" position={[0.03, 0.06, 0.02]} outline={0.006}>
      <sphereGeometry args={[0.02, 8, 6]} />
    </T>
  </group>
);

export const ServingTray: React.FC<PropProps> = () => (
  <group>
    <T color="#C8CDD3" outline={0.01}>
      <cylinderGeometry args={[0.22, 0.2, 0.02, 24]} />
    </T>
    <T color="#FFFFFF" position={[0.06, 0.06, 0]} outline={0.008}>
      <cylinderGeometry args={[0.04, 0.035, 0.11, 12]} />
    </T>
  </group>
);

export const FoamFinger: React.FC<PropProps> = () => (
  <group scale={1.1}>
    <T color="#3F6FD6" position={[0, 0.06, 0]} outline={0.012}>
      <boxGeometry args={[0.16, 0.14, 0.07]} />
    </T>
    <T color="#3F6FD6" position={[0.02, 0.2, 0]} outline={0.012}>
      <capsuleGeometry args={[0.03, 0.12, 4, 10]} />
    </T>
    <T color="#F2C14E" position={[0, 0.06, 0.037]} outline={false}>
      <planeGeometry args={[0.1, 0.05]} />
    </T>
  </group>
);

/** Tiny receipt held in a hand (the second clue: everyone got one). */
export const HandReceipt: React.FC<PropProps> = ({ f }) => {
  const tex = signTexture("SORRY", "#FFFDF4", "#C0392B", 256, 128);
  return (
    <group rotation={[-0.4, 0.2, Math.sin(f * 0.2) * 0.05]}>
      <T color="#FFFFFF" map={tex} outline={0.006} side={THREE.DoubleSide}>
        <planeGeometry args={[0.16, 0.09]} />
      </T>
    </group>
  );
};
