// 1943 props for "How a Dead Man Beat an Army": papers, spy kit, naval silhouettes and room dressing.
import React from "react";
import { interpolate } from "remotion";
import * as THREE from "three";
import { Ink, T } from "../components/toon";
import { canvasTexture, signTexture } from "../components/textures";
import type { PropProps } from "./types";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** A lying figure in a greatcoat: built along +z (head at +z), root on the ground. */
const Body: React.FC<PropProps & { water?: boolean }> = ({ f, water }) => {
  const sink = water ? interpolate(f, [0, 90], [0, -0.55], clamp) : 0;
  const bob = Math.sin(f * 0.06) * 0.012;
  return (
    <group position={[0, sink + bob, 0]} rotation={[0, Math.sin(f * 0.02) * 0.05, 0]}>
      {/* greatcoat torso */}
      <T color="#3D444C" position={[0, 0.15, 0]} rotation={[Math.PI / 2, 0, 0]} outline={0.02}>
        <capsuleGeometry args={[0.17, 0.42, 8, 16]} />
      </T>
      <T color="#2E343B" position={[0, 0.15, -0.02]} rotation={[Math.PI / 2, 0, 0]} outline={0.012}>
        <cylinderGeometry args={[0.18, 0.18, 0.1, 16]} />
      </T>
      {/* head, face up */}
      <T color="#FBFBF8" position={[0, 0.16, 0.44]} outline={0.018}>
        <sphereGeometry args={[0.18, 24, 16]} />
      </T>
      <Ink color="#141414" position={[-0.06, 0.3, 0.5]}>
        <boxGeometry args={[0.05, 0.012, 0.012]} />
      </Ink>
      <Ink color="#141414" position={[0.06, 0.3, 0.5]}>
        <boxGeometry args={[0.05, 0.012, 0.012]} />
      </Ink>
      {/* uniform cap tipped off the crown */}
      <T color="#2B3240" position={[0, 0.3, 0.4]} rotation={[0.2, 0.3, 0]} outline={0.01}>
        <cylinderGeometry args={[0.2, 0.17, 0.08, 18]} />
      </T>
      {/* legs */}
      {[-0.08, 0.08].map((x) => (
        <group key={x} position={[x, 0.09, -0.24]}>
          <T color="#2E343B" position={[0, 0, -0.28]} rotation={[Math.PI / 2, 0, 0]} outline={0.012}>
            <capsuleGeometry args={[0.055, 0.4, 6, 10]} />
          </T>
          <T color="#1E1E24" position={[0, 0, -0.56]} scale={[1, 0.7, 1.4]} outline={0.008}>
            <sphereGeometry args={[0.07, 12, 8]} />
          </T>
        </group>
      ))}
      {/* arms out to the sides */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.16, 0.1, 0.12]} rotation={[0, 0, s * 0.9]}>
          <T color="#3D444C" position={[0, 0, -0.2]} rotation={[Math.PI / 2, 0, 0]} outline={0.012}>
            <capsuleGeometry args={[0.045, 0.34, 6, 10]} />
          </T>
          <T color="#FBFBF8" position={[0, 0, -0.42]} outline={0.008}>
            <sphereGeometry args={[0.05, 10, 8]} />
          </T>
        </group>
      ))}
    </group>
  );
};

export const DeadBody: React.FC<PropProps> = (p) => <Body {...p} />;
export const DeadBodyWater: React.FC<PropProps> = (p) => <Body {...p} water />;

/** Manila folder with a few typed sheets. Lies flat. */
export const Dossier: React.FC<PropProps> = () => (
  <group>
    <T color="#C9A46A" position={[0, 0.008, 0]} rotation={[0, 0.04, 0]} outline={0.008}>
      <boxGeometry args={[0.4, 0.014, 0.3]} />
    </T>
    <T color="#F2EAD4" position={[0.01, 0.02, 0.005]} rotation={[0, -0.03, 0]} outline={0.004}>
      <boxGeometry args={[0.36, 0.012, 0.26]} />
    </T>
    {[0.07, 0.02, -0.03].map((z, i) => (
      <Ink key={z} color="#8A8170" position={[0.02, 0.027, z]}>
        <boxGeometry args={[0.26 - i * 0.02, 0.002, 0.006]} />
      </Ink>
    ))}
    <Ink color="#B23A32" position={[0.12, 0.028, -0.08]} rotation={[-Math.PI / 2, 0, 0.2]}>
      <torusGeometry args={[0.045, 0.006, 6, 18]} />
    </Ink>
  </group>
);

const secretTexture = (title: string, stamp: string) =>
  canvasTexture(`ww2-paper:${title}:${stamp}`, 512, 384, (ctx, w, h) => {
    ctx.fillStyle = "#F2EAD4";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(120, 100, 70, 0.35)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.moveTo(36, 92 + i * 28);
      ctx.lineTo(w - 40 - (i % 3) * 30, 92 + i * 28);
      ctx.stroke();
    }
    ctx.fillStyle = "#3A2E1E";
    ctx.font = "bold 30px sans-serif";
    ctx.fillText(title, 36, 52);
    ctx.strokeStyle = "#B23A32";
    ctx.lineWidth = 6;
    ctx.strokeRect(w * 0.55, h * 0.52, w * 0.36, h * 0.3);
    ctx.fillStyle = "#B23A32";
    ctx.font = "bold 34px sans-serif";
    ctx.save();
    ctx.translate(w * 0.73, h * 0.7);
    ctx.rotate(-0.12);
    ctx.textAlign = "center";
    ctx.fillText(stamp, 0, 0);
    ctx.restore();
  });

/** Invasion plans on the desk: two sheets, TOP SECRET, GREECE. */
export const FakeOrders: React.FC<PropProps> = () => (
  <group>
    <T color="#FFFFFF" map={secretTexture("OPERATION MINCEMEAT", "TOP SECRET")} position={[0, 0.006, 0]} rotation={[0, 0.06, 0]} outline={0.006}>
      <boxGeometry args={[0.43, 0.008, 0.3]} />
    </T>
    <T color="#FFFFFF" map={secretTexture("GREECE", "APPROVED")} position={[0.06, 0.014, 0.03]} rotation={[0, -0.18, 0]} outline={0.004}>
      <boxGeometry args={[0.36, 0.006, 0.26]} />
    </T>
  </group>
);

/** Framed Mediterranean map for the wall. Faces +z. */
export const MapWall: React.FC<PropProps> = ({ f }) => {
  const tex = React.useMemo(
    () =>
      canvasTexture("ww2-wall-map", 768, 540, (ctx, w, h) => {
        ctx.fillStyle = "#E5D4AE";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "rgba(110, 88, 54, 0.4)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 10; i++) {
          ctx.beginPath();
          ctx.moveTo(0, (i / 10) * h);
          ctx.lineTo(w, (i / 10) * h + 10);
          ctx.stroke();
        }
        ctx.fillStyle = "#C7B78C";
        [[0.35, 0.4, 0.2], [0.6, 0.55, 0.15], [0.72, 0.35, 0.12]].forEach(([x, y, r]) => {
          ctx.beginPath();
          ctx.ellipse(w * x, h * y, w * r, h * r * 0.8, 0.3, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.fillStyle = "#8FA97A";
        [[0.55, 0.74], [0.68, 0.7], [0.8, 0.62]].forEach(([x, y]) => {
          ctx.beginPath();
          ctx.ellipse(w * x, h * y, 26, 14, 0.4, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.strokeStyle = "#B23A32";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(w * 0.58, h * 0.72);
        ctx.quadraticCurveTo(w * 0.66, h * 0.55, w * 0.78, h * 0.42);
        ctx.stroke();
        ctx.fillStyle = "#B23A32";
        [[0.58, 0.72], [0.78, 0.42], [0.62, 0.78]].forEach(([x, y]) => {
          ctx.beginPath();
          ctx.arc(w * x, h * y, 7, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.fillStyle = "#3A2E1E";
        ctx.font = "bold 26px sans-serif";
        ctx.fillText("THE MEDITERRANEAN", 28, 44);
        ctx.font = "bold 20px sans-serif";
        ctx.fillText("SICILY", w * 0.52, h * 0.82);
        ctx.fillText("GREECE", w * 0.68, h * 0.38);
      }),
    [],
  );
  return (
    <group rotation={[0, Math.sin(f * 0.004) * 0.01, 0]}>
      <T color="#6B4A30" outline={0.016}>
        <boxGeometry args={[1.06, 0.8, 0.05]} />
      </T>
      <T color="#FFFFFF" map={tex} position={[0, 0, 0.032]} outline={false}>
        <planeGeometry args={[0.96, 0.7]} />
      </T>
    </group>
  );
};

/** Leather briefcase with a handcuff chain. Handle at the origin, body hanging below. */
export const Briefcase: React.FC<PropProps> = () => (
  <group>
    <T color="#7A4E2E" position={[0, -0.26, 0]} outline={0.016}>
      <boxGeometry args={[0.44, 0.3, 0.13]} />
    </T>
    <T color="#5E3B22" position={[0, -0.1, 0]} outline={0.01}>
      <boxGeometry args={[0.12, 0.035, 0.05]} />
    </T>
    <T color="#5E3B22" position={[0, -0.17, 0]} outline={0.01}>
      <boxGeometry args={[0.08, 0.06, 0.03]} />
    </T>
    {[-0.13, 0.13].map((x) => (
      <T key={x} color="#D4A93A" position={[x, -0.17, 0.07]} outline={0.004}>
        <boxGeometry args={[0.05, 0.035, 0.012]} />
      </T>
    ))}
    <T color="#F2EAD4" map={signTexture("TOP SECRET", "#F2EAD4", "#B23A32", 512, 128)} position={[0, -0.3, 0.069]} outline={false}>
      <planeGeometry args={[0.2, 0.05]} />
    </T>
    {/* chain to the wrist: three links trailing sideways */}
    {[0.06, 0.14, 0.22].map((x, i) => (
      <T key={x} color="#B8BEC4" position={[x, -0.12 - i * 0.02, 0]} rotation={[0, 0, 0.3]} outline={0.004}>
        <torusGeometry args={[0.028, 0.008, 6, 14]} />
      </T>
    ))}
  </group>
);

/** Small fishing trawler silhouette: hull, wheelhouse, mast. Sits in water (y 0). */
export const FishingBoat: React.FC<PropProps> = ({ f }) => (
  <group rotation={[0, 0, Math.sin(f * 0.04) * 0.02]}>
    <T color="#5E4A36" position={[0, 0.12, 0]} scale={[1.9, 0.4, 0.8]} outline={0.02}>
      <sphereGeometry args={[0.5, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
    </T>
    <T color="#D8D2C4" position={[0.1, 0.4, 0]} outline={0.014}>
      <boxGeometry args={[0.62, 0.4, 0.44]} />
    </T>
    <T color="#3A4A55" position={[0.1, 0.5, 0.23]} outline={0.008}>
      <boxGeometry args={[0.3, 0.16, 0.02]} />
    </T>
    <Ink position={[-0.5, 0.75, 0]}>
      <cylinderGeometry args={[0.018, 0.024, 0.9, 6]} />
    </Ink>
    <T color="#D8D2C4" position={[-0.5, 0.55, 0]} rotation={[0, 0, Math.PI / 2]} outline={0.006}>
      <cylinderGeometry args={[0.012, 0.012, 0.3, 6]} />
    </T>
    {/* net pile */}
    <T color="#7A8A6A" position={[-0.2, 0.28, 0.1]} scale={[1, 0.4, 1]} outline={0.008}>
      <sphereGeometry args={[0.16, 12, 8]} />
    </T>
  </group>
);

/** Grey destroyer silhouette for the far water. */
export const Destroyer: React.FC<PropProps> = () => (
  <group>
    <T color="#4A545C" position={[0, 0.14, 0]} scale={[2.4, 0.32, 0.7]} outline={0.02}>
      <sphereGeometry args={[0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
    </T>
    <T color="#4A545C" position={[-0.2, 0.34, 0]} outline={0.012}>
      <boxGeometry args={[0.7, 0.28, 0.36]} />
    </T>
    <T color="#3A444C" position={[0.2, 0.3, 0]} outline={0.01}>
      <boxGeometry args={[0.3, 0.2, 0.3]} />
    </T>
    {[-0.35, 0.1].map((x) => (
      <group key={x} position={[x, 0.5, 0]}>
        <Ink position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.05, 0.06, 0.4, 8]} />
        </Ink>
      </group>
    ))}
  </group>
);

/** Blunt-bow landing craft. */
export const LandingCraft: React.FC<PropProps> = () => (
  <group>
    <T color="#5B6658" position={[0, 0.14, 0]} outline={0.016}>
      <boxGeometry args={[1.5, 0.34, 0.56]} />
    </T>
    <T color="#4A5448" position={[0.76, 0.2, 0]} rotation={[0, 0, 0.25]} outline={0.012}>
      <boxGeometry args={[0.3, 0.34, 0.56]} />
    </T>
    <T color="#3A443C" position={[-0.5, 0.35, 0.2]} outline={0.01}>
      <boxGeometry args={[0.24, 0.16, 0.18]} />
    </T>
  </group>
);

/** Bakelite radio receiver with a lit dial and antenna. */
export const RadioSet: React.FC<PropProps> = ({ f }) => (
  <group>
    <T color="#5E4A36" position={[0, 0.14, 0]} outline={0.016}>
      <boxGeometry args={[0.5, 0.28, 0.24]} />
    </T>
    <T color="#E8D9B4" emissive="#FFD58A" emissiveIntensity={0.35 + Math.sin(f * 0.4) * 0.06} position={[0, 0.17, 0.121]} outline={0.006}>
      <planeGeometry args={[0.26, 0.12]} />
    </T>
    {[-0.15, 0.15].map((x) => (
      <T key={x} color="#2E2E33" position={[x, 0.08, 0.122]} outline={0.006}>
        <cylinderGeometry args={[0.035, 0.035, 0.02, 14]} />
      </T>
    ))}
    <Ink position={[0, 0.42, 0]} rotation={[0, 0, 0.08]}>
      <cylinderGeometry args={[0.008, 0.01, 0.46, 6]} />
    </Ink>
    <T color="#3A3A40" position={[0, 0.66, 0]} outline={0.004}>
      <sphereGeometry args={[0.018, 8, 6]} />
    </T>
  </group>
);

/** Telegram strip with typed lines. Lies flat. */
export const Telegram: React.FC<PropProps> = () => (
  <group>
    <T color="#F4EBD6" outline={0.006}>
      <boxGeometry args={[0.34, 0.008, 0.17]} />
    </T>
    {[-0.05, 0, 0.05].map((z, i) => (
      <Ink key={z} color="#6E6252" position={[0.02, 0.006, z]}>
        <boxGeometry args={[0.2 - i * 0.04, 0.002, 0.006]} />
      </Ink>
    ))}
    <Ink color="#B23A32" position={[-0.12, 0.006, 0]}>
      <boxGeometry args={[0.03, 0.003, 0.03]} />
    </Ink>
  </group>
);

/** Cream envelope with a red wax seal. Lies flat. */
export const Envelope: React.FC<PropProps> = () => (
  <group>
    <T color="#F2EAD4" outline={0.006}>
      <boxGeometry args={[0.28, 0.008, 0.19]} />
    </T>
    <Ink color="#C9BFA8" position={[0, 0.006, 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.24, 0.1]} />
    </Ink>
    <T color="#B23A32" position={[0, 0.01, 0.01]} outline={0.004}>
      <cylinderGeometry args={[0.04, 0.04, 0.008, 16]} />
    </T>
    <Ink color="#8E2A22" position={[0, 0.015, 0.01]}>
      <torusGeometry args={[0.018, 0.004, 6, 14]} />
    </Ink>
  </group>
);

/** Rubber date stamp and ink pad. */
export const Stamp: React.FC<PropProps> = ({ f }) => {
  const hit = Math.max(0, Math.sin(f * 0.12));
  return (
    <group>
      <T color="#2E2E33" position={[0, 0.02, 0]} outline={0.008}>
        <boxGeometry args={[0.16, 0.04, 0.1]} />
      </T>
      <T color="#7A4E2E" position={[0, 0.1 + hit * 0.02, 0]} outline={0.01}>
        <cylinderGeometry args={[0.03, 0.04, 0.14, 12]} />
      </T>
      <T color="#B23A32" position={[0.16, 0.012, 0]} outline={0.006}>
        <boxGeometry args={[0.12, 0.02, 0.08]} />
      </T>
    </group>
  );
};

/** Fountain pen. Lies flat along +x. */
export const Pen: React.FC<PropProps> = () => (
  <group>
    <T color="#1E1E24" position={[0, 0.012, 0]} rotation={[0, 0, Math.PI / 2]} outline={0.006}>
      <cylinderGeometry args={[0.012, 0.016, 0.16, 10]} />
    </T>
    <T color="#D4A93A" position={[0.01, 0.012, 0]} rotation={[0, 0, Math.PI / 2]} outline={0.004}>
      <cylinderGeometry args={[0.014, 0.014, 0.03, 10]} />
    </T>
  </group>
);

/** Lit cigarette: origin at the filter, body up. Smoke rises deterministically. */
export const Cigarette: React.FC<PropProps> = ({ f }) => (
  <group>
    <T color="#F2EAD4" position={[0, 0.055, 0]} outline={0.004}>
      <cylinderGeometry args={[0.012, 0.012, 0.11, 8]} />
    </T>
    <T color="#E8A25A" emissive="#E85A2A" emissiveIntensity={1.4} position={[0, 0.115, 0]} outline={false}>
      <sphereGeometry args={[0.013, 8, 6]} />
    </T>
    {[0, 1, 2].map((i) => {
      const t = (f * 0.02 + i * 0.33) % 1;
      return (
        <T key={i} color="#D8D2C4" transparent opacity={0.22 * (1 - t)} position={[Math.sin(f * 0.05 + i) * 0.03, 0.13 + t * 0.42, 0]} outline={false}>
          <sphereGeometry args={[0.02 + t * 0.05, 8, 6]} />
        </T>
      );
    })}
  </group>
);

/** Binoculars, lying flat. */
export const Binoculars: React.FC<PropProps> = () => (
  <group rotation={[0, 0, Math.PI / 2]}>
    {[-0.05, 0.05].map((x) => (
      <T key={x} color="#2E2E33" position={[x, 0.06, 0]} outline={0.008}>
        <cylinderGeometry args={[0.04, 0.045, 0.16, 12]} />
      </T>
    ))}
    <T color="#2E2E33" position={[0, 0.06, 0]} outline={0.006}>
      <boxGeometry args={[0.06, 0.03, 0.06]} />
    </T>
  </group>
);

/** 1940s morgue van: grey box body, dark cab, red cross. */
export const MorgueTruck: React.FC<PropProps> = () => (
  <group>
    <T color="#6E6A60" position={[0, 0.45, 0]} outline={0.016}>
      <boxGeometry args={[1.5, 0.7, 0.7]} />
    </T>
    <T color="#4A4E46" position={[0.85, 0.34, 0]} outline={0.014}>
      <boxGeometry args={[0.5, 0.52, 0.66]} />
    </T>
    <T color="#9EB7C4" position={[0.85, 0.46, 0.34]} outline={0.006}>
      <boxGeometry args={[0.26, 0.2, 0.01]} />
    </T>
    {[-0.45, 0.35].map((x) => (
      <group key={x} position={[x, 0.12, 0.3]}>
        <T color="#1E1E24" rotation={[Math.PI / 2, 0, 0]} outline={0.004}>
          <cylinderGeometry args={[0.15, 0.15, 0.1, 14]} />
        </T>
      </group>
    ))}
    <T color="#B23A32" position={[-0.25, 0.52, 0.355]} outline={0.004}>
      <boxGeometry args={[0.3, 0.06, 0.01]} />
    </T>
    <T color="#B23A32" position={[-0.25, 0.52, 0.355]} outline={0.004}>
      <boxGeometry args={[0.06, 0.18, 0.01]} />
    </T>
  </group>
);

/** Deck searchlight with a soft beam. */
export const Searchlight: React.FC<PropProps> = () => (
  <group>
    <T color="#3B434B" position={[0, 0.12, 0]} outline={0.012}>
      <cylinderGeometry args={[0.16, 0.22, 0.24, 12]} />
    </T>
    <T color="#6E7A84" position={[0, 0.38, 0]} rotation={[Math.PI / 2, 0, 0]} outline={0.016}>
      <cylinderGeometry args={[0.2, 0.24, 0.42, 18]} />
    </T>
    <T color="#FFE7B0" emissive="#FFE7B0" emissiveIntensity={1.8} position={[0, 0.38, 0.22]} outline={false}>
      <circleGeometry args={[0.19, 18]} />
    </T>
    <mesh position={[0, 0.38, 0.55]} rotation={[Math.PI / 2, 0, 0]}>
      <coneGeometry args={[0.5, 1.1, 20, 1, true]} />
      <meshBasicMaterial color="#FFE7B0" transparent opacity={0.1} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  </group>
);

/** Three-post deck railing segment. */
export const SubmarineRail: React.FC<PropProps> = () => (
  <group>
    {[-0.7, 0, 0.7].map((x) => (
      <T key={x} color="#3B434B" position={[x, 0.36, 0]} outline={0.012}>
        <cylinderGeometry args={[0.025, 0.03, 0.72, 8]} />
      </T>
    ))}
    {[0.7, 0.42].map((y) => (
      <Ink key={y} color="#3B434B" position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, 1.5, 6]} />
      </Ink>
    ))}
  </group>
);

/** Metal mortuary slab. */
export const Slab: React.FC<PropProps> = () => (
  <group>
    <T color="#AEB6BA" position={[0, 0.66, 0]} outline={0.018}>
      <boxGeometry args={[1.7, 0.09, 0.72]} />
    </T>
    <T color="#C9D0D2" position={[0, 0.71, 0]} outline={false}>
      <boxGeometry args={[1.6, 0.012, 0.64]} />
    </T>
    {[-0.7, 0.7].map((x) => (
      <group key={x}>
        <Ink position={[x, 0.33, 0]}>
          <boxGeometry args={[0.05, 0.62, 0.05]} />
        </Ink>
        <Ink position={[x, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <boxGeometry args={[0.12, 0.5, 0.04]} />
        </Ink>
      </group>
    ))}
    <T color="#8A9296" position={[0.55, 0.72, 0.3]} outline={0.004}>
      <cylinderGeometry args={[0.05, 0.05, 0.02, 10]} />
    </T>
  </group>
);

/** Green banker's lamp with a brass stem. */
export const DeskLamp: React.FC<PropProps> = ({ f }) => (
  <group>
    <T color="#C9A227" position={[0, 0.02, 0]} outline={0.01}>
      <cylinderGeometry args={[0.09, 0.11, 0.03, 16]} />
    </T>
    <T color="#C9A227" position={[0, 0.14, 0]} outline={0.008}>
      <cylinderGeometry args={[0.012, 0.016, 0.22, 8]} />
    </T>
    <T color="#2E5A3A" position={[0, 0.28, 0]} rotation={[0, 0, 0]} scale={[1, 0.42, 1]} outline={0.012}>
      <cylinderGeometry args={[0.2, 0.2, 0.16, 18, 1, false, 0, Math.PI]} />
    </T>
    <T color="#FFE7B0" emissive="#FFD58A" emissiveIntensity={1.4 + Math.sin(f * 0.08) * 0.04} position={[0, 0.26, 0]} outline={false}>
      <sphereGeometry args={[0.05, 10, 8]} />
    </T>
  </group>
);

/** Wooden chair, back facing -z. */
export const Chair: React.FC<PropProps> = () => (
  <group>
    <T color="#5E4026" position={[0, 0.44, 0]} outline={0.014}>
      <boxGeometry args={[0.46, 0.06, 0.44]} />
    </T>
    <T color="#5E4026" position={[0, 0.78, -0.2]} outline={0.014}>
      <boxGeometry args={[0.46, 0.62, 0.06]} />
    </T>
    {[[-0.19, -0.17], [0.19, -0.17], [-0.19, 0.17], [0.19, 0.17]].map(([dx, dz]) => (
      <Ink key={`${dx}${dz}`} position={[dx, 0.21, dz]}>
        <boxGeometry args={[0.035, 0.42, 0.035]} />
      </Ink>
    ))}
  </group>
);

/** Coat rack with a hanging overcoat. */
export const CoatRack: React.FC<PropProps> = () => (
  <group>
    <T color="#4A3220" position={[0, 0.04, 0]} outline={0.014}>
      <cylinderGeometry args={[0.2, 0.24, 0.08, 16]} />
    </T>
    <Ink position={[0, 0.95, 0]}>
      <cylinderGeometry args={[0.025, 0.03, 1.86, 8]} />
    </Ink>
    {[1.72, 1.5].map((y, i) => (
      <Ink key={y} position={[0.14 + i * 0.02, y, 0]} rotation={[0, 0, -1.1]}>
        <cylinderGeometry args={[0.012, 0.012, 0.26, 6]} />
      </Ink>
    ))}
    <T color="#4B4F3E" position={[0.16, 1.18, 0]} scale={[1, 1, 0.55]} outline={0.014}>
      <coneGeometry args={[0.2, 1.0, 12]} />
    </T>
    <T color="#3E4236" position={[0.16, 1.66, 0]} outline={0.01}>
      <sphereGeometry args={[0.09, 10, 8]} />
    </T>
  </group>
);
