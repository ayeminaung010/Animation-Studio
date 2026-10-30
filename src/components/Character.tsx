// One rig for every character: white sphere head (~40% of height), capsule body,
// thin black stick limbs, small round hands and feet. Looks swap hair, outfit and face.
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { CharacterDef, FaceName, Vec3 } from "../lib/shots";
import type { CharacterMotion } from "../motion/useCharacterMotion";
import { poseFor, type Euler3 } from "./actions";
import { Face, HEAD_R } from "./Face";
import { Ink, T } from "./toon";

export const STAGE = 2.2; // shot-list pos units → world units
export const HIP_Y = 0.47;
export const HEAD_CENTER_Y = HIP_Y + 0.6 + 0.32; // ≈ 1.39
export const SKIN = "#FBFBF8";

const LIMB_R = 0.024;
const ARM_LEN = 0.42;
const LEG_LEN = 0.45;

interface Look {
  body: string;
  outfit: string;
  hair: string;
  accessory?: string;
}

const resolveLook = (def: CharacterDef): Look => {
  if (def.preset === "everyman") {
    return { body: def.shirt ?? "#D94F30", outfit: "tshirt", hair: def.hair ?? "messy-brown", accessory: def.accessory };
  }
  const outfitColors: Record<string, string> = {
    "lavender-cardigan": "#8E7CC3",
    "white-shirt-black-vest": "#F4F1EA",
    "grey-suit-boutonniere": "#7A808A",
    "bride-dress": "#FFFFFF",
  };
  const outfit = def.outfit ?? "tshirt";
  return {
    body: def.outfit_color ?? def.shirt ?? outfitColors[outfit] ?? "#5A8BD6",
    outfit,
    hair: def.hair ?? "bald",
    accessory: def.accessory,
  };
};

/** Hair caps sit tilted back so the forehead and brows stay visible. */
const Cap: React.FC<{ color: string; theta?: number }> = ({ color, theta = 0.38 }) => (
  <T color={color} rotation={[-0.3, 0, 0]} outline={0.016}>
    <sphereGeometry args={[HEAD_R * 1.05, 28, 16, 0, Math.PI * 2, 0, Math.PI * theta]} />
  </T>
);

const Hair: React.FC<{ style: string }> = ({ style }) => {
  switch (style) {
    case "messy-brown":
      return (
        <group>
          <Cap color="#6B3E1F" />
          {[-0.5, -0.15, 0.2, 0.55, 0.9].map((a, i) => (
            <T key={i} color="#6B3E1F" outline={0.012}
              position={[Math.sin(a * 2) * 0.14, HEAD_R * 0.95, Math.cos(a * 2) * 0.1 - 0.02]}
              rotation={[0.4 * Math.cos(a * 3), 0, 0.5 * Math.sin(a * 3)]}>
              <coneGeometry args={[0.07, 0.16, 8]} />
            </T>
          ))}
        </group>
      );
    case "grey-bun":
      return (
        <group>
          <Cap color="#B9B9C4" theta={0.42} />
          <T color="#B9B9C4" position={[0, HEAD_R * 0.95, -0.12]} outline={0.014}>
            <sphereGeometry args={[0.12, 20, 14]} />
          </T>
        </group>
      );
    case "slick-black":
      return <Cap color="#1F1F26" theta={0.4} />;
    case "short-blond":
      return (
        <group>
          <Cap color="#E8C25A" theta={0.37} />
          {[-0.12, 0, 0.12].map((x) => (
            <T key={x} color="#E8C25A" outline={0.01} position={[x, 0.24, 0.2]}>
              <sphereGeometry args={[0.06, 12, 10]} />
            </T>
          ))}
        </group>
      );
    case "curly-orange":
      return (
        <group>
          <Cap color="#E07A2E" theta={0.36} />
          {Array.from({ length: 14 }, (_, i) => {
            const a = i * 2.39996; // golden angle: even, deterministic spread
            const r = 0.1 + 0.16 * Math.sqrt((i + 0.5) / 14);
            return (
              <T key={i} color="#E07A2E" outline={0.01}
                position={[Math.cos(a) * r, HEAD_R * 0.95 - r * 0.15, Math.sin(a) * r * 0.75 - 0.1]}>
                <sphereGeometry args={[0.075, 12, 10]} />
              </T>
            );
          })}
        </group>
      );
    case "ponytail-black":
      return (
        <group>
          <Cap color="#22212A" theta={0.42} />
          <T color="#22212A" position={[0, 0.05, -0.36]} rotation={[0.5, 0, 0]} outline={0.014}>
            <capsuleGeometry args={[0.06, 0.22, 6, 12]} />
          </T>
        </group>
      );
    case "top-hat":
      return (
        <group rotation={[-0.12, 0, 0]}>
          <T color="#1C1C24" position={[0, HEAD_R * 0.82, 0]} outline={0.016}>
            <cylinderGeometry args={[0.3, 0.3, 0.025, 28]} />
          </T>
          <T color="#1C1C24" position={[0, HEAD_R * 0.82 + 0.17, 0]} outline={0.016}>
            <cylinderGeometry args={[0.19, 0.18, 0.34, 28]} />
          </T>
          <T color="#2EC4E6" position={[0, HEAD_R * 0.82 + 0.05, 0]} outline={false}>
            <cylinderGeometry args={[0.185, 0.185, 0.06, 28]} />
          </T>
        </group>
      );
    case "flat-cap":
      return (
        <group rotation={[-0.2, 0, 0]}>
          <Cap color="#5C4330" theta={0.34} />
          <T color="#5C4330" position={[0, HEAD_R * 0.78, 0.2]} rotation={[0.25, 0, 0]} scale={[1, 0.25, 0.7]} outline={0.012}>
            <sphereGeometry args={[0.2, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </T>
        </group>
      );
    case "peaked-cap":
      return (
        <group rotation={[-0.15, 0, 0]}>
          <T color="#26314A" position={[0, HEAD_R * 0.8, 0]} outline={0.016}>
            <cylinderGeometry args={[0.27, 0.22, 0.14, 24]} />
          </T>
          <T color="#14141F" position={[0, HEAD_R * 0.72, 0.2]} rotation={[0.35, 0, 0]} scale={[1, 1, 0.6]} outline={0.01}>
            <cylinderGeometry args={[0.18, 0.18, 0.02, 20, 1, false, -Math.PI / 2, Math.PI]} />
          </T>
          <T color="#D4A93A" position={[0, HEAD_R * 0.8 + 0.01, 0.255]} outline={0.006}>
            <sphereGeometry args={[0.035, 10, 8]} />
          </T>
        </group>
      );
    case "knit-cap":
      return (
        <group rotation={[-0.25, 0, 0.12]}>
          <Cap color="#9A5A4E" theta={0.4} />
          <T color="#9A5A4E" position={[0.06, HEAD_R * 1.05, -0.08]} rotation={[-0.6, 0, -0.5]} outline={0.012}>
            <coneGeometry args={[0.12, 0.26, 12]} />
          </T>
        </group>
      );
    case "panama":
      return (
        <group rotation={[-0.1, 0, 0]}>
          <T color="#EDE3C8" position={[0, HEAD_R * 0.8, 0]} outline={0.014}>
            <cylinderGeometry args={[0.4, 0.4, 0.02, 30]} />
          </T>
          <T color="#EDE3C8" position={[0, HEAD_R * 0.8 + 0.07, 0]} outline={0.014}>
            <cylinderGeometry args={[0.18, 0.21, 0.14, 24]} />
          </T>
          <T color="#3A2A1A" position={[0, HEAD_R * 0.8 + 0.03, 0]} outline={false}>
            <cylinderGeometry args={[0.212, 0.212, 0.04, 24]} />
          </T>
        </group>
      );
    default:
      return null; // bald
  }
};

const Outfit: React.FC<{ look: Look }> = ({ look }) => {
  const front = 0.215;
  switch (look.outfit) {
    case "lavender-cardigan":
      return (
        <group>
          <T color="#F4EEE2" position={[0, 0.36, front]} outline={false}>
            <boxGeometry args={[0.1, 0.34, 0.02]} />
          </T>
          {[0.46, 0.36, 0.26].map((y) => (
            <Ink key={y} position={[0.07, y, front + 0.02]}>
              <circleGeometry args={[0.016, 10]} />
            </Ink>
          ))}
        </group>
      );
    case "white-shirt-black-vest":
      return (
        <group>
          <T color="#26262B" position={[0, 0.3, front - 0.01]} outline={0.01}>
            <boxGeometry args={[0.3, 0.34, 0.04]} />
          </T>
          <T color="#C0392B" position={[0, 0.53, front + 0.02]} rotation={[0, 0, Math.PI / 2]} outline={0.008}>
            <coneGeometry args={[0.035, 0.12, 3]} />
          </T>
        </group>
      );
    case "grey-suit-boutonniere":
      return (
        <group>
          <T color="#FFFFFF" position={[0, 0.5, front]} rotation={[0, 0, Math.PI]} outline={false}>
            <coneGeometry args={[0.07, 0.14, 3]} />
          </T>
          <T color="#F06D9C" position={[0.12, 0.45, front + 0.02]} outline={0.008}>
            <sphereGeometry args={[0.035, 10, 8]} />
          </T>
        </group>
      );
    case "bride-dress":
      return (
        <group>
          {/* flared skirt over the hips, pink sash and a short veil */}
          <T color={look.body} position={[0, 0.12, 0]} outline={0.02}>
            <coneGeometry args={[0.36, 0.36, 24, 1, true]} />
          </T>
          <T color="#F7A6C3" position={[0, 0.32, 0]} outline={0.01}>
            <cylinderGeometry args={[0.225, 0.225, 0.06, 24]} />
          </T>
        </group>
      );
    default:
      return null;
  }
};

/** Body extras, from a comma-separated `accessory` list. `tailLag` (v2) swings the scarf tail about its top. */
const BodyExtras: React.FC<{ list: string[]; tailLag?: number }> = ({ list, tailLag }) => {
  const front = 0.215;
  const tailTop: Vec3 = [0.08, 0.54, front + 0.02];
  return (
    <group>
      {list.includes("scarf") ? (
        <group>
          <T color="#E8413C" position={[0, 0.56, 0]} outline={0.012}>
            <torusGeometry args={[0.17, 0.05, 10, 24]} />
          </T>
          {tailLag === undefined ? (
            <T color="#E8413C" position={[0.08, 0.42, front + 0.02]} rotation={[0, 0, 0.15]} outline={0.01}>
              <boxGeometry args={[0.08, 0.24, 0.04]} />
            </T>
          ) : (
            <group position={tailTop} rotation={[tailLag, 0, 0]}>
              <T color="#E8413C" position={[0.08 - tailTop[0], 0.42 - tailTop[1], front + 0.02 - tailTop[2]]} rotation={[0, 0, 0.15]} outline={0.01}>
                <boxGeometry args={[0.08, 0.24, 0.04]} />
              </T>
            </group>
          )}
        </group>
      ) : null}
      {list.filter((a) => a.startsWith("apron-")).map((a) => (
        <T key={a} color={a === "apron-white" ? "#F4F1EA" : "#6B4A2E"} position={[0, 0.2, front - 0.01]} outline={0.01}>
          <boxGeometry args={[0.3, 0.36, 0.03]} />
        </T>
      ))}
      {list.includes("gold-buttons")
        ? [0.42, 0.3].map((y) => (
          <T key={y} color="#D4A93A" position={[0, y, front + 0.01]} outline={0.006}>
            <sphereGeometry args={[0.025, 10, 8]} />
          </T>
        ))
        : null}
    </group>
  );
};

/** Big droopy mustache under the nose line. */
const Mustache: React.FC = () => (
  <group position={[0, -0.06, HEAD_R - 0.01]}>
    {[1, -1].map((s) => (
      <T key={s} color="#9A9AA2" position={[s * 0.055, 0, 0]} rotation={[0, 0, s * -0.35]} scale={[1.6, 0.6, 0.6]} outline={0.008}>
        <sphereGeometry args={[0.045, 12, 8]} />
      </T>
    ))}
  </group>
);

const Glasses: React.FC = () => (
  <group>
    {[1, -1].map((s) => (
      <Ink key={s} position={[s * 0.11, 0.04, Math.sqrt(HEAD_R ** 2 - 0.11 ** 2 - 0.04 ** 2) + 0.012]}
        rotation={[0, s * 0.32, 0]}>
        <torusGeometry args={[0.062, 0.008, 6, 24]} />
      </Ink>
    ))}
    <Ink position={[0, 0.05, HEAD_R + 0.004]}>
      <boxGeometry args={[0.07, 0.012, 0.01]} />
    </Ink>
  </group>
);

/**
 * Rubber-hose limb: a tube from `a` to `b` that passes through `mid`.
 * shortcut: geometry is rebuilt whenever the points move (fine at 6 limbs per character); cache by pose if renders get slow.
 */
const Hose: React.FC<{ a: Vec3; mid: Vec3; b: Vec3; r: number }> = ({ a, mid, b, r }) => {
  const key = [...a, ...mid, ...b, r].map((n) => n.toFixed(4)).join(",");
  const geo = useMemo(() => {
    const [A, M, B] = [a, mid, b].map((v) => new THREE.Vector3(...v));
    // Quadratic control point that makes the curve pass through `mid` at its halfway point.
    const C = M.clone().multiplyScalar(2).sub(A.clone().add(B).multiplyScalar(0.5));
    return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(A, C, B), 16, r, 8);
    // `key` holds every number the curve is built from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <Ink geometry={geo} />;
};

/** How far elbows bow out and back from the straight shoulder–hand line. */
const ELBOW_OUT = 0.05;
const ELBOW_BACK = 0.06;

/**
 * `bend` swings the forearm forward about the elbow (radians); 0 is the straight-through hose.
 * `twist` turns that bend plane about the arm's own axis; `stretch` lengthens the rubber hose.
 * `lift` raises the shoulder (breathing, shrugs).
 */
const Arm: React.FC<{
  side: 1 | -1; rot: Euler3; slot?: React.ReactNode; bend?: number; twist?: number; stretch?: number; lift?: number;
}> = ({ side, rot, slot, bend = 0, twist = 0, stretch = 1, lift = 0 }) => {
  const half = (ARM_LEN / 2) * stretch;
  const elbow: Vec3 = [side * ELBOW_OUT, -half, -ELBOW_BACK];
  const [c, s] = [Math.cos(-bend), Math.sin(-bend)];
  // Point `d` past the hand along the forearm, rotated about the elbow's x axis.
  const along = (d: number): Vec3 => {
    const v: Vec3 = [-side * ELBOW_OUT, -half - d, ELBOW_BACK];
    return [elbow[0] + v[0], elbow[1] + v[1] * c - v[2] * s, elbow[2] + v[1] * s + v[2] * c];
  };
  const limb = (
    <>
      <Hose a={[0, 0, 0]} mid={elbow} b={along(0)} r={LIMB_R} />
      <T color={SKIN} position={along(0.03)} outline={0.012}>
        <sphereGeometry args={[0.065, 14, 10]} />
      </T>
      {slot ? (
        // Counter-rotate so held props stay roughly upright whatever the arm does.
        <group position={along(0.07)} rotation={[-rot[0] + bend, 0, -rot[2]]}>
          {slot}
        </group>
      ) : null}
    </>
  );
  return (
    <group position={[side * 0.235, 0.46 + lift, 0]} rotation={rot}>
      {twist ? <group rotation={[0, twist, 0]}>{limb}</group> : limb}
    </group>
  );
};

/** Hair styles that are hats: they get follow-through; hair caps stay glued to the skull. */
const HATS = new Set(["top-hat", "flat-cap", "peaked-cap", "knit-cap", "panama"]);
/** Hat pivot: the crown of the head. */
const HAT_PIVOT: Vec3 = [0, HEAD_R * 0.8, 0];

/** Thigh swings forward with `sit`; the shin keeps hanging at `swing`, so seated knees bend and feet reach the floor. */
const Leg: React.FC<{ side: 1 | -1; swing: number; sit: number }> = ({ side, swing, sit }) => {
  const half = LEG_LEN / 2;
  const thigh = swing - (Math.PI / 2) * sit;
  // Rotating (0, -1, 0) by angle t about x gives (0, -cos t, -sin t); negative angles point forward (+z).
  const knee: Vec3 = [0, -half * Math.cos(thigh), -half * Math.sin(thigh) + 0.015];
  const foot: Vec3 = [0, knee[1] - half * Math.cos(swing), knee[2] - 0.015 - half * Math.sin(swing)];
  return (
    <group position={[side * 0.1, 0, 0]}>
      <Hose a={[0, 0, 0]} mid={knee} b={foot} r={LIMB_R * 1.1} />
      <group position={foot} rotation={[swing, 0, 0]}>
        <T color="#2A2A30" position={[0, 0, 0.04]} scale={[1, 0.7, 1.5]} outline={0.01}>
          <sphereGeometry args={[0.06, 12, 10]} />
        </T>
      </group>
    </group>
  );
};

export interface CharacterProps {
  def: CharacterDef;
  pos: Vec3;
  face: FaceName;
  action: string;
  frame: number;
  duration: number;
  mouthOpen?: number;
  leftHand?: React.ReactNode;
  rightHand?: React.ReactNode;
  /** Extra items on top of the head (party hat…). */
  headwear?: React.ReactNode;
  /** Items carried in front of the body, moving and turning with it (cart, cake). */
  front?: React.ReactNode;
  /** Extra facing (radians) and offset (world units) from the episode layout. */
  facing?: number;
  offset?: Vec3;
  /** Motion v2 channels (useCharacterMotion). Replaces the action pose; without it the character renders as v1. */
  motion?: CharacterMotion;
}

export const Character: React.FC<CharacterProps> = ({
  def, pos, face, action, frame, duration, mouthOpen = 0, leftHand, rightHand, headwear, front,
  facing = 0, offset = [0, 0, 0], motion: m,
}) => {
  const look = resolveLook(def);
  const extras = look.accessory?.split(",") ?? [];
  const p = m?.pose ?? poseFor(action, frame, duration);
  const hatLag = HATS.has(look.hair) && m ? m.hatLag : undefined;
  const hipDrop = poseDrop(p);
  const legSwing = (side: number) => (side === 1 ? p.legL : p.legR) + 1.3 * p.kneel;

  return (
    <group
      position={[pos[0] * STAGE + offset[0] + p.x, pos[1] + offset[1] + p.y, pos[2] * STAGE + offset[2] + p.z]}
      rotation={[0, facing + p.rotY, 0]}>
      {front}
      <group position={[0, HIP_Y - hipDrop, 0]} rotation={[p.lean, 0, p.tilt]} scale={[1, p.squash, 1]}>
        <Leg side={1} swing={legSwing(1)} sit={p.sit} />
        <Leg side={-1} swing={legSwing(-1)} sit={p.sit} />
        <T color={look.body} position={[0, 0.3, 0]} scale={m ? [m.chest[0], m.chest[1], m.chest[0]] : 1} outline={0.02}>
          <capsuleGeometry args={[0.22, 0.2, 8, 20]} />
        </T>
        <Outfit look={look} />
        <BodyExtras list={extras} tailLag={m?.tailLag} />
        <Arm side={1} rot={p.armL} slot={leftHand} bend={m?.bendL} twist={m?.twistL} stretch={m?.stretchL} lift={m?.shoulderL} />
        <Arm side={-1} rot={p.armR} slot={rightHand} bend={m?.bendR} twist={m?.twistR} stretch={m?.stretchR} lift={m?.shoulderR} />
        <group position={[0, 0.6, 0]} rotation={p.head}>
          <group position={[0, 0.32, 0]}>
            <T color={SKIN} outline={0.022}>
              <sphereGeometry args={[HEAD_R, 40, 28]} />
            </T>
            <Face face={m?.face ?? face} mouthOpen={mouthOpen} frame={frame}
              faceFrom={m?.faceFrom} faceT={m?.faceT} eyes={m?.eyes} blink={m?.blink} />
            {hatLag ? (
              // Hat pivots on the crown and lags behind the head.
              <group position={HAT_PIVOT} rotation={hatLag}>
                <group position={[-HAT_PIVOT[0], -HAT_PIVOT[1], -HAT_PIVOT[2]]}>
                  <Hair style={look.hair} />
                </group>
              </group>
            ) : (
              <Hair style={look.hair} />
            )}
            {extras.includes("small-glasses") ? <Glasses /> : null}
            {extras.includes("mustache") ? <Mustache /> : null}
            {headwear}
          </group>
        </group>
      </group>
    </group>
  );
};

/** How far the head sits below standing height in this pose (sitting, kneeling, leaning). */
export const poseDrop = (p: { sit: number; kneel: number }) => 0.22 * p.sit + 0.36 * p.kneel;

/** World position of a character's mark (feet) and head, including layout offsets. */
export const markWorld = (pos: Vec3, offset: Vec3 = [0, 0, 0]): Vec3 => [
  pos[0] * STAGE + offset[0],
  pos[1] + offset[1],
  pos[2] * STAGE + offset[2],
];
export const headWorld = (pos: Vec3, offset: Vec3 = [0, 0, 0], drop = 0): Vec3 => {
  const m = markWorld(pos, offset);
  return [m[0], m[1] + HEAD_CENTER_Y - drop, m[2]];
};
