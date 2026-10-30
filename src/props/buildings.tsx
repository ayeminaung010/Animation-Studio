// Big set pieces: the bank (with its giant listening ear), houses, the chapel.
import React from "react";
import * as THREE from "three";
import { Ink, T } from "../components/toon";
import { signTexture } from "../components/textures";
import type { PropProps } from "./types";

const Columns: React.FC<{ n: number; width: number; height: number; z: number; r?: number; color?: string }> = ({
  n, width, height, z, r = 0.12, color = "#FFFFFF",
}) => (
  <>
    {Array.from({ length: n }, (_, i) => (
      <T key={i} color={color} position={[-width / 2 + (i / (n - 1)) * width, height / 2, z]} outline={0.02}>
        <cylinderGeometry args={[r, r * 1.1, height, 16]} />
      </T>
    ))}
  </>
);

/** Gable roof: a triangular prism along x, apex up, base sitting at height y. */
const Gable: React.FC<{ w: number; h: number; depth: number; y: number; color: string; z?: number }> = ({ w, h, depth, y, color, z = 0 }) => (
  <T color={color} position={[0, y + h / 3, z]} rotation={[0, 0, Math.PI / 2]} scale={[h / 1.5, w, depth / 1.732]} outline={0.025}>
    <cylinderGeometry args={[1, 1, 1, 3, 1, false, Math.PI / 2]} />
  </T>
);

export const BankBuilding: React.FC<PropProps> = () => {
  const sign = signTexture("TOWN BANK", "#1F5A45", "#F7E9B8", 1024, 200);
  return (
    <group>
      <T color="#E9DCC0" position={[0, 0.15, 0.9]} outline={0.02}>
        <boxGeometry args={[4.6, 0.3, 1.0]} />
      </T>
      <T color="#F1E5CC" position={[0, 1.9, 0]} outline={0.03}>
        <boxGeometry args={[4.2, 3.8, 1.6]} />
      </T>
      <Columns n={5} width={3.6} height={3.2} z={0.95} />
      <T color="#F7EEDA" position={[0, 3.55, 0.95]} outline={0.025}>
        <boxGeometry args={[4.2, 0.35, 0.5]} />
      </T>
      <T color="#FFFFFF" map={sign} position={[0, 3.55, 1.205]} outline={false}>
        <planeGeometry args={[3.2, 0.3]} />
      </T>
      <Gable w={4.4} h={0.9} depth={0.6} y={3.72} z={0.9} color="#E4D4B4" />
      <T color="#3A2A22" position={[0, 0.95, 0.81]} outline={0.02}>
        <boxGeometry args={[0.9, 1.6, 0.05]} />
      </T>
    </group>
  );
};

/** A giant ear on a pole: the bank is listening for apologies. Turns slowly. */
export const GiantEarDish: React.FC<PropProps> = ({ f }) => (
  <group rotation={[0, Math.sin(f * 0.05) * 0.3, 0]}>
    <T color="#9AA3AE" position={[0, 0.55, 0]} outline={0.02}>
      <cylinderGeometry args={[0.07, 0.1, 1.1, 10]} />
    </T>
    <group position={[0, 1.75, 0]} rotation={[0, 0, -0.12]}>
      {/* outer ear */}
      <T color="#F5BFA6" scale={[0.62, 0.95, 0.22]} outline={0.03}>
        <sphereGeometry args={[1, 32, 24]} />
      </T>
      {/* the curling rim (helix) */}
      <T color="#E39A82" position={[0.02, 0.08, 0.2]} rotation={[0, 0, 0.9]} scale={[0.85, 1.15, 1]} outline={0.02}>
        <torusGeometry args={[0.42, 0.075, 10, 32, Math.PI * 1.45]} />
      </T>
      {/* inner bowl and the little flap by the canal */}
      <T color="#C97C66" position={[-0.05, -0.08, 0.17]} scale={[0.28, 0.34, 0.1]} outline={0.015}>
        <sphereGeometry args={[1, 20, 14]} />
      </T>
      <T color="#F5BFA6" position={[-0.3, -0.1, 0.2]} outline={0.015}>
        <sphereGeometry args={[0.1, 14, 10]} />
      </T>
      {/* earlobe */}
      <T color="#F5BFA6" position={[0.05, -0.78, 0.06]} scale={[1, 0.8, 0.6]} outline={0.02}>
        <sphereGeometry args={[0.22, 18, 12]} />
      </T>
    </group>
  </group>
);

export const Mansion: React.FC<PropProps> = () => (
  <group>
    <T color="#FFF6E5" position={[0, 1.3, 0]} outline={0.035}>
      <boxGeometry args={[5, 2.6, 2.4]} />
    </T>
    <Gable w={5.6} h={1.2} depth={2.8} y={2.6} color="#B9443A" />
    <Columns n={4} width={2.4} height={2.3} z={1.35} r={0.13} />
    <T color="#F2C14E" emissive="#7A5200" emissiveIntensity={0.3} position={[0, 2.45, 1.35]} outline={0.02}>
      <boxGeometry args={[2.9, 0.22, 0.3]} />
    </T>
    {[-1.9, -1.2, 1.2, 1.9].flatMap((x) =>
      [0.8, 1.9].map((y) => (
        <T key={`${x}${y}`} color="#7FB4E6" emissive="#FFD58A" emissiveIntensity={0.25} position={[x, y, 1.21]} outline={0.015}>
          <boxGeometry args={[0.45, 0.6, 0.03]} />
        </T>
      )),
    )}
    <T color="#6B3E1F" position={[0, 0.6, 1.22]} outline={0.02}>
      <boxGeometry args={[0.7, 1.2, 0.04]} />
    </T>
    <T color="#F2C14E" emissive="#7A5200" emissiveIntensity={0.3} position={[0, 3.6, 0.8]} outline={0.02}>
      <torusGeometry args={[0.32, 0.06, 8, 20]} />
    </T>
  </group>
);

export const TinyHouse: React.FC<PropProps & { color?: string }> = ({ color = "#9BC4A0" }) => (
  <group>
    <T color={color} position={[0, 0.45, 0]} outline={0.025}>
      <boxGeometry args={[1.1, 0.9, 1]} />
    </T>
    <Gable w={1.3} h={0.6} depth={1.2} y={0.9} color="#7A5A48" />
    <T color="#4A3A30" position={[0, 0.28, 0.51]} outline={0.012}>
      <boxGeometry args={[0.26, 0.5, 0.03]} />
    </T>
    <T color="#7FB4E6" position={[0.32, 0.55, 0.51]} outline={0.012}>
      <boxGeometry args={[0.22, 0.22, 0.03]} />
    </T>
  </group>
);

export const Chapel: React.FC<PropProps> = () => (
  <group>
    <T color="#FBF8F2" position={[0, 1.3, 0]} outline={0.03}>
      <boxGeometry args={[3, 2.6, 2.4]} />
    </T>
    <Gable w={3.4} h={1.3} depth={2.8} y={2.6} color="#8E9AAE" />
    <T color="#FBF8F2" position={[0, 4.4, 0.3]} outline={0.025}>
      <boxGeometry args={[0.8, 1.2, 0.8]} />
    </T>
    <T color="#8E9AAE" position={[0, 5.4, 0.3]} outline={0.025}>
      <coneGeometry args={[0.65, 0.9, 4]} />
    </T>
    <T color="#F2C14E" position={[0, 4.35, 0.71]} outline={0.015}>
      <sphereGeometry args={[0.18, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
    </T>
    <T color="#8FC4F0" emissive="#FFF2C8" emissiveIntensity={0.3} position={[0, 2.1, 1.21]} outline={0.015}>
      <circleGeometry args={[0.35, 24]} />
    </T>
    <T color="#7A5236" position={[0, 0.7, 1.21]} outline={0.02}>
      <boxGeometry args={[0.9, 1.4, 0.04]} />
    </T>
  </group>
);

export const FlowerArch: React.FC<PropProps> = () => (
  <group>
    <T color="#F4F0E6" position={[0, 0, 0]} outline={0.015}>
      <torusGeometry args={[1.0, 0.05, 8, 32, Math.PI]} />
    </T>
    {Array.from({ length: 15 }, (_, i) => {
      const a = (i / 14) * Math.PI;
      return (
        <T key={i} color={i % 3 === 0 ? "#FFFFFF" : i % 3 === 1 ? "#F7A6C3" : "#FFD3E2"} position={[Math.cos(a) * 1.0, Math.sin(a) * 1.0, 0.04]} outline={0.01}>
          <sphereGeometry args={[0.1, 12, 10]} />
        </T>
      );
    })}
  </group>
);

/** Ground-level road/sidewalk strip (used by street sets). */
export const Road: React.FC<{ width?: number }> = ({ width = 40 }) => (
  <group>
    <T color="#5E5A63" position={[0, 0.002, 1.6]} rotation={[-Math.PI / 2, 0, 0]} outline={false}>
      <planeGeometry args={[width, 2.2]} />
    </T>
    {Array.from({ length: 16 }, (_, i) => (
      <Ink key={i} color="#F2E6B6" position={[-width / 2 + i * (width / 16) + 0.6, 0.004, 1.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.8, 0.08]} />
      </Ink>
    ))}
  </group>
);

export const doubleSide = THREE.DoubleSide;
