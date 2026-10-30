// Furniture and room props.
import React from "react";
import { Ink, T } from "../components/toon";
import { signTexture, stripesTexture } from "../components/textures";
import type { PropProps } from "./types";

export const Armchair: React.FC<PropProps & { color?: string }> = ({ color = "#5FA8A0" }) => (
  <group>
    <T color={color} position={[0, 0.25, 0]} outline={0.02}>
      <boxGeometry args={[0.95, 0.5, 0.85]} />
    </T>
    <T color={color} position={[0, 0.75, -0.33]} outline={0.02}>
      <boxGeometry args={[0.95, 0.75, 0.2]} />
    </T>
    {[0.42, -0.42].map((x) => (
      <T key={x} color={color} position={[x, 0.6, 0]} outline={0.02}>
        <boxGeometry args={[0.14, 0.32, 0.85]} />
      </T>
    ))}
    <T color="#F4EEE2" position={[0, 0.52, 0.05]} outline={0.012}>
      <boxGeometry args={[0.62, 0.06, 0.6]} />
    </T>
  </group>
);

export const Sofa: React.FC<PropProps & { color?: string }> = ({ color = "#B96E58" }) => (
  <group>
    <T color={color} position={[0, 0.22, 0]} outline={0.02}>
      <boxGeometry args={[2.1, 0.44, 0.85]} />
    </T>
    <T color={color} position={[0, 0.7, -0.35]} outline={0.02}>
      <boxGeometry args={[2.1, 0.7, 0.18]} />
    </T>
    {[1.0, -1.0].map((x) => (
      <T key={x} color={color} position={[x, 0.55, 0]} outline={0.02}>
        <boxGeometry args={[0.16, 0.3, 0.85]} />
      </T>
    ))}
    {[0.5, -0.5].map((x) => (
      <T key={x} color="#D8907A" position={[x, 0.48, 0.03]} outline={0.012}>
        <boxGeometry args={[0.9, 0.08, 0.65]} />
      </T>
    ))}
  </group>
);

/** Wall shelf with a few knick-knacks; the piggy bank sits on top. */
export const Shelf: React.FC<PropProps> = () => (
  <group>
    <T color="#8A5A3B" outline={0.015}>
      <boxGeometry args={[1.1, 0.06, 0.32]} />
    </T>
    {[0.45, -0.45].map((x) => (
      <T key={x} color="#6B4530" position={[x, -0.12, -0.08]} outline={0.01}>
        <boxGeometry args={[0.05, 0.2, 0.12]} />
      </T>
    ))}
    <T color="#F2C14E" position={[-0.38, 0.12, 0]} outline={0.012}>
      <boxGeometry args={[0.18, 0.18, 0.04]} />
    </T>
    <T color="#7FB4E6" position={[0.4, 0.1, 0]} outline={0.012}>
      <cylinderGeometry args={[0.06, 0.07, 0.15, 12]} />
    </T>
  </group>
);

/** Ticking wall clock: hands follow the frame. */
export const WallClock: React.FC<PropProps> = ({ f }) => (
  <group>
    <T color="#FFF7E0" rotation={[Math.PI / 2, 0, 0]} outline={0.02}>
      <cylinderGeometry args={[0.3, 0.3, 0.06, 28]} />
    </T>
    {Array.from({ length: 12 }, (_, i) => (
      <Ink key={i} position={[Math.sin((i / 12) * Math.PI * 2) * 0.24, Math.cos((i / 12) * Math.PI * 2) * 0.24, 0.035]}>
        <circleGeometry args={[0.015, 8]} />
      </Ink>
    ))}
    <group position={[0, 0, 0.04]} rotation={[0, 0, -Math.floor(f / 15) * ((Math.PI * 2) / 60)]}>
      <Ink position={[0, 0.1, 0]}>
        <planeGeometry args={[0.012, 0.2]} />
      </Ink>
    </group>
    <group position={[0, 0, 0.041]} rotation={[0, 0, -1.1]}>
      <Ink position={[0, 0.06, 0]}>
        <planeGeometry args={[0.022, 0.13]} />
      </Ink>
    </group>
  </group>
);

/** A single bare bulb on a cord. Glows; the Lighting preset supplies the actual light. */
export const OverheadBulb: React.FC<PropProps> = ({ f }) => (
  <group rotation={[0, 0, Math.sin(f * 0.04) * 0.03]}>
    <Ink position={[0, 0.8, 0]}>
      <cylinderGeometry args={[0.008, 0.008, 1.6, 6]} />
    </Ink>
    <T color="#3A3A40" position={[0, 0.05, 0]} outline={0.012}>
      <coneGeometry args={[0.2, 0.16, 18, 1, true]} />
    </T>
    <T color="#FFE7B0" emissive="#FFC46B" emissiveIntensity={2.2} position={[0, -0.06, 0]} outline={false}>
      <sphereGeometry args={[0.07, 16, 12]} />
    </T>
  </group>
);

export const Table: React.FC<PropProps & { color?: string }> = ({ color = "#F4EEE2" }) => (
  <group>
    <T color={color} position={[0, 0.74, 0]} outline={0.02}>
      <cylinderGeometry args={[0.55, 0.55, 0.06, 28]} />
    </T>
    <T color="#C0392B" position={[0, 0.775, 0]} outline={false}>
      <cylinderGeometry args={[0.45, 0.45, 0.01, 28]} />
    </T>
    <T color="#3A3A40" position={[0, 0.37, 0]} outline={0.015}>
      <cylinderGeometry args={[0.05, 0.05, 0.72, 10]} />
    </T>
    <T color="#3A3A40" position={[0, 0.02, 0]} outline={0.015}>
      <cylinderGeometry args={[0.3, 0.3, 0.04, 20]} />
    </T>
  </group>
);

const Chair: React.FC<{ color?: string }> = ({ color = "#FFFFFF" }) => (
  <group>
    <T color={color} position={[0, 0.45, 0]} outline={0.012}>
      <boxGeometry args={[0.42, 0.05, 0.42]} />
    </T>
    <T color={color} position={[0, 0.75, -0.19]} outline={0.012}>
      <boxGeometry args={[0.42, 0.55, 0.04]} />
    </T>
    {[
      [0.18, 0.18], [-0.18, 0.18], [0.18, -0.18], [-0.18, -0.18],
    ].map(([x, z]) => (
      <T key={`${x}${z}`} color={color} position={[x, 0.22, z]} outline={0.008}>
        <cylinderGeometry args={[0.02, 0.02, 0.45, 6]} />
      </T>
    ))}
  </group>
);

/** Rows of white wedding chairs; the front one is Jerry's, with a name card, empty. */
export const EmptyChairNameCard: React.FC<PropProps> = () => {
  const card = signTexture("JERRY", "#FFFFFF", "#1A1A1A", 512, 200);
  return (
    <group>
      <Chair />
      <group position={[0, 0.52, 0.05]} rotation={[-0.35, 0, 0]}>
        <T color="#FFFFFF" map={card} outline={0.008}>
          <planeGeometry args={[0.3, 0.12]} />
        </T>
      </group>
      <T color="#F7A6C3" position={[0.2, 1.0, -0.19]} outline={0.008}>
        <sphereGeometry args={[0.06, 10, 8]} />
      </T>
      {/* other guests' chairs, occupied by nobody we know: only Jerry's matters */}
      {[-1.6, -1.05, 0.55, 1.1].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <Chair />
        </group>
      ))}
      {[-1.6, -1.05, -0.5, 0.55, 1.1].map((x) => (
        <group key={`b${x}`} position={[x, 0, -0.9]}>
          <Chair />
        </group>
      ))}
    </group>
  );
};

/** TV with a frame-driven flickering game on screen. */
export const TV: React.FC<PropProps> = ({ f }) => {
  const flick = 0.75 + 0.25 * Math.abs(Math.sin(f * 0.7));
  return (
    <group>
      <T color="#26262B" position={[0, 0.7, 0]} outline={0.02}>
        <boxGeometry args={[1.5, 0.9, 0.12]} />
      </T>
      <T color="#4CAF50" emissive="#7CFF8A" emissiveIntensity={0.9 * flick} position={[0, 0.7, 0.062]} outline={false}>
        <planeGeometry args={[1.36, 0.76]} />
      </T>
      <Ink color="#FFFFFF" position={[0.2 + Math.sin(f * 0.2) * 0.35, 0.68, 0.064]}>
        <circleGeometry args={[0.04, 12]} />
      </Ink>
      <T color="#3A3A40" position={[0, 0.12, 0]} outline={0.015}>
        <boxGeometry args={[0.5, 0.24, 0.3]} />
      </T>
    </group>
  );
};

/** Low cushioned waiting-room bench. Seat top at 0.23: a sitting character with pos y 0 lands on it. */
export const Bench: React.FC<PropProps> = () => {
  const cushion = stripesTexture("#3E6FB8", "#F2F0EA", 14);
  return (
    <group>
      <T color="#A0713F" position={[0, 0.08, 0]} outline={0.015}>
        <boxGeometry args={[1.7, 0.16, 0.46]} />
      </T>
      <T color="#FFFFFF" map={cushion} position={[0, 0.195, 0]} outline={0.012}>
        <boxGeometry args={[1.62, 0.07, 0.42]} />
      </T>
    </group>
  );
};

/** Office desk with papers, a mug and a BOSS nameplate facing the camera. */
export const Desk: React.FC<PropProps> = () => {
  const plate = signTexture("BOSS", "#26262B", "#F2C14E", 512, 160);
  return (
    <group>
      <T color="#8A5A3B" position={[0, 0.74, 0]} outline={0.02}>
        <boxGeometry args={[1.3, 0.07, 0.7]} />
      </T>
      {/* front panel hides the legs */}
      <T color="#6B4530" position={[0, 0.38, 0.3]} outline={0.02}>
        <boxGeometry args={[1.26, 0.66, 0.05]} />
      </T>
      {[0.6, -0.6].map((x) => (
        <T key={x} color="#6B4530" position={[x, 0.37, 0]} outline={0.015}>
          <boxGeometry args={[0.06, 0.74, 0.66]} />
        </T>
      ))}
      <T color="#FFFFFF" position={[-0.32, 0.79, -0.02]} rotation={[0, 0.2, 0]} outline={0.01}>
        <boxGeometry args={[0.3, 0.04, 0.38]} />
      </T>
      <T color="#E05A47" position={[0.4, 0.84, -0.1]} outline={0.012}>
        <cylinderGeometry args={[0.06, 0.06, 0.14, 14]} />
      </T>
      <T color="#FFFFFF" map={plate} position={[0.05, 0.83, 0.25]} rotation={[-0.35, 0, 0]} outline={0.01}>
        <boxGeometry args={[0.36, 0.11, 0.03]} />
      </T>
    </group>
  );
};
