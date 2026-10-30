// Old Welsh village pieces: cottages, the bakery, the manor window, the oven, the road out.
import React from "react";
import { Easing, interpolate } from "remotion";
import { Ink, T } from "../components/toon";
import type { PropProps } from "./types";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Whitewashed stone cottage with a slate roof, front door and one lit window. */
export const Cottage: React.FC<PropProps & { wall?: string }> = ({ wall = "#EFE8DA" }) => (
  <group>
    <T color={wall} position={[0, 0.9, 0]} outline={0.025}>
      <boxGeometry args={[2.4, 1.8, 1.6]} />
    </T>
    {/* gable roof: a triangular prism along x */}
    <group position={[0, 2.12, 0]} rotation={[0, Math.PI / 2, 0]} scale={[1, 0.6, 1]}>
      <T color="#4A5560" rotation={[-Math.PI / 2, 0, 0]} outline={0.025}>
        <cylinderGeometry args={[1.05, 1.05, 2.6, 3]} />
      </T>
    </group>
    <T color="#3E6B48" position={[-0.55, 0.55, 0.81]} outline={0.015}>
      <boxGeometry args={[0.5, 1.1, 0.04]} />
    </T>
    <T color="#FFE7A8" emissive="#FFC65C" emissiveIntensity={0.5} position={[0.5, 1.1, 0.81]} outline={0.015}>
      <boxGeometry args={[0.5, 0.45, 0.03]} />
    </T>
    <T color="#7A7F86" position={[0.85, 2.3, -0.2]} outline={0.015}>
      <boxGeometry args={[0.25, 0.7, 0.25]} />
    </T>
  </group>
);

/** Back wall + door frame with warm light behind and a door that swings open. */
export const Doorway: React.FC<PropProps> = ({ f }) => {
  const open = interpolate(f, [0, 14], [0, 1.6], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <group>
      <T color="#FFD48A" emissive="#FFB347" emissiveIntensity={1.2} position={[0, 1.15, -0.02]} outline={false}>
        <planeGeometry args={[1.0, 2.3]} />
      </T>
      <T color="#5A3D28" position={[0, 2.35, 0]} outline={0.015}>
        <boxGeometry args={[1.3, 0.14, 0.14]} />
      </T>
      {[0.58, -0.58].map((x) => (
        <T key={x} color="#5A3D28" position={[x, 1.15, 0]} outline={0.015}>
          <boxGeometry args={[0.14, 2.3, 0.14]} />
        </T>
      ))}
      <group position={[-0.5, 0, 0]} rotation={[0, open, 0]}>
        <T color="#6B4A30" position={[0.5, 1.15, 0]} outline={0.015}>
          <boxGeometry args={[1.0, 2.3, 0.06]} />
        </T>
      </group>
    </group>
  );
};

/** Bakery front: striped awning, loaves in the window, a bread-shaped sign (no text). */
export const BakeryFront: React.FC<PropProps> = () => (
  <group>
    <T color="#E8C9A0" position={[0, 1.3, 0]} outline={0.025}>
      <boxGeometry args={[3.0, 2.6, 0.5]} />
    </T>
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <T key={i} color={i % 2 ? "#FFFFFF" : "#C0392B"} position={[-1.25 + i * 0.5, 2.15, 0.55]} rotation={[0.5, 0, 0]} outline={0.012}>
        <boxGeometry args={[0.5, 0.05, 0.7]} />
      </T>
    ))}
    <T color="#FFF2C8" emissive="#FFD58A" emissiveIntensity={0.35} position={[0.55, 1.15, 0.26]} outline={0.015}>
      <boxGeometry args={[1.4, 0.9, 0.03]} />
    </T>
    {[0.1, 0.5, 0.9].map((x) => (
      <T key={x} color="#C98A3E" scale={[1.25, 0.7, 1]} position={[x, 0.85, 0.32]} outline={0.01}>
        <sphereGeometry args={[0.13, 16, 10]} />
      </T>
    ))}
    <T color="#3E6B48" position={[-0.9, 0.6, 0.26]} outline={0.015}>
      <boxGeometry args={[0.6, 1.2, 0.04]} />
    </T>
    <group position={[-0.9, 2.75, 0.3]}>
      <T color="#5A3D28" outline={0.012}>
        <boxGeometry args={[0.7, 0.4, 0.04]} />
      </T>
      <T color="#C98A3E" scale={[1.4, 0.7, 0.4]} position={[0, 0, 0.04]} outline={0.008}>
        <sphereGeometry args={[0.12, 14, 10]} />
      </T>
    </group>
  </group>
);

/** Big stone manor wall with a tall open window and red curtains; a character stands just behind it. */
export const ManorWindow: React.FC<PropProps> = ({ f }) => {
  const sway = Math.sin(f * 0.1) * 0.03;
  return (
    <group>
      {[
        { x: -1.6, w: 2.0, y: 1.8, h: 3.6 },
        { x: 1.6, w: 2.0, y: 1.8, h: 3.6 },
        { x: 0, w: 1.2, y: 0.35, h: 0.7 },
        { x: 0, w: 1.2, y: 3.15, h: 0.9 },
      ].map((b, i) => (
        <T key={i} color="#B9B1A3" position={[b.x, b.y, 0]} outline={0.02}>
          <boxGeometry args={[b.w, b.h, 0.3]} />
        </T>
      ))}
      <T color="#E2DCCF" position={[0, 0.72, 0.18]} outline={0.015}>
        <boxGeometry args={[1.4, 0.08, 0.2]} />
      </T>
      {[0.5, -0.5].map((x) => (
        <T key={x} color="#8E2A2A" position={[x + sway, 1.7, 0.17]} outline={0.015}>
          <boxGeometry args={[0.22, 1.9, 0.05]} />
        </T>
      ))}
      <T color="#2A2230" position={[0, 1.6, -0.9]} outline={false}>
        <planeGeometry args={[1.4, 2.6]} />
      </T>
    </group>
  );
};

/** Brick dome oven with a glowing mouth. */
export const BreadOven: React.FC<PropProps> = ({ f }) => (
  <group>
    <T color="#9C4A32" position={[0, 0.4, 0]} outline={0.02}>
      <boxGeometry args={[1.3, 0.8, 1.0]} />
    </T>
    <T color="#B5563A" position={[0, 0.8, 0]} scale={[1, 0.75, 0.8]} outline={0.02}>
      <sphereGeometry args={[0.62, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
    </T>
    <T color="#FF8A3D" emissive="#FF6A1C" emissiveIntensity={1.2 + 0.3 * Math.sin(f * 0.4)} position={[0, 0.98, 0.5]} outline={false}>
      <circleGeometry args={[0.2, 20, 0, Math.PI]} />
    </T>
    <Ink position={[0, 0.98, 0.495]}>
      <planeGeometry args={[0.44, 0.02]} />
    </Ink>
  </group>
);

/** A dirt road winding into green hills and far blue mountains. */
export const ValleyRoad: React.FC<PropProps> = () => (
  <group>
    <T color="#C9A979" position={[0, 0.005, -6]} rotation={[-Math.PI / 2, 0, 0.12]} outline={false}>
      <planeGeometry args={[1.4, 16]} />
    </T>
    {[
      { p: [-6, -2, -10], s: [7, 4, 4], c: "#7BB661" },
      { p: [6, -2.2, -12], s: [8, 4.5, 4], c: "#6AA557" },
      { p: [0, -3, -18], s: [12, 5, 4], c: "#5E9A50" },
    ].map((h, i) => (
      <T key={i} color={h.c} position={h.p as [number, number, number]} scale={h.s as [number, number, number]} outline={0.03}>
        <sphereGeometry args={[1, 24, 16]} />
      </T>
    ))}
    {[-8, 0, 9].map((x, i) => (
      <T key={x} color="#8FA3C6" position={[x, 0, -28]} outline={0.03}>
        <coneGeometry args={[5 + i, 6 + i * 1.5, 4]} />
      </T>
    ))}
  </group>
);
