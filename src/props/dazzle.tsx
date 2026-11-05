// "How a Paintbrush Beat a Submarine" (WWI dazzle camouflage): the striped warship, painter's kit,
// the U-boat (cutaway), its periscope and torpedo, and the deck ball. All motion is a function of `f`.
import React from "react";
import * as THREE from "three";
import { interpolate, random } from "remotion";
import { canvasTexture } from "../components/textures";
import { Ink, T } from "../components/toon";
import type { PropProps } from "./types";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const GREY = "#8C949B";
const DARK = "#1C1E26";
const BLUE = "#2F6DB5";

/** Interlocking dazzle wedges; mirrored left/right so bow and stern read alike. */
export const dazzleTexture = () =>
  canvasTexture("dazzle-v1", 2048, 512, (ctx, w, h) => {
    ctx.fillStyle = "#F2F0EA";
    ctx.fillRect(0, 0, w, h);
    const colors = [DARK, BLUE, DARK, "#9AA3AB", DARK, BLUE];
    for (let i = 0; i < 9; i++) {
      const x = (i / 9) * (w / 2);
      const lean = (random(`dz-lean-${i}`) - 0.5) * 420;
      const wide = 60 + random(`dz-w-${i}`) * 110;
      ctx.fillStyle = colors[i % colors.length];
      for (const mirror of [false, true]) {
        const m = (v: number) => (mirror ? w - v : v);
        ctx.beginPath();
        ctx.moveTo(m(x), 0);
        ctx.lineTo(m(x + wide), 0);
        ctx.lineTo(m(x + wide + lean), h);
        ctx.lineTo(m(x + lean * 0.4), h);
        ctx.closePath();
        ctx.fill();
      }
    }
    // A broken diagonal band across the middle: the stripe that "runs the wrong way".
    ctx.fillStyle = DARK;
    ctx.beginPath();
    ctx.moveTo(w * 0.38, h);
    ctx.lineTo(w * 0.46, h);
    ctx.lineTo(w * 0.66, 0);
    ctx.lineTo(w * 0.58, 0);
    ctx.closePath();
    ctx.fill();
  });

// Hull: bow at +z, waterline at local y 0, deck at y 2.6, beam 2.4, 12 long.
const L = 9.6;
const B = 2.4;
const DECK = 2.6;
const KEEL = -0.8;
const HULL_H = DECK - KEEL;

const Hull: React.FC<{ paint: number; ghost?: boolean }> = ({ paint, ghost }) => {
  const tex = dazzleTexture();
  const mid = (DECK + KEEL) / 2;
  const look = ghost
    ? { color: "#FFFFFF", transparent: true, opacity: 0.32, outline: false as const }
    : { color: GREY };
  // Unpainted (grey) part of the +x side, shrinking from the bow end as `paint` goes 0 → 1.
  const bare = Math.max(0, 1 - paint) * L;
  return (
    <group>
      <T {...look} position={[0, mid, 0]}>
        <boxGeometry args={[B, HULL_H, L]} />
      </T>
      {[1, -1].map((s) => (
        <T key={s} {...look} position={[0, mid, s * (L / 2)]} rotation={[0, Math.PI / 4, 0]} scale={[1, 1, 1]}>
          <boxGeometry args={[B / Math.SQRT2, HULL_H, B / Math.SQRT2]} />
        </T>
      ))}
      {ghost ? null : (
        <>
          {[1, -1].map((s) => (
            <T key={s} color="#FFFFFF" map={tex} position={[s * (B / 2 + 0.006), mid, 0]} rotation={[0, s * Math.PI / 2, 0]} outline={false}>
              <planeGeometry args={[L, HULL_H]} />
            </T>
          ))}
          {bare > 0.01 ? (
            <T color={GREY} position={[B / 2 + 0.012, mid, L / 2 - bare / 2]} rotation={[0, Math.PI / 2, 0]} outline={false}>
              <planeGeometry args={[bare, HULL_H]} />
            </T>
          ) : null}
          <T color="#7A6A55" position={[0, DECK + 0.03, 0]} outline={false}>
            <boxGeometry args={[B - 0.04, 0.06, L]} />
          </T>
          {/* deckhouse, bridge, two funnels, a mast */}
          <T color="#FFFFFF" map={tex} position={[0, DECK + 0.6, -0.8]} outline={0.02}>
            <boxGeometry args={[1.5, 1.1, 3.2]} />
          </T>
          <T color={GREY} position={[0, DECK + 1.45, 0.4]} outline={0.018}>
            <boxGeometry args={[1.3, 0.6, 1.1]} />
          </T>
          {[-1.2, -2.4].map((z) => (
            <T key={z} color={DARK} position={[0, DECK + 1.9, z]} outline={0.016}>
              <cylinderGeometry args={[0.28, 0.32, 1.6, 14]} />
            </T>
          ))}
          <Ink position={[0, DECK + 2.6, 1.2]}>
            <cylinderGeometry args={[0.03, 0.04, 2.6, 6]} />
          </Ink>
          {/* deck-edge rails */}
          {[1, -1].map((s) => (
            <Ink key={s} color="#3B434B" position={[s * (B / 2 - 0.05), DECK + 0.62, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.015, 0.015, L, 6]} />
            </Ink>
          ))}
        </>
      )}
    </group>
  );
};

/** The warship. Paint coverage grows with `f` (45% at its frame 0, full 900 frames later);
 *  scenes after the painting start it with startOffset -900 so it arrives fully striped. */
export const DazzleWarship: React.FC<PropProps> = ({ f }) => <Hull paint={interpolate(f, [0, 900], [0.45, 1], clamp)} />;

/** The commander's wrong guess: a translucent copy that fades in and out over its span. */
export const GhostShip: React.FC<PropProps> = ({ f, d }) => {
  const o = interpolate(f, [0, 12, Math.max(13, d - 12), Math.max(14, d)], [0, 1, 1, 0], clamp);
  return o < 0.01 ? null : <group scale={[1.02 * o, 1.02, 1.02]}><Hull paint={1} ghost /></group>;
};

/** Trestle scaffold: two A-frames and a plank whose top is at y 0.9. */
export const Scaffold: React.FC<PropProps> = () => (
  <group>
    <T color="#B08A55" position={[0, 0.87, 0]} outline={0.012}>
      <boxGeometry args={[0.5, 0.06, 3.0]} />
    </T>
    {[-1.2, 1.2].map((z) =>
      [-0.18, 0.18].map((x) => (
        <T key={`${z}${x}`} color="#8A6A40" position={[x, 0.42, z]} rotation={[0, 0, x > 0 ? -0.2 : 0.2]} outline={0.01}>
          <boxGeometry args={[0.05, 0.9, 0.05]} />
        </T>
      )))}
  </group>
);

/** Brush held in a hand slot (same orientation as the hammer): handle up, black bristles. */
export const Paintbrush: React.FC<PropProps> = () => (
  <group rotation={[Math.PI / 2, 0, 0]}>
    <T color="#B08A55" position={[0, 0.1, 0]} outline={0.008}>
      <cylinderGeometry args={[0.018, 0.018, 0.24, 8]} />
    </T>
    <T color="#C9CCD0" position={[0, 0.24, 0]} outline={0.006}>
      <boxGeometry args={[0.1, 0.05, 0.035]} />
    </T>
    <T color={DARK} position={[0, 0.31, 0]} outline={0.006}>
      <boxGeometry args={[0.1, 0.1, 0.03]} />
    </T>
  </group>
);

export const PaintBucket: React.FC<PropProps> = () => (
  <group>
    <T color="#9AA3AB" position={[0, 0.13, 0]} outline={0.012}>
      <cylinderGeometry args={[0.14, 0.12, 0.26, 16]} />
    </T>
    <Ink position={[0, 0.262, 0]}>
      <cylinderGeometry args={[0.13, 0.13, 0.01, 16]} />
    </Ink>
    <Ink position={[0, 0.3, 0]} rotation={[0, 0, 0]}>
      <torusGeometry args={[0.14, 0.008, 6, 20, Math.PI]} />
    </Ink>
  </group>
);

/** Periscope cutting the surface (water at local y 0). It rises over its first 20 frames. */
export const Periscope: React.FC<PropProps> = ({ f }) => {
  const up = interpolate(f, [0, 20], [0.15, 0.7], clamp);
  return (
    <group>
      <Ink position={[0, up / 2 - 0.2, 0]}>
        <cylinderGeometry args={[0.04, 0.05, up + 0.4, 8]} />
      </Ink>
      <T color="#2C333A" position={[0, up, 0.04]} outline={0.008}>
        <boxGeometry args={[0.1, 0.12, 0.16]} />
      </T>
      {/* foam feather */}
      {[0, 1, 2].map((i) => (
        <T key={i} color="#E8F1F4" position={[0, 0.02, 0.25 + i * 0.28]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.18 - i * 0.04, 0.32, 1]} outline={false}>
          <circleGeometry args={[0.5, 10]} />
        </T>
      ))}
    </group>
  );
};

/** Periscope column for the control room: the eyepiece rides up 0.5 over its first 18 frames. */
export const PeriscopeColumn: React.FC<PropProps> = ({ f }) => {
  const up = interpolate(f, [0, 18], [0, 0.5], clamp);
  return (
    <group>
      <T color="#4E5A52" position={[0, 1.6, 0]} outline={0.014}>
        <cylinderGeometry args={[0.07, 0.07, 3.2, 12]} />
      </T>
      <group position={[0, 1.15 + up, 0]}>
        <T color="#3A433D" position={[0, 0, 0.08]} outline={0.012}>
          <boxGeometry args={[0.2, 0.22, 0.2]} />
        </T>
        {[-1, 1].map((s) => (
          <T key={s} color="#3A433D" position={[s * 0.2, -0.05, 0.08]} rotation={[0, 0, Math.PI / 2]} outline={0.008}>
            <cylinderGeometry args={[0.025, 0.025, 0.2, 8]} />
          </T>
        ))}
      </group>
    </group>
  );
};

/** U-boat with its +z side cut away so the control room shows (floor at local y -0.6). */
export const UboatCutaway: React.FC<PropProps> = ({ f }) => (
  <group>
    <T color="#4C5A55" rotation={[0, 0, Math.PI / 2]} side={THREE.DoubleSide} outline={0.02}>
      <cylinderGeometry args={[0.9, 0.9, 6, 28, 1, true, Math.PI * 0.85, Math.PI * 1.3]} />
    </T>
    {[1, -1].map((s) => (
      <T key={s} color="#4C5A55" position={[s * 3, 0, 0]} scale={[0.9, 1, 1]} outline={0.02}>
        <sphereGeometry args={[0.9, 20, 14, s > 0 ? 0 : Math.PI, Math.PI]} />
      </T>
    ))}
    <T color="#3A433D" position={[0, -0.62, 0]} outline={false}>
      <boxGeometry args={[5.6, 0.04, 1.5]} />
    </T>
    {/* conning tower */}
    <T color="#4C5A55" position={[0.4, 1.1, 0]} outline={0.018}>
      <boxGeometry args={[1.2, 0.6, 0.7]} />
    </T>
    {/* red lamp glow on the back wall */}
    <T color="#FF4A3A" emissive="#FF3020" emissiveIntensity={1.4 + Math.sin(f * 0.3) * 0.15} position={[-0.6, 0.35, -0.7]} outline={false}>
      <sphereGeometry args={[0.07, 10, 8]} />
    </T>
    {[-1.6, 1.4].map((x) => (
      <T key={x} color="#7A3A2E" position={[x, 0.1, -0.72]} rotation={[0, 0, 0]} outline={0.008}>
        <torusGeometry args={[0.16, 0.03, 6, 16]} />
      </T>
    ))}
  </group>
);

/** Torpedo running along local -z at the surface, foam wake behind it, starting at its frame 0. */
export const Torpedo: React.FC<PropProps> = ({ f }) => {
  const z = -Math.max(0, f) * 0.06;
  const trail = Math.min(4, Math.max(0.01, -z));
  return (
    <group>
      <group position={[0, -0.08, z]}>
        <T color="#6E777E" rotation={[Math.PI / 2, 0, 0]} outline={0.01}>
          <capsuleGeometry args={[0.08, 0.7, 6, 12]} />
        </T>
        <Ink position={[0, 0, 0.48]} rotation={[0, 0, f * 0.8]}>
          <boxGeometry args={[0.22, 0.03, 0.02]} />
        </Ink>
      </group>
      <T color="#EEF5F7" position={[0, 0.015, z + trail / 2 + 0.4]} rotation={[-Math.PI / 2, 0, 0]} outline={false}>
        <planeGeometry args={[0.22, trail]} />
      </T>
    </group>
  );
};

/** Deck ball for the "pass to a running friend" analogy. Thrown at its frame 0, it arcs ahead of the
 *  runner and, 80 frames later, sails past the camera. Coordinates are the deck scene's own (world). */
export const BallToss: React.FC<PropProps> = ({ f }) => {
  const t = interpolate(f, [0, 80], [0, 1], clamp);
  const a: [number, number, number] = [-1.15, 1.3, -1.75];
  const b: [number, number, number] = [0.4, 1.7, 0.75];
  const p = [0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * t);
  p[1] += Math.sin(t * Math.PI) * 0.9;
  return (
    <T color="#C8553D" position={p as [number, number, number]} rotation={[f * 0.2, f * 0.13, 0]} outline={0.01}>
      <sphereGeometry args={[0.11, 14, 10]} />
    </T>
  );
};

/** Ring lifebuoy, standing upright. */
export const Lifebuoy: React.FC<PropProps> = () => (
  <group>
    <T color="#F2F0EA" outline={0.012}>
      <torusGeometry args={[0.28, 0.08, 10, 24]} />
    </T>
    {[0, 1, 2, 3].map((i) => (
      <T key={i} color="#E8413C" rotation={[0, 0, (i * Math.PI) / 2 + 0.3]} outline={false}>
        <torusGeometry args={[0.28, 0.083, 10, 6, 0.5]} />
      </T>
    ))}
  </group>
);

/** Brass alarm bell on a post. */
export const ShipBell: React.FC<PropProps> = ({ f }) => (
  <group>
    <T color="#3B434B" position={[0, 0.7, 0]} outline={0.01}>
      <cylinderGeometry args={[0.03, 0.04, 1.4, 8]} />
    </T>
    <T color="#C9A23A" position={[0, 1.42, 0]} rotation={[0, 0, Math.sin(f * 0.9) * 0.25 * Math.exp(-f / 40)]} outline={0.012}>
      <cylinderGeometry args={[0.07, 0.14, 0.18, 14, 1, true]} />
    </T>
  </group>
);

/** Invisible gaze anchor for parts the set already draws (the striped rail): gaze targets need a placed prop. */
export const GazeMark: React.FC<PropProps> = () => null;
