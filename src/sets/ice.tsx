// Ice King environments: snowy home dock, ship deck and hold, the hot island port and its bar.
import React from "react";
import { random } from "remotion";
import { Ink, T } from "../components/toon";
import { woodFloorTexture } from "../components/textures";
import type { SetProps } from "./index";

const Ground: React.FC<{ color: string; size?: number; y?: number; z?: number; map?: ReturnType<typeof woodFloorTexture> }> = ({
  color, size = 80, y = 0, z = 0, map,
}) => (
  <T color={color} map={map} position={[0, y, z]} rotation={[-Math.PI / 2, 0, 0]} outline={false}>
    <planeGeometry args={[size, size]} />
  </T>
);

const Barrel: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    <T color="#8A5A36" position={[0, 0.35, 0]} outline={0.018}>
      <cylinderGeometry args={[0.26, 0.26, 0.7, 14]} />
    </T>
    {[0.12, 0.58].map((y) => (
      <Ink key={y} color="#3A2A1A" position={[0, y, 0]}>
        <cylinderGeometry args={[0.265, 0.265, 0.04, 14]} />
      </Ink>
    ))}
  </group>
);

const PalmTree: React.FC<{ position: [number, number, number]; s?: number; lean?: number }> = ({ position, s = 1, lean = 0.15 }) => (
  <group position={position} scale={s} rotation={[0, 0, lean]}>
    {[0, 1, 2, 3].map((i) => (
      <T key={i} color="#9A7048" position={[i * 0.06, 0.45 + i * 0.85, 0]} rotation={[0, 0, -0.05 * i]} outline={0.015}>
        <cylinderGeometry args={[0.1 - i * 0.012, 0.13 - i * 0.012, 0.9, 8]} />
      </T>
    ))}
    {Array.from({ length: 7 }, (_, i) => (
      <group key={i} position={[0.2, 3.5, 0]} rotation={[0, (i / 7) * Math.PI * 2, 0]}>
        <T color={i % 2 ? "#3FA34D" : "#58B95A"} position={[0.7, -0.15, 0]} rotation={[0, 0, -0.4]} scale={[1, 0.08, 0.35]} outline={0.012}>
          <sphereGeometry args={[0.8, 12, 8]} />
        </T>
      </group>
    ))}
  </group>
);

const Hills: React.FC<{ color: string; z: number; cap?: string }> = ({ color, z, cap }) => (
  <group position={[0, 0, z]}>
    {[-14, -6, 3, 11, 19].map((x, i) => (
      <group key={x} position={[x, 0, -random(`h${i}`) * 4]}>
        <T color={color} outline={0.03}>
          <coneGeometry args={[5 + random(`hr${i}`) * 2, 5 + random(`hh${i}`) * 3, 10]} />
        </T>
        {cap ? (
          <T color={cap} position={[0, 1.6, 0]} outline={false}>
            <coneGeometry args={[2.6, 2.4, 10]} />
          </T>
        ) : null}
      </group>
    ))}
  </group>
);

/** Snowy wooden dock: planks in front, dark harbour water behind, white hills far away. */
export const ColdDock: React.FC<SetProps> = () => (
  <group>
    <Ground color="#2E4C6E" y={-0.4} />
    <T color="#9C7350" map={woodFloorTexture(10)} position={[0, -0.05, 9]} rotation={[-Math.PI / 2, 0, 0]} outline={false}>
      <planeGeometry args={[40, 22]} />
    </T>
    {[-4.5, -1.5, 1.5, 4.5].map((x) => (
      <group key={x} position={[x, 0, -1.9]}>
        <T color="#6B4A30" position={[0, 0.2, 0]} outline={0.018}>
          <cylinderGeometry args={[0.13, 0.15, 0.5, 10]} />
        </T>
        <T color="#FFFFFF" position={[0, 0.47, 0]} outline={false}>
          <sphereGeometry args={[0.14, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </T>
      </group>
    ))}
    <Barrel position={[2.8, 0, -0.8]} />
    <Barrel position={[3.4, 0, -1.2]} />
    <Hills color="#C9D6E2" z={-28} cap="#FFFFFF" />
  </group>
);

/** Open deck of the ship at sea: planks, rails, a mast, water all around. */
export const ShipDeck: React.FC<SetProps> = ({ f }) => (
  <group>
    <Ground color="#2F8FB8" y={-1.2 + Math.sin(f * 0.04) * 0.05} />
    <T color="#B07A4A" map={woodFloorTexture(12)} position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} outline={false}>
      <planeGeometry args={[14, 7]} />
    </T>
    <T color="#7A4E2E" position={[0, 0.5, -2.6]} outline={0.02}>
      <boxGeometry args={[14, 0.12, 0.14]} />
    </T>
    {[-6, -4, -2, 0, 2, 4, 6].map((x) => (
      <T key={x} color="#7A4E2E" position={[x, 0.25, -2.6]} outline={0.015}>
        <boxGeometry args={[0.1, 0.5, 0.1]} />
      </T>
    ))}
    <T color="#8A5A36" position={[2.6, 3, -1.6]} outline={0.02}>
      <cylinderGeometry args={[0.13, 0.16, 6, 10]} />
    </T>
    <Barrel position={[-3, 0, -1.8]} />
    <T color="#C8A46E" position={[3.6, 0.08, -1.0]} rotation={[-Math.PI / 2, 0, 0]} outline={0.012}>
      <torusGeometry args={[0.25, 0.07, 8, 20]} />
    </T>
  </group>
);

/** Low, dark cargo hold: plank floor and walls, heavy ceiling beams. */
export const ShipHold: React.FC<SetProps> = () => (
  <group>
    <Ground color="#5E3B22" map={woodFloorTexture(10)} />
    <T color="#4A2E1A" map={woodFloorTexture(14)} position={[0, 1.6, -1.6]} outline={false}>
      <planeGeometry args={[14, 3.2]} />
    </T>
    {[-3.5, 3.5].map((x) => (
      <T key={x} color="#43291A" position={[x, 1.6, 0]} rotation={[0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]} outline={false}>
        <planeGeometry args={[8, 3.2]} />
      </T>
    ))}
    {[-2.4, -0.8, 0.8, 2.4].map((x) => (
      <T key={x} color="#3A2414" position={[x, 2.9, 0.5]} outline={0.02}>
        <boxGeometry args={[0.25, 0.25, 6]} />
      </T>
    ))}
    <T color="#3A2414" position={[0, 3.1, 0]} rotation={[-Math.PI / 2, 0, 0]} outline={false}>
      <planeGeometry args={[14, 8]} />
    </T>
  </group>
);

/** Hot island harbour: sand, turquoise water, palms, green hills. */
export const IslandPort: React.FC<SetProps> = () => (
  <group>
    <Ground color="#3CC8C8" y={-0.15} />
    <T color="#F2DFA8" position={[0, 0, 3]} rotation={[-Math.PI / 2, 0, 0]} outline={false}>
      <planeGeometry args={[40, 14]} />
    </T>
    <PalmTree position={[-3.4, 0, -1.2]} s={1.1} lean={0.12} />
    <PalmTree position={[4.2, 0, -1.8]} s={1.25} lean={-0.15} />
    <PalmTree position={[-6.5, 0, -2.5]} s={0.9} lean={0.2} />
    <T color="#A8A08E" position={[6, 0.1, -6]} outline={0.02}>
      <boxGeometry args={[1.4, 0.3, 8]} />
    </T>
    <Hills color="#5DAA55" z={-30} />
  </group>
);

/** Open-sided tavern: plank floor, a long counter at the back, thatch overhead, sea behind. */
export const IslandBar: React.FC<SetProps> = () => (
  <group>
    <Ground color="#3CC8C8" y={-0.2} />
    <T color="#B8895A" map={woodFloorTexture(10)} position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} outline={false}>
      <planeGeometry args={[12, 7]} />
    </T>
    <T color="#7A4E2E" position={[0, 0.55, -1.5]} outline={0.02}>
      <boxGeometry args={[5, 1.1, 0.6]} />
    </T>
    <T color="#5E3B22" position={[0, 1.12, -1.5]} outline={0.015}>
      <boxGeometry args={[5.2, 0.06, 0.75]} />
    </T>
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <T key={i} color={["#3FA34D", "#C0392B", "#E8C46A"][i % 3]} position={[-2 + i * 0.8, 1.28, -1.6]} outline={0.008}>
        <cylinderGeometry args={[0.05, 0.06, 0.26, 10]} />
      </T>
    ))}
    {[-2.8, 2.8].map((x) => (
      <T key={x} color="#8A5A36" position={[x, 1.6, -1.2]} outline={0.018}>
        <cylinderGeometry args={[0.1, 0.1, 3.2, 8]} />
      </T>
    ))}
    <T color="#D9B060" position={[0, 3.3, -0.6]} rotation={[0.25, 0, 0]} outline={0.02}>
      <boxGeometry args={[7, 0.2, 2.6]} />
    </T>
    <PalmTree position={[-4.5, 0, -4]} s={1.2} lean={0.1} />
    <PalmTree position={[5, 0, -5]} s={1.3} lean={-0.12} />
  </group>
);
