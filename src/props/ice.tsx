// Ice King pieces: the ice, the ship, the ice house, the hold, the bar and the "You see" diagrams.
import React from "react";
import { Easing, interpolate, random, spring } from "remotion";
import * as THREE from "three";
import { Ink, T } from "../components/toon";
import { signTexture } from "../components/textures";
import { SoupBowl } from "./items";
import type { PropProps } from "./types";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ICE = "#BFEFFF";
const WOOD = "#8A5A36";
const SAWDUST = "#D9B57A";

/** One big translucent ice block (0.7 cube), resting on the ground. */
export const IceBlock: React.FC<PropProps> = () => (
  <group position={[0, 0.35, 0]}>
    <T color={ICE} emissive="#9FE4FF" emissiveIntensity={0.25} transparent opacity={0.85} outline={0.02}>
      <boxGeometry args={[0.7, 0.7, 0.7]} />
    </T>
    <Ink color="#FFFFFF" position={[-0.15, 0.18, 0.352]} rotation={[0, 0, 0.6]}>
      <planeGeometry args={[0.28, 0.04]} />
    </Ink>
  </group>
);

/** Wooden crate stamped ICE. */
export const IceCrate: React.FC<PropProps> = () => {
  const tex = signTexture("ICE", "#B07A4A", "#2A1A10", 512, 512);
  return (
    <group position={[0, 0.3, 0]}>
      <T color="#B07A4A" outline={0.018}>
        <boxGeometry args={[0.6, 0.6, 0.6]} />
      </T>
      <T color="#FFFFFF" map={tex} position={[0, 0, 0.302]} outline={false}>
        <planeGeometry args={[0.5, 0.5]} />
      </T>
    </group>
  );
};

/** Three-masted merchant ship, about 7 long and 7 tall, bow towards +x. */
export const MerchantShip: React.FC<PropProps> = ({ f }) => {
  const bob = Math.sin(f * 0.05) * 0.04;
  return (
    <group position={[0, bob, 0]} rotation={[Math.sin(f * 0.04) * 0.015, 0, 0]}>
      <T color="#5E3B22" position={[0, 0.6, 0]} outline={0.03}>
        <boxGeometry args={[6, 1.3, 1.8]} />
      </T>
      <T color="#5E3B22" position={[3, 0.7, 0]} rotation={[0, 0, 0]} scale={[1.2, 1, 0.9]} outline={0.03}>
        <cylinderGeometry args={[0.05, 0.9, 1.5, 4, 1, false, Math.PI / 4]} />
      </T>
      <T color="#E8C46A" position={[0, 1.0, 0.91]} outline={false}>
        <boxGeometry args={[6, 0.1, 0.02]} />
      </T>
      <T color="#7A4E2E" position={[-2.4, 1.6, 0]} outline={0.025}>
        <boxGeometry args={[1.3, 0.7, 1.6]} />
      </T>
      {[-1.4, 0.4, 2.0].map((x, i) => (
        <group key={x} position={[x, 1.25, 0]}>
          <T color={WOOD} position={[0, 2.6, 0]} outline={0.015}>
            <cylinderGeometry args={[0.07, 0.09, 5.2, 8]} />
          </T>
          {[1.6, 3.4].map((y, k) => (
            <T key={y} color="#F4EEDC" position={[0, y, 0.05]} rotation={[0, 0, 0]} scale={[1, 1, 1]} outline={0.015}>
              <boxGeometry args={[1.6 - k * 0.35 - i * 0.1, 1.3 - k * 0.2, 0.05]} />
            </T>
          ))}
        </group>
      ))}
    </group>
  );
};

/** Snow falling through a 10 × 6 × 8 box around the prop. */
export const Snowfall: React.FC<PropProps> = ({ f }) => (
  <group>
    {Array.from({ length: 90 }, (_, i) => {
      const x = (random(`sx${i}`) - 0.5) * 10;
      const z = (random(`sz${i}`) - 0.5) * 8;
      const speed = 0.012 + random(`sv${i}`) * 0.012;
      const y = 6 - ((random(`sy${i}`) * 6 + f * speed) % 6);
      return (
        <Ink key={i} color="#FFFFFF" position={[x + Math.sin(f * 0.05 + i) * 0.1, y, z]}>
          <sphereGeometry args={[0.025 + random(`ss${i}`) * 0.02, 6, 4]} />
        </Ink>
      );
    })}
  </group>
);

/** Cartoon thought bubble with a bowl of soup inside; pops in at its start frame. */
export const ThoughtBubble: React.FC<PropProps> = ({ f, fps }) => {
  const pop = spring({ frame: f, fps, config: { damping: 9, stiffness: 170 } });
  return (
    <group scale={pop}>
      {[[0, 0, 0, 0.32], [0.28, 0.08, -0.05, 0.24], [-0.28, 0.06, -0.05, 0.25], [0.1, 0.24, -0.08, 0.24], [-0.14, 0.22, -0.08, 0.22]].map(
        ([x, y, z, r], i) => (
          <T key={i} color="#FFFFFF" position={[x, y, z]} outline={0.016}>
            <sphereGeometry args={[r, 20, 14]} />
          </T>
        ),
      )}
      {[[-0.3, -0.38, 0.06], [-0.42, -0.55, 0.04]].map(([x, y, r], i) => (
        <T key={i} color="#FFFFFF" position={[x, y, 0]} outline={0.012}>
          <sphereGeometry args={[r, 12, 8]} />
        </T>
      ))}
      <group position={[0, -0.02, 0.3]} rotation={[0.5, 0, 0]} scale={1.6}>
        <SoupBowl f={f} d={0} fps={fps} />
      </group>
    </group>
  );
};

/** Lumpy burlap sack, tied at the top. */
export const SawdustSack: React.FC<PropProps> = () => (
  <group>
    <T color="#C8A46E" position={[0, 0.28, 0]} scale={[1, 1.15, 0.9]} outline={0.018}>
      <sphereGeometry args={[0.26, 18, 14]} />
    </T>
    <T color="#C8A46E" position={[0, 0.6, 0]} outline={0.012}>
      <coneGeometry args={[0.08, 0.16, 10]} />
    </T>
    <Ink position={[0, 0.54, 0]}>
      <torusGeometry args={[0.07, 0.012, 6, 16]} />
    </Ink>
  </group>
);

const SawdustPile: React.FC<{ position: [number, number, number]; r?: number }> = ({ position, r = 0.4 }) => (
  <T color={SAWDUST} position={position} scale={[1, 0.45, 1]} outline={0.015}>
    <sphereGeometry args={[r, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
  </T>
);

/** Thick-walled stone ice house: no windows, one small dark door, sign above, sawdust piled outside. */
export const IceHouse: React.FC<PropProps> = () => {
  const sign = signTexture("ICE HOUSE", "#F4EEDC", "#2A1A10", 1024, 256);
  return (
    <group>
      <T color="#D8CDB8" position={[0, 1.1, 0]} outline={0.025}>
        <boxGeometry args={[2.8, 2.2, 2.4]} />
      </T>
      {/* deep doorway shows how thick the walls are */}
      <T color="#B9AE98" position={[0, 0.55, 1.12]} outline={0.015}>
        <boxGeometry args={[0.8, 1.1, 0.25]} />
      </T>
      <Ink color="#2A2018" position={[0, 0.5, 1.26]}>
        <planeGeometry args={[0.55, 1.0]} />
      </Ink>
      <group position={[0, 2.45, 0]} rotation={[0, Math.PI / 2, 0]} scale={[1, 0.5, 1]}>
        <T color="#B5653E" rotation={[-Math.PI / 2, 0, 0]} outline={0.025}>
          <cylinderGeometry args={[1.5, 1.5, 3.0, 3]} />
        </T>
      </group>
      <T color="#FFFFFF" map={sign} position={[0, 1.65, 1.21]} outline={false}>
        <planeGeometry args={[1.6, 0.4]} />
      </T>
      <SawdustPile position={[-0.75, 0, 1.45]} r={0.38} />
      <SawdustPile position={[0.8, 0, 1.5]} r={0.32} />
    </group>
  );
};

/** Small claw hammer for a hand slot (head up). */
export const Hammer: React.FC<PropProps> = () => (
  <group rotation={[Math.PI / 2, 0, 0]}>
    <T color={WOOD} position={[0, 0.12, 0]} outline={0.008}>
      <cylinderGeometry args={[0.02, 0.02, 0.26, 8]} />
    </T>
    <T color="#55555E" position={[0, 0.26, 0]} outline={0.008}>
      <boxGeometry args={[0.14, 0.05, 0.05]} />
    </T>
  </group>
);

const HatchFrame: React.FC<{ open: number }> = ({ open }) => (
  <group>
    <T color="#5E3B22" position={[0, 0.04, 0]} outline={0.015}>
      <boxGeometry args={[1.0, 0.08, 1.0]} />
    </T>
    <Ink color="#1A120C" position={[0, 0.085, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.8, 0.8]} />
    </Ink>
    <group position={[0, 0.09, -0.4]} rotation={[-open, 0, 0]}>
      <T color="#7A4E2E" position={[0, 0.02, 0.4]} outline={0.012}>
        <boxGeometry args={[0.82, 0.04, 0.82]} />
      </T>
    </group>
  </group>
);

/** Cargo hatch in the deck, lid standing open. */
export const Hatch: React.FC<PropProps> = () => <HatchFrame open={1.9} />;

/** Hatch whose lid slams shut at its start frame (use startAt on the spoken word). */
export const HatchClosing: React.FC<PropProps> = ({ f }) => (
  <HatchFrame open={interpolate(f, [-6, 0], [1.9, 0], { ...clamp, easing: Easing.in(Easing.quad) })} />
);

/** The sun racing across the sky again and again: days passing. Place far behind the action. */
export const SunTimelapse: React.FC<PropProps> = ({ f }) => {
  const a = ((f % 45) / 45) * Math.PI;
  return (
    <Ink color="#FFE27A" position={[-Math.cos(a) * 9, Math.sin(a) * 6 + 1, 0]}>
      <circleGeometry args={[0.9, 28]} />
    </Ink>
  );
};

/** Ice blocks stacked like bricks, half buried in sawdust (about 2.4 wide). */
export const IceStack: React.FC<PropProps> = () => (
  <group>
    {[0, 1].map((row) =>
      [-1, 0, 1].map((col) => (
        <T key={`${row}${col}`} color={ICE} emissive="#9FE4FF" emissiveIntensity={0.35} transparent opacity={0.9}
          position={[col * 0.78 + row * 0.39 - 0.2, 0.36 + row * 0.72, -row * 0.1]} outline={0.018}>
          <boxGeometry args={[0.74, 0.7, 0.7]} />
        </T>
      )),
    )}
    <SawdustPile position={[0, 0, 0.35]} r={1.4} />
    <SawdustPile position={[-1.2, 0, 0.1]} r={0.7} />
    <SawdustPile position={[1.3, 0, 0.1]} r={0.6} />
  </group>
);

/** Water drips falling from the ceiling beam (y ≈ 2.6) onto the stack, one every 25 frames. */
export const WaterDrips: React.FC<PropProps> = ({ f }) => (
  <group>
    {[-0.6, 0.2, 0.7].map((x, i) => {
      const k = (f + i * 9) % 25;
      const y = 2.6 - 0.008 * k * k;
      return (
        <T key={x} color="#7FD0F0" position={[x, Math.max(y, 1.4), 0.3]} scale={[1, 1.4, 1]} outline={0.008}>
          <sphereGeometry args={[0.045, 10, 8]} />
        </T>
      );
    })}
  </group>
);

/** Hanging oil lantern with a warm glow. */
export const Lantern: React.FC<PropProps> = ({ f }) => (
  <group rotation={[0, 0, Math.sin(f * 0.07) * 0.12]}>
    <Ink position={[0, 0.35, 0]}>
      <cylinderGeometry args={[0.008, 0.008, 0.5, 4]} />
    </Ink>
    <T color="#FFD27A" emissive="#FFB347" emissiveIntensity={1.4} outline={0.012}>
      <cylinderGeometry args={[0.08, 0.08, 0.18, 10]} />
    </T>
    <T color="#3A2A1A" position={[0, 0.11, 0]} outline={0.01}>
      <coneGeometry args={[0.1, 0.08, 10]} />
    </T>
    <pointLight position={[0, 0, 0.2]} intensity={4} distance={5} decay={1.6} color="#FFC46B" />
  </group>
);

/** Egg frying on a hot deck plank, with popping bubbles and heat lines. */
export const FryingEgg: React.FC<PropProps> = ({ f }) => (
  <group>
    <T color="#A8774A" position={[0, -0.02, 0]} outline={false}>
      <boxGeometry args={[1.6, 0.04, 0.9]} />
    </T>
    <T color="#FFFFFF" position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.2, 1, 1]} outline={0.01}>
      <circleGeometry args={[0.16, 24]} />
    </T>
    <T color="#FFB52E" position={[0.02, 0.03, 0.01]} scale={[1, 0.6, 1]} outline={0.01}>
      <sphereGeometry args={[0.065, 16, 10]} />
    </T>
    {Array.from({ length: 6 }, (_, i) => {
      const k = (f + i * 7) % 18;
      return (
        <T key={i} color="#FFFFFF" position={[Math.cos(i * 1.1) * 0.13, 0.015, Math.sin(i * 1.1) * 0.1]}
          scale={interpolate(k, [0, 10, 18], [0.2, 1, 0], clamp)} outline={0.005}>
          <sphereGeometry args={[0.015, 6, 4]} />
        </T>
      );
    })}
    {[-0.12, 0.02, 0.16].map((x, i) => (
      <Ink key={x} color="#FFE7B0" position={[x, 0.2 + ((f * 0.01 + i * 0.1) % 0.3), 0]} rotation={[0, 0, Math.sin(f * 0.2 + i) * 0.3]}>
        <planeGeometry args={[0.012, 0.12]} />
      </Ink>
    ))}
  </group>
);

/** Sunlight shafts pouring down through the opened hatch. */
export const GodRays: React.FC<PropProps> = ({ f }) => {
  const o = interpolate(f, [0, 8], [0, 0.35], clamp);
  return (
    <group>
      {[-0.4, 0.1, 0.55].map((x, i) => (
        <T key={x} color="#FFF4C8" emissive="#FFE89A" emissiveIntensity={1} transparent opacity={o} outline={false}
          position={[x, 1.6, 0.2]} rotation={[0, 0, 0.12 - i * 0.05]}>
          <cylinderGeometry args={[0.12, 0.35, 3.2, 12, 1, true]} />
        </T>
      ))}
    </group>
  );
};

/** COLD DRINKS board on two posts (bottom at y 0). */
export const BarSign: React.FC<PropProps> = () => {
  const tex = signTexture("COLD DRINKS", "#2EC4E6", "#FFFFFF", 1024, 256);
  return (
    <group>
      <T color="#2EC4E6" map={tex} position={[0, 0.25, 0]} outline={0.015}>
        <boxGeometry args={[1.6, 0.4, 0.04]} />
      </T>
    </group>
  );
};

/** Glass of water with ice cubes clinking in. */
export const DrinkGlass: React.FC<PropProps> = ({ f }) => (
  <group>
    <T color="#E8F8FF" transparent opacity={0.45} outline={0.008} side={THREE.DoubleSide}>
      <cylinderGeometry args={[0.07, 0.06, 0.18, 16, 1, true]} />
    </T>
    <T color="#9FDCF0" transparent opacity={0.6} position={[0, -0.02, 0]} outline={false}>
      <cylinderGeometry args={[0.066, 0.058, 0.12, 16]} />
    </T>
    {[[-0.02, 0.03, 0], [0.025, 0.05, 0.01]].map(([x, y, z], i) => (
      <T key={i} color={ICE} position={[x, y + Math.sin(f * 0.2 + i) * 0.004, z]} rotation={[0.3 * i, 0.5, 0.2]} outline={0.006}>
        <boxGeometry args={[0.04, 0.04, 0.04]} />
      </T>
    ))}
  </group>
);

/** Red heat arrows sliding in from +x and bouncing back off an invisible wall at x = 0. */
const HeatArrows: React.FC<{ f: number; spread?: number }> = ({ f, spread = 0.5 }) => (
  <group>
    {[-1, 0, 1].map((k) => {
      const t = ((f + (k + 1) * 12) % 40) / 40;
      const x = 0.15 + Math.abs(t - 0.5) * 2 * 1.2;
      const back = t > 0.5;
      return (
        <group key={k} position={[x, k * spread, 0]} rotation={[0, 0, back ? 0 : Math.PI]}>
          <T color="#E8413C" position={[0.12, 0, 0]} rotation={[0, 0, Math.PI / 2]} outline={0.008}>
            <cylinderGeometry args={[0.025, 0.025, 0.24, 8]} />
          </T>
          <T color="#E8413C" position={[-0.03, 0, 0]} rotation={[0, 0, Math.PI / 2]} outline={0.008}>
            <coneGeometry args={[0.06, 0.1, 10]} />
          </T>
        </group>
      );
    })}
  </group>
);

/** Close-up of sawdust: chunky grains with air bubbles between, heat arrows bouncing off. */
export const SawdustMacro: React.FC<PropProps> = ({ f, fps }) => {
  const show = spring({ frame: f - 10, fps, config: { damping: 12 } });
  return (
    <group>
      {Array.from({ length: 40 }, (_, i) => (
        <T key={i} color={i % 3 ? SAWDUST : "#C29A5E"}
          position={[(random(`gx${i}`) - 0.5) * 1.6 - 0.4, (random(`gy${i}`) - 0.5) * 1.6, (random(`gz${i}`) - 0.5) * 0.4]}
          rotation={[random(`gr${i}`) * 3, random(`gq${i}`) * 3, 0]} outline={0.008}>
          <boxGeometry args={[0.16, 0.05, 0.08]} />
        </T>
      ))}
      {Array.from({ length: 14 }, (_, i) => (
        <T key={i} color="#E6FAFF" emissive="#FFFFFF" emissiveIntensity={0.8} transparent opacity={0.85} scale={show}
          position={[(random(`bx${i}`) - 0.5) * 1.4 - 0.4, (random(`by${i}`) - 0.5) * 1.4, 0.25]} outline={0.006}>
          <sphereGeometry args={[0.05 + random(`br${i}`) * 0.04, 12, 8]} />
        </T>
      ))}
      <group position={[0.05, 0, 0.35]} scale={0.4 * show}>
        <HeatArrows f={f} spread={0.45} />
      </group>
    </group>
  );
};

/** White-and-blue picnic cooler with heat arrows bouncing off its side. */
export const PicnicCooler: React.FC<PropProps> = ({ f }) => (
  <group>
    <T color="#3B8FD9" position={[0, 0.2, 0]} outline={0.016}>
      <boxGeometry args={[0.7, 0.4, 0.45]} />
    </T>
    <T color="#FFFFFF" position={[0, 0.44, 0]} outline={0.016}>
      <boxGeometry args={[0.74, 0.08, 0.49]} />
    </T>
    <Ink position={[0, 0.5, 0]}>
      <torusGeometry args={[0.1, 0.012, 6, 16, Math.PI]} />
    </Ink>
    <group position={[0.35, 0.25, 0.1]} scale={0.6}>
      <HeatArrows f={f} spread={0.35} />
    </group>
  </group>
);
