// Best-man-heist props: hero boots, a packed getaway horse, the groom's mirror, the back door and a sword.
import React from "react";
import { Easing, interpolate } from "remotion";
import { Ink, T } from "../components/toon";
import type { PropProps } from "./types";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const Boot: React.FC<{ x: number }> = ({ x }) => (
  <group position={[x, 0, 0]}>
    <T color="#6B3E1F" position={[0, 0.17, -0.03]} outline={0.02}>
      <cylinderGeometry args={[0.085, 0.095, 0.34, 16]} />
    </T>
    <T color="#7C4A26" position={[0, 0.06, 0.07]} scale={[1, 0.8, 1.5]} outline={0.02}>
      <sphereGeometry args={[0.11, 16, 12]} />
    </T>
    <T color="#3A2314" position={[0, 0.012, 0.08]} outline={0.01}>
      <boxGeometry args={[0.2, 0.024, 0.34]} />
    </T>
    <T color="#F2C14E" position={[0, 0.3, 0.06]} outline={0.01}>
      <boxGeometry args={[0.07, 0.05, 0.02]} />
    </T>
  </group>
);

/** A shiny, brand-new pair of boots (brown with gold buckles) that twinkles once. */
export const Boots: React.FC<PropProps> = ({ f }) => {
  const twinkle = Math.max(0, Math.sin(f * 0.25)) ** 2;
  return (
    <group>
      <Boot x={-0.14} />
      <Boot x={0.14} />
      {[-0.14, 0.14].map((x) => (
        <T key={x} color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.8} position={[x + 0.07, 0.24, 0.1]} scale={twinkle} rotation={[0, 0, Math.PI / 4]} outline={false}>
          <octahedronGeometry args={[0.04, 0]} />
        </T>
      ))}
    </group>
  );
};

/** Side-on horse facing +x, bags and bedroll strapped on, a tiny flag on a stick. */
export const HorsePacked: React.FC<PropProps> = ({ f }) => (
  <group>
    <T color="#B9783F" position={[0, 0.85, 0]} rotation={[0, 0, Math.PI / 2]} outline={0.025}>
      <capsuleGeometry args={[0.3, 0.7, 8, 20]} />
    </T>
    {[[-0.4, 0.14], [-0.4, -0.14], [0.4, 0.14], [0.4, -0.14]].map(([x, z], i) => (
      <T key={i} color="#9A6232" position={[x, 0.32, z]} outline={0.018}>
        <cylinderGeometry args={[0.065, 0.055, 0.64, 10]} />
      </T>
    ))}
    <T color="#B9783F" position={[0.72, 1.28, 0]} rotation={[0, 0, -0.6]} outline={0.025}>
      <capsuleGeometry args={[0.12, 0.45, 6, 14]} />
    </T>
    <T color="#B9783F" position={[1.0, 1.52, 0]} rotation={[0, 0, -1.2]} outline={0.02}>
      <capsuleGeometry args={[0.1, 0.2, 6, 12]} />
    </T>
    <T color="#3A2A1E" position={[0.62, 1.55, 0]} rotation={[0, 0, -0.6]} outline={0.01}>
      <boxGeometry args={[0.08, 0.4, 0.06]} />
    </T>
    {[0.08, -0.08].map((z) => (
      <T key={z} color="#9A6232" position={[0.9, 1.72, z]} outline={0.01}>
        <coneGeometry args={[0.035, 0.12, 6]} />
      </T>
    ))}
    <Ink position={[1.1, 1.58, 0.1]}>
      <circleGeometry args={[0.025, 10]} />
    </Ink>
    {/* saddle bags, bedroll, flag */}
    {[0.34, -0.34].map((z) => (
      <T key={z} color="#C0392B" position={[0, 0.85, z]} outline={0.02}>
        <boxGeometry args={[0.5, 0.5, 0.14]} />
      </T>
    ))}
    <T color="#E7D8B6" position={[-0.05, 1.28, 0]} rotation={[0, 0, Math.PI / 2]} outline={0.02}>
      <cylinderGeometry args={[0.13, 0.13, 0.7, 14]} />
    </T>
    <T color="#6B4A30" position={[-0.3, 1.78, 0]} outline={0.01}>
      <cylinderGeometry args={[0.012, 0.012, 0.8, 6]} />
    </T>
    <group position={[-0.3, 2.0, 0]} rotation={[0, Math.sin(f * 0.3) * 0.25, 0]}>
      <T color="#F2C14E" position={[0.14, 0, 0]} rotation={[0, 0, -Math.PI / 2]} outline={0.01}>
        <coneGeometry args={[0.1, 0.28, 3]} />
      </T>
    </group>
  </group>
);

/** Tall gilt oval mirror, hung on a wall. */
export const BigMirror: React.FC<PropProps> = () => (
  <group>
    <T color="#D4A93C" scale={[0.75, 1.05, 0.06]} outline={0.02}>
      <sphereGeometry args={[1, 28, 20]} />
    </T>
    <T color="#BFE6F5" emissive="#8FD0EE" emissiveIntensity={0.4} position={[0, 0, 0.05]} scale={[0.66, 0.96, 0.03]} outline={0.01}>
      <sphereGeometry args={[1, 28, 20]} />
    </T>
    <T color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.6} position={[-0.2, 0.2, 0.09]} rotation={[0, 0, 0.5]} outline={false}>
      <planeGeometry args={[0.07, 0.6]} />
    </T>
  </group>
);

/** Back door in a plain frame. Closed until the shot's `startAt`, then it is kicked open hard. */
export const BackDoor: React.FC<PropProps> = ({ f }) => {
  const open = interpolate(f, [0, 3, 6, 10], [0, -1.9, -1.55, -1.7], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <group>
      <T color="#FFE9A8" emissive="#FFD27A" emissiveIntensity={1.1} position={[0, 1.1, -0.04]} outline={false}>
        <planeGeometry args={[1.0, 2.2]} />
      </T>
      <T color="#4A3220" position={[0, 2.26, 0]} outline={0.015}>
        <boxGeometry args={[1.3, 0.14, 0.14]} />
      </T>
      {[0.58, -0.58].map((x) => (
        <T key={x} color="#4A3220" position={[x, 1.13, 0]} outline={0.015}>
          <boxGeometry args={[0.14, 2.26, 0.14]} />
        </T>
      ))}
      <group position={[-0.5, 0, 0]} rotation={[0, open, 0]}>
        <T color="#7A5236" position={[0.5, 1.1, 0]} outline={0.015}>
          <boxGeometry args={[1.0, 2.2, 0.06]} />
        </T>
        <T color="#F2C14E" position={[0.85, 1.05, 0.06]} outline={0.01}>
          <sphereGeometry args={[0.05, 10, 8]} />
        </T>
      </group>
    </group>
  );
};

/** Held in a hand: the grip is at the origin and the blade points up. */
export const Sword: React.FC<PropProps> = () => (
  <group>
    <T color="#5A3D28" position={[0, 0.02, 0]} outline={0.01}>
      <cylinderGeometry args={[0.022, 0.022, 0.16, 8]} />
    </T>
    <T color="#D4A93C" position={[0, 0.11, 0]} outline={0.01}>
      <boxGeometry args={[0.2, 0.03, 0.04]} />
    </T>
    <T color="#D8DEE6" position={[0, 0.55, 0]} outline={0.012}>
      <boxGeometry args={[0.06, 0.88, 0.02]} />
    </T>
    <T color="#D8DEE6" position={[0, 1.02, 0]} outline={0.012}>
      <coneGeometry args={[0.03, 0.12, 4]} />
    </T>
  </group>
);
