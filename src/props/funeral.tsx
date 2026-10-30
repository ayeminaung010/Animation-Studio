// Sin-eater props: biers, funeral bread, coins, candles, graves and the widow's poison.
import React from "react";
import { Easing, interpolate, random, spring } from "remotion";
import { Ink, T } from "../components/toon";
import type { PropProps } from "./types";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Height of the bier bed: a body lying on it uses pos y = BIER_BED - 0.25 (hip sits 0.47 above the mark). */
export const BIER_BED = 0.75;
export const GRAND_BED = 0.85;

/** Open, shallow coffin on trestles; low sides so the body stays visible from a level camera. */
const Bier: React.FC<{ bed: number; wood: string; trim: string; cloth: string; length: number }> = ({ bed, wood, trim, cloth, length }) => (
  <group>
    {[-length / 2 + 0.2, length / 2 - 0.2].map((x) => (
      <group key={x} position={[x, 0, 0]}>
        {[-0.22, 0.22].map((z) => (
          <T key={z} color={wood} position={[0, (bed - 0.06) / 2, z]} rotation={[z > 0 ? 0.18 : -0.18, 0, 0]} outline={0.012}>
            <boxGeometry args={[0.07, bed - 0.06, 0.07]} />
          </T>
        ))}
      </group>
    ))}
    <T color={wood} position={[0, bed - 0.03, 0]} outline={0.02}>
      <boxGeometry args={[length, 0.06, 0.72]} />
    </T>
    {[0.36, -0.36].map((z) => (
      <T key={z} color={wood} position={[0, bed + 0.05, z]} outline={0.015}>
        <boxGeometry args={[length, 0.1, 0.05]} />
      </T>
    ))}
    {[length / 2, -length / 2].map((x) => (
      <T key={x} color={wood} position={[x, bed + 0.1, 0]} outline={0.015}>
        <boxGeometry args={[0.05, 0.2, 0.72]} />
      </T>
    ))}
    <T color={trim} position={[0, bed + 0.105, 0.36]} outline={false}>
      <boxGeometry args={[length, 0.02, 0.06]} />
    </T>
    {/* shroud the body lies on */}
    <T color={cloth} position={[0, bed + 0.01, 0]} outline={false}>
      <boxGeometry args={[length - 0.1, 0.02, 0.62]} />
    </T>
  </group>
);

export const Coffin: React.FC<PropProps> = () => <Bier bed={BIER_BED} wood="#6B4A30" trim="#4A3220" cloth="#E9E4DA" length={1.9} />;
export const GrandCoffin: React.FC<PropProps> = () => (
  <group>
    <Bier bed={GRAND_BED} wood="#2B1E1A" trim="#D4A93C" cloth="#8E2A2A" length={2.0} />
    {/* velvet drape hanging to the floor */}
    <T color="#6E1F24" position={[0, GRAND_BED / 2, 0.39]} outline={0.012}>
      <boxGeometry args={[1.7, GRAND_BED - 0.1, 0.02]} />
    </T>
  </group>
);

/** A round loaf; `scale` sets the size (small / medium / huge). */
const Loaf: React.FC<{ r: number }> = ({ r }) => (
  <group>
    <T color="#C98A3E" scale={[1.25, 0.7, 1]} position={[0, r * 0.55, 0]} outline={0.012}>
      <sphereGeometry args={[r, 20, 14]} />
    </T>
    {[-0.35, 0, 0.35].map((x) => (
      <Ink key={x} color="#8A5424" position={[x * r, r * 1.22, 0]} rotation={[-Math.PI / 2, 0, 0.5]}>
        <planeGeometry args={[r * 0.12, r * 0.9]} />
      </Ink>
    ))}
  </group>
);
export const BreadSmall: React.FC<PropProps> = () => <Loaf r={0.13} />;
export const BreadMedium: React.FC<PropProps> = () => <Loaf r={0.19} />;
export const BreadBig: React.FC<PropProps> = () => <Loaf r={0.3} />;

/** Wisps rising and fading on a loop: the loaf is still warm. */
export const BreadSteam: React.FC<PropProps> = ({ f }) => (
  <group>
    {[0, 1, 2, 3].map((i) => {
      const k = ((f + i * 9) % 36) / 36;
      return (
        <T key={i} color="#FFFFFF" transparent opacity={0.75 * Math.sin(Math.PI * k)} outline={false}
          position={[Math.sin(f * 0.15 + i * 2) * 0.06 + (i - 1.5) * 0.06, k * 0.6, 0]} scale={0.05 + k * 0.08}>
          <sphereGeometry args={[1, 10, 8]} />
        </T>
      );
    })}
  </group>
);

/** Dark wisps curling from the bread up and back (towards the eater's mouth at local +y, −x). */
export const SinSmoke: React.FC<PropProps> = ({ f }) => (
  <group>
    {Array.from({ length: 7 }, (_, i) => {
      const k = ((f + i * 6) % 42) / 42;
      return (
        <T key={i} color="#3B2A4A" transparent opacity={0.85 * Math.sin(Math.PI * k)} outline={false}
          position={[-0.25 * k + Math.sin(f * 0.2 + i) * 0.04, 0.55 * k, 0.15 * k]} scale={0.04 + 0.05 * Math.sin(Math.PI * k)}>
          <sphereGeometry args={[1, 10, 8]} />
        </T>
      );
    })}
  </group>
);

export const Candle: React.FC<PropProps> = ({ f }) => {
  const flick = 1 + 0.12 * Math.sin(f * 1.1) + 0.06 * Math.sin(f * 2.7);
  return (
    <group>
      <T color="#3A2A20" position={[0, 0.02, 0]} outline={0.01}>
        <cylinderGeometry args={[0.09, 0.1, 0.04, 16]} />
      </T>
      <T color="#F4ECD4" position={[0, 0.17, 0]} outline={0.01}>
        <cylinderGeometry args={[0.04, 0.045, 0.26, 12]} />
      </T>
      <T color="#FFD54F" emissive="#FF9F1C" emissiveIntensity={2} position={[0, 0.34, 0]} scale={[1, flick, 1]} outline={false}>
        <coneGeometry args={[0.025, 0.08, 10]} />
      </T>
    </group>
  );
};

/** A cartoon chicken that springs up from nothing (start it on a word with startAt). */
export const Chicken: React.FC<PropProps> = ({ f, fps }) => {
  const s = f < 0 ? 0 : spring({ frame: f, fps, config: { damping: 9 } });
  const flap = Math.sin(f * 0.9) * 0.5;
  return (
    <group scale={s}>
      <T color="#FFFFFF" scale={[1.1, 1, 1]} position={[0, 0.2, 0]} outline={0.015}>
        <sphereGeometry args={[0.16, 16, 12]} />
      </T>
      <T color="#FFFFFF" position={[0.13, 0.38, 0]} outline={0.015}>
        <sphereGeometry args={[0.09, 14, 10]} />
      </T>
      <T color="#E0402A" position={[0.13, 0.49, 0]} outline={0.01}>
        <sphereGeometry args={[0.035, 10, 8]} />
      </T>
      <T color="#F2C14E" position={[0.23, 0.38, 0]} rotation={[0, 0, -Math.PI / 2]} outline={0.008}>
        <coneGeometry args={[0.03, 0.07, 8]} />
      </T>
      <Ink position={[0.17, 0.41, 0.075]}>
        <circleGeometry args={[0.015, 10]} />
      </Ink>
      {[1, -1].map((s2) => (
        <T key={s2} color="#F1EDE4" position={[0, 0.22, s2 * 0.15]} rotation={[s2 * flap, 0, 0]} outline={0.01}>
          <boxGeometry args={[0.18, 0.04, 0.1]} />
        </T>
      ))}
    </group>
  );
};

const Bottle: React.FC<{ glow?: number }> = ({ glow = 0.4 }) => (
  <group>
    <T color="#3FB26B" emissive="#3FB26B" emissiveIntensity={glow} transparent opacity={0.9} position={[0, 0.1, 0]} outline={0.012}>
      <cylinderGeometry args={[0.06, 0.07, 0.2, 14]} />
    </T>
    <T color="#3FB26B" emissive="#3FB26B" emissiveIntensity={glow} position={[0, 0.23, 0]} outline={0.01}>
      <cylinderGeometry args={[0.022, 0.05, 0.07, 12]} />
    </T>
    <T color="#B07A4A" position={[0, 0.29, 0]} outline={0.008}>
      <cylinderGeometry args={[0.022, 0.022, 0.05, 10]} />
    </T>
    {/* little ink X on the label: no text, just a warning mark */}
    <T color="#F4ECD4" position={[0, 0.1, 0.066]} outline={false}>
      <planeGeometry args={[0.08, 0.08]} />
    </T>
    {[0.7, -0.7].map((r) => (
      <Ink key={r} position={[0, 0.1, 0.068]} rotation={[0, 0, r]}>
        <planeGeometry args={[0.012, 0.07]} />
      </Ink>
    ))}
  </group>
);

export const PoisonBottle: React.FC<PropProps> = ({ f }) => <Bottle glow={0.5 + 0.2 * Math.sin(f * 0.15)} />;

/** Kitchen shelf with jars; the green bottle sits among them, never pointed at. */
export const PoisonBottleShelf: React.FC<PropProps> = () => (
  <group>
    <T color="#7A5236" outline={0.012}>
      <boxGeometry args={[1.2, 0.04, 0.25]} />
    </T>
    {[
      { x: -0.45, c: "#D9C7A0", h: 0.18 },
      { x: -0.25, c: "#B5651D", h: 0.24 },
      { x: 0.32, c: "#E8E2D0", h: 0.16 },
      { x: 0.48, c: "#A0522D", h: 0.2 },
    ].map((j) => (
      <T key={j.x} color={j.c} position={[j.x, 0.02 + j.h / 2, 0]} outline={0.01}>
        <cylinderGeometry args={[0.06, 0.06, j.h, 12]} />
      </T>
    ))}
    <group position={[0.08, 0.02, 0]} scale={0.8}>
      <Bottle glow={0.25} />
    </group>
  </group>
);

const Coin: React.FC<{ color: string; r?: number }> = ({ color, r = 0.05 }) => (
  <T color={color} emissive={color} emissiveIntensity={0.15} outline={0.008} rotation={[Math.PI / 2, 0, 0]}>
    <cylinderGeometry args={[r, r, 0.012, 16]} />
  </T>
);

/** Copper pennies dropping one by one into a little spread. */
const Pennies: React.FC<PropProps & { n: number }> = ({ f, n }) => (
  <group>
    {Array.from({ length: n }, (_, i) => {
      const drop = interpolate(f, [i * 3, i * 3 + 6], [0.4, 0], { ...clamp, easing: Easing.bounce });
      const a = random(`penny-a-${i}`) * Math.PI * 2;
      const rr = n > 4 ? 0.04 + random(`penny-r-${i}`) * 0.07 : (i - (n - 1) / 2) * 0.11;
      return (
        <group key={i} position={n > 4 ? [Math.cos(a) * rr, i * 0.004 + drop, Math.sin(a) * rr * 0.5] : [rr, drop, 0]}>
          <Coin color="#B8733A" />
        </group>
      );
    })}
  </group>
);
export const ThreePennies: React.FC<PropProps> = (p) => <Pennies {...p} n={3} />;
export const TenPennies: React.FC<PropProps> = (p) => <Pennies {...p} n={10} />;

/** One big gold coin that turns and glints. */
export const GoldCoin: React.FC<PropProps> = ({ f }) => (
  <group rotation={[0, Math.sin(f * 0.08) * 0.6, 0]}>
    <T color="#F2C14E" emissive="#F2C14E" emissiveIntensity={0.3 + 0.25 * Math.max(0, Math.sin(f * 0.2))} rotation={[Math.PI / 2, 0, 0]} outline={0.012}>
      <cylinderGeometry args={[0.1, 0.1, 0.02, 24]} />
    </T>
    <T color="#D4A93C" position={[0, 0, 0.012]} outline={false}>
      <ringGeometry args={[0.065, 0.08, 24]} />
    </T>
  </group>
);

/** Glass jar slowly filling with coins. */
export const CoinJar: React.FC<PropProps> = ({ f, d }) => {
  const n = Math.round(interpolate(f, [0, d * 0.8], [4, 12], clamp));
  return (
    <group>
      {Array.from({ length: n }, (_, i) => (
        <group key={i} position={[(random(`jar-x-${i}`) - 0.5) * 0.1, 0.02 + i * 0.014, (random(`jar-z-${i}`) - 0.5) * 0.1]}
          rotation={[Math.PI / 2 - 0.2, 0, random(`jar-r-${i}`)]}>
          <Coin color={i % 4 === 0 ? "#F2C14E" : "#B8733A"} r={0.045} />
        </group>
      ))}
      <T color="#CFE8F0" transparent opacity={0.35} position={[0, 0.13, 0]} outline={0.01}>
        <cylinderGeometry args={[0.1, 0.1, 0.26, 18, 1, true]} />
      </T>
      <T color="#B07A4A" position={[0, 0.27, 0]} outline={0.008}>
        <cylinderGeometry args={[0.085, 0.085, 0.03, 16]} />
      </T>
    </group>
  );
};

export const Shovel: React.FC<PropProps> = () => (
  <group rotation={[0, 0, 0.12]}>
    <T color="#8A5A3B" position={[0, 0.6, 0]} outline={0.01}>
      <cylinderGeometry args={[0.02, 0.02, 1.0, 8]} />
    </T>
    <T color="#8A5A3B" position={[0, 1.12, 0]} rotation={[0, 0, Math.PI / 2]} outline={0.01}>
      <cylinderGeometry args={[0.018, 0.018, 0.16, 8]} />
    </T>
    <T color="#8E949B" position={[0, 0.06, 0]} outline={0.012}>
      <boxGeometry args={[0.2, 0.24, 0.03]} />
    </T>
  </group>
);

/** Fresh earth mound with a plain wooden cross at its head. */
export const FreshGrave: React.FC<PropProps> = () => (
  <group>
    <T color="#6B4A30" scale={[0.6, 0.22, 1.1]} position={[0, 0.02, 0]} outline={0.015}>
      <sphereGeometry args={[1, 20, 12]} />
    </T>
    <group position={[0, 0, -1.15]}>
      <T color="#8A5A3B" position={[0, 0.45, 0]} outline={0.012}>
        <boxGeometry args={[0.07, 0.9, 0.07]} />
      </T>
      <T color="#8A5A3B" position={[0, 0.68, 0]} outline={0.012}>
        <boxGeometry args={[0.42, 0.07, 0.07]} />
      </T>
    </group>
  </group>
);

export const Gravestone: React.FC<PropProps> = () => (
  <group>
    <T color="#9EA3A8" position={[0, 0.4, 0]} outline={0.015}>
      <boxGeometry args={[0.55, 0.8, 0.12]} />
    </T>
    <T color="#9EA3A8" position={[0, 0.8, 0]} rotation={[Math.PI / 2, 0, 0]} outline={0.015}>
      <cylinderGeometry args={[0.275, 0.275, 0.12, 24, 1, false, 0, Math.PI]} />
    </T>
    <Ink color="#5E6368" position={[0, 0.55, 0.062]}>
      <planeGeometry args={[0.04, 0.3]} />
    </Ink>
    <Ink color="#5E6368" position={[0, 0.6, 0.062]}>
      <planeGeometry args={[0.18, 0.04]} />
    </Ink>
  </group>
);

const Book: React.FC<{ open: number }> = ({ open }) => {
  // open: 1 = flat open, 0 = shut. Each half hinges on the spine (local x = 0).
  const a = (Math.PI / 2) * (1 - open);
  return (
    <group rotation={[-1.1, 0, 0]}>
      {[1, -1].map((s) => (
        <group key={s} rotation={[0, s * a, 0]}>
          <T color="#8E2A2A" position={[s * 0.15, 0, -0.01]} outline={0.012}>
            <boxGeometry args={[0.3, 0.4, 0.02]} />
          </T>
          <T color="#F4ECD4" position={[s * 0.145, 0, 0.01]} outline={false}>
            <boxGeometry args={[0.27, 0.37, 0.025]} />
          </T>
        </group>
      ))}
    </group>
  );
};

/** The host's story book: falls open at the start of the shot. */
export const StoryBook: React.FC<PropProps> = ({ f }) => <Book open={interpolate(f, [0, 10], [0.2, 1], { ...clamp, easing: Easing.out(Easing.cubic) })} />;

/** Open book that slams shut on its start frame (use startAt on the last word). */
export const StoryBookSlam: React.FC<PropProps> = ({ f }) => <Book open={interpolate(f, [0, 4], [1, 0], { ...clamp, easing: Easing.in(Easing.cubic) })} />;
