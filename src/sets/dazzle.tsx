// "How a Paintbrush Beat a Submarine" environments: a warm stone harbour, the striped warship's
// foredeck at sea, the open ocean (with an underwater volume for the cutaway), and the U-boat control room.
import React from "react";
import * as THREE from "three";
import { random } from "remotion";
import { dazzleTexture } from "../props/dazzle";
import { Ink, T } from "../components/toon";
import type { SetProps } from "./index";

const Plane: React.FC<{ color: string; y: number; size?: number; x?: number; z?: number }> = ({ color, y, size = 120, x = 0, z = 0 }) => (
  <T color={color} position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]} outline={false}>
    <planeGeometry args={[size, size]} />
  </T>
);

/** Drifting foam dashes on water at height `y` (deterministic). */
const Foam: React.FC<{ f: number; y: number; n?: number; spread?: number; color?: string }> = ({ f, y, n = 40, spread = 30, color = "#D7E6EA" }) => (
  <group>
    {Array.from({ length: n }, (_, i) => {
      const x = (random(`fx-${i}`) - 0.5) * spread + Math.sin(f * 0.03 + i) * 0.15;
      const z = (random(`fz-${i}`) - 0.5) * spread + Math.cos(f * 0.025 + i * 1.3) * 0.12;
      const w = 0.4 + random(`fw-${i}`) * 0.8;
      return (
        <T key={i} color={color} position={[x, y + 0.012, z]} rotation={[-Math.PI / 2, 0, 0]} scale={[w, 0.05, 1]} outline={false}>
          <circleGeometry args={[0.5, 10]} />
        </T>
      );
    })}
  </group>
);

const Bollard: React.FC<{ at: [number, number, number] }> = ({ at }) => (
  <group position={at}>
    <T color="#2E3036" position={[0, 0.2, 0]} outline={0.014}>
      <cylinderGeometry args={[0.12, 0.15, 0.4, 12]} />
    </T>
    <T color="#2E3036" position={[0, 0.42, 0]} outline={0.012}>
      <cylinderGeometry args={[0.17, 0.17, 0.06, 12]} />
    </T>
  </group>
);

const Crate: React.FC<{ at: [number, number, number]; s?: number; r?: number }> = ({ at, s = 0.5, r = 0 }) => (
  <T color="#A57C4E" position={[at[0], at[1] + s / 2, at[2]]} rotation={[0, r, 0]} outline={0.014}>
    <boxGeometry args={[s, s, s]} />
  </T>
);

/** Stone quay along +x with the water (and the ship's berth) on -x, warehouses and a crane behind. */
export const DazzleHarbour: React.FC<SetProps> = ({ f }) => (
  <group>
    <Plane color="#3F6E7E" y={-0.5} />
    <Foam f={f} y={-0.5} n={18} spread={20} />
    <T color="#C2AE8E" position={[6, -0.3, 0]} outline={0.02}>
      <boxGeometry args={[14, 0.6, 60]} />
    </T>
    <Ink color="#6E604C" position={[-1.0, 0.004, 0]}>
      <boxGeometry args={[0.06, 0.01, 60]} />
    </Ink>
    {[-6, -2, 2, 6, 10].map((z) => <Bollard key={z} at={[-0.65, 0, z]} />)}
    <Crate at={[2.2, 0, -1.4]} r={0.3} />
    <Crate at={[2.7, 0, -1.9]} s={0.42} r={-0.2} />
    <Crate at={[2.4, 0.5, -1.6]} s={0.36} r={0.6} />
    {/* rope coil */}
    <T color="#B89A62" position={[1.6, 0.06, 2.6]} rotation={[Math.PI / 2, 0, 0]} outline={0.01}>
      <torusGeometry args={[0.22, 0.06, 8, 18]} />
    </T>
    {/* warehouses */}
    {[-14, -6, 4, 12].map((z, i) => (
      <group key={z} position={[9 + (i % 2) * 1.5, 0, z]}>
        <T color={["#C96F4A", "#D9B27A", "#9C7B5C", "#C96F4A"][i]} position={[0, 2.2, 0]} outline={0.025}>
          <boxGeometry args={[4, 4.4, 6]} />
        </T>
        <T color="#5A4A3E" position={[0, 4.7, 0]} rotation={[0, 0, Math.PI / 4]} scale={[1, 1, 1]} outline={0.02}>
          <boxGeometry args={[2.9, 2.9, 6.2]} />
        </T>
      </group>
    ))}
    {/* dock crane */}
    <group position={[4.5, 0, -7]}>
      <T color="#7C3B2E" position={[0, 3, 0]} outline={0.02}>
        <boxGeometry args={[0.35, 6, 0.35]} />
      </T>
      <T color="#7C3B2E" position={[-2.2, 5.8, 0]} rotation={[0, 0, 0.12]} outline={0.018}>
        <boxGeometry args={[5, 0.25, 0.25]} />
      </T>
      <Ink position={[-4.4, 4.4, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 2.4, 4]} />
      </Ink>
    </group>
    {/* far green hills across the harbour */}
    {[-30, -12, 8, 26].map((z, i) => (
      <T key={z} color="#7FA36B" position={[-28, -0.5, z]} scale={[1, 0.45 + random(`hh${i}`) * 0.2, 1]} outline={0.03}>
        <sphereGeometry args={[12, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </T>
    ))}
  </group>
);

/** Foredeck at sea: planks, a striped bulwark on the -x side, a striped deckhouse behind, sea all round. */
export const DazzleDeck: React.FC<SetProps> = ({ f }) => {
  const tex = dazzleTexture();
  return (
    <group>
      <Plane color="#2E5566" y={-2.2} />
      <Foam f={f} y={-2.2} />
      <T color="#A88B64" position={[0.5, -0.06, -0.5]} outline={0.02}>
        <boxGeometry args={[4.4, 0.12, 9]} />
      </T>
      {Array.from({ length: 10 }, (_, i) => (
        <Ink key={i} color="#6E5A40" position={[-1.6 + i * 0.44, 0.002, -0.5]}>
          <boxGeometry args={[0.012, 0.004, 9]} />
        </Ink>
      ))}
      {/* striped bulwark (the "rail" the painter touches up) */}
      <T color="#FFFFFF" map={tex} position={[-1.68, 0.4, -0.5]} outline={0.016}>
        <boxGeometry args={[0.08, 0.8, 9]} />
      </T>
      {/* open rail on +x */}
      {[-3.6, -1.8, 0, 1.8, 3.4].map((z) => (
        <T key={z} color="#3B434B" position={[2.65, 0.4, z - 0.5]} outline={0.01}>
          <cylinderGeometry args={[0.025, 0.03, 0.8, 8]} />
        </T>
      ))}
      <Ink color="#3B434B" position={[2.65, 0.78, -0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.014, 0.014, 9, 6]} />
      </Ink>
      {/* deckhouse with dazzle stripes, a funnel above it */}
      <T color="#FFFFFF" map={tex} position={[0.5, 1.2, -4.3]} outline={0.02}>
        <boxGeometry args={[4.4, 2.4, 0.8]} />
      </T>
      <T color="#1C1E26" position={[1.4, 3.4, -4.5]} outline={0.018}>
        <cylinderGeometry args={[0.35, 0.4, 2.2, 14]} />
      </T>
      {/* lifebuoy on the bulwark, alarm bell post */}
      <group position={[-1.6, 0.48, 0.9]} rotation={[0, Math.PI / 2, 0]} scale={0.8}>
        <T color="#F2F0EA" outline={0.012}>
          <torusGeometry args={[0.28, 0.08, 10, 24]} />
        </T>
      </group>
      <group position={[1.9, 0, -2.6]}>
        <T color="#3B434B" position={[0, 0.7, 0]} outline={0.01}>
          <cylinderGeometry args={[0.03, 0.04, 1.4, 8]} />
        </T>
        <T color="#C9A23A" position={[0, 1.42, 0]} rotation={[0, 0, Math.sin(f * 0.5) * 0.04]} outline={0.012}>
          <cylinderGeometry args={[0.07, 0.14, 0.18, 14, 1, true]} />
        </T>
      </group>
    </group>
  );
};

/** Open ocean: sea surface at y 0 with foam, and a dark-blue volume below for underwater moves. */
export const DazzleSea: React.FC<SetProps> = ({ f }) => (
  <group>
    <Plane color="#2E5566" y={0} size={200} />
    <Foam f={f} y={0} n={70} spread={40} />
    <mesh position={[0, -15.02, 0]}>
      <boxGeometry args={[200, 30, 200]} />
      <meshBasicMaterial color="#173444" side={THREE.BackSide} />
    </mesh>
  </group>
);

/** Cramped control room: a curved hull wall, pipes, valve wheels and one red lamp. */
export const UboatControl: React.FC<SetProps> = ({ f }) => (
  <group>
    <T color="#3A433D" position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} outline={false}>
      <planeGeometry args={[12, 12]} />
    </T>
    <T color="#55625A" position={[0, 1.4, 0]} rotation={[0, 0, Math.PI / 2]} side={THREE.BackSide} outline={false}>
      <cylinderGeometry args={[2.6, 2.6, 10, 32, 1, true]} />
    </T>
    {[-0.6, -0.2, 0.25].map((y, i) => (
      <T key={y} color={["#8A6A40", "#6E777E", "#7A3A2E"][i]} position={[0, 2.2 + y, -1.9 + i * 0.05]} rotation={[0, 0, Math.PI / 2]} outline={0.008}>
        <cylinderGeometry args={[0.05, 0.05, 10, 8]} />
      </T>
    ))}
    {[-1.6, -0.4, 2.2].map((x, i) => (
      <group key={x} position={[x, 1.2 + (i % 2) * 0.4, -2.05]}>
        <T color="#B0453A" outline={0.01}>
          <torusGeometry args={[0.22, 0.035, 6, 18]} />
        </T>
        <Ink rotation={[0, 0, i]}>
          <boxGeometry args={[0.42, 0.03, 0.03]} />
        </Ink>
      </group>
    ))}
    {/* dials */}
    {[-1.0, -0.55, 1.4].map((x) => (
      <T key={x} color="#E8E2CC" position={[x, 1.9, -2.15]} rotation={[Math.PI / 2, 0, 0]} outline={0.008}>
        <cylinderGeometry args={[0.13, 0.13, 0.03, 16]} />
      </T>
    ))}
    {/* red lamp, softly pulsing */}
    <T color="#FF4A3A" emissive="#FF3020" emissiveIntensity={1.6 + Math.sin(f * 0.21) * 0.2} position={[0.6, 2.6, -1.8]} outline={0.008}>
      <sphereGeometry args={[0.1, 12, 10]} />
    </T>
    <pointLight position={[0.6, 2.4, -1.4]} color="#FF5040" intensity={6} distance={6} />
  </group>
);
