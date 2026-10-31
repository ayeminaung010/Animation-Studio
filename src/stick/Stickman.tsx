// One flat 2D stickman: white-filled round head, stick torso, two-segment limbs, a simple face.
// Accents: Grandpa gets grey hair, round glasses and a phone; the Agent a blue headset.
import React from "react";
import type { FaceName } from "../lib/shots";
import { BODY } from "./geometry";
import type { Pose } from "./poses";
import { HAIR, HEADSET, INK, PAPER, STROKE } from "./style";

export type Who = "grandpa" | "agent";

const dir = (a: number, len: number) => [Math.sin(a) * len, Math.cos(a) * len] as const;

/** Two-segment limb from (x, y): absolute angles, returns the end point too. */
const limb = (x: number, y: number, [a, b]: [number, number], l1: number, l2: number) => {
  const [dx, dy] = dir(a, l1);
  const [ex, ey] = dir(b, l2);
  const end = { x: x + dx + ex, y: y + dy + ey };
  return { d: `M${x} ${y} L${x + dx} ${y + dy} L${end.x} ${end.y}`, end };
};

interface FaceSpec {
  eyeH: number;
  /** Brow tilt: + = inner ends up (worried), − = inner ends down (angry). */
  brow: number;
  browY: number;
  mouth: "flat" | "smile" | "frown" | "smirk" | "open";
  squint?: boolean;
  tears?: boolean;
}

const FACES: Record<FaceName, FaceSpec> = {
  neutral: { eyeH: 9, brow: 0, browY: 0, mouth: "flat" },
  happy: { eyeH: 7, brow: -0.05, browY: -2, mouth: "smile", squint: true },
  sad: { eyeH: 8, brow: 0.35, browY: 2, mouth: "frown" },
  smug: { eyeH: 5, brow: -0.15, browY: 0, mouth: "smirk" },
  shocked: { eyeH: 14, brow: 0.1, browY: -10, mouth: "open" },
  scared: { eyeH: 13, brow: 0.4, browY: -6, mouth: "open" },
  angry: { eyeH: 8, brow: -0.45, browY: 4, mouth: "frown" },
  suspicious: { eyeH: 5, brow: -0.25, browY: 2, mouth: "flat" },
  crying: { eyeH: 6, brow: 0.4, browY: 2, mouth: "frown", tears: true },
  blank: { eyeH: 9, brow: 0, browY: 4, mouth: "flat" },
};

const Face: React.FC<{ face: FaceName; mouth: number; glasses: boolean }> = ({ face, mouth, glasses }) => {
  const s = FACES[face];
  const eyeX = 24;
  const eyeY = -8;
  const brow = (side: 1 | -1) => {
    const x = side * eyeX;
    const lift = s.brow * 14;
    // inner end is toward the centre (x → 0)
    return `M${x - side * 14} ${eyeY - 24 + s.browY - lift} L${x + side * 14} ${eyeY - 24 + s.browY + lift}`;
  };
  const my = 30;
  const open = Math.max(mouth, s.mouth === "open" ? 0.7 : 0);
  let m: React.ReactNode;
  if (open > 0.05) m = <ellipse cx={0} cy={my} rx={14 + 4 * open} ry={4 + 16 * open} fill={INK} />;
  else if (s.mouth === "smile") m = <path d={`M-20 ${my - 4} Q0 ${my + 16} 20 ${my - 4}`} />;
  else if (s.mouth === "frown") m = <path d={`M-18 ${my + 8} Q0 ${my - 8} 18 ${my + 8}`} />;
  else if (s.mouth === "smirk") m = <path d={`M-14 ${my + 2} Q8 ${my + 6} 20 ${my - 6}`} />;
  else m = <path d={`M-16 ${my} L16 ${my}`} />;
  return (
    <g stroke={INK} strokeWidth={STROKE * 0.55} strokeLinecap="round" fill="none">
      {[-1, 1].map((side) =>
        s.squint ? (
          <path key={side} d={`M${side * eyeX - 9} ${eyeY + 2} Q${side * eyeX} ${eyeY - 8} ${side * eyeX + 9} ${eyeY + 2}`} />
        ) : (
          <ellipse key={side} cx={side * eyeX} cy={eyeY} rx={6} ry={s.eyeH} fill={INK} stroke="none" />
        ),
      )}
      <path d={brow(-1)} />
      <path d={brow(1)} />
      {glasses ? (
        <g strokeWidth={STROKE * 0.4}>
          <circle cx={-eyeX} cy={eyeY} r={19} />
          <circle cx={eyeX} cy={eyeY} r={19} />
          <path d={`M${-eyeX + 19} ${eyeY} L${eyeX - 19} ${eyeY}`} />
        </g>
      ) : null}
      {m}
      {s.tears ? <path d={`M${eyeX} ${eyeY + 14} q-4 14 0 22`} stroke="#5AA9E6" /> : null}
    </g>
  );
};

export const Stickman: React.FC<{
  x: number;
  y: number;
  scale: number;
  who: Who;
  pose: Pose;
  face: FaceName;
  /** 0..1 from the voice when this character is the one talking. */
  mouth: number;
  flip?: boolean;
}> = ({ x, y, scale, who, pose, face, mouth, flip }) => {
  const shoulderY = -BODY.torso + 14;
  const neckY = -BODY.torso;
  const headY = neckY - BODY.neck - BODY.headR;
  const armR = limb(0, shoulderY, pose.armR, BODY.upperArm, BODY.foreArm);
  const armL = limb(0, shoulderY, pose.armL, BODY.upperArm, BODY.foreArm);
  const legR = limb(0, 0, pose.legR, BODY.thigh, BODY.shin);
  const legL = limb(0, 0, pose.legL, BODY.thigh, BODY.shin);
  const r = BODY.headR;
  return (
    <g transform={`translate(${x} ${y - pose.lift * scale}) scale(${flip ? -scale : scale} ${scale})`}>
      <g stroke={INK} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d={legR.d} />
        <path d={legL.d} />
        <g transform={`rotate(${(pose.lean * 180) / Math.PI})`}>
          <path d={`M0 0 L0 ${neckY}`} />
          <path d={armR.d} />
          <path d={armL.d} />
          <g transform={`rotate(${(pose.head * 180) / Math.PI} 0 ${neckY}) translate(0 ${headY})`}>
            <circle r={r} fill={PAPER} />
            {who === "grandpa" ? (
              <path d={`M${-r - 6} -4 A${r + 6} ${r + 6} 0 0 1 ${-r * 0.35} ${-r - 2} M${r * 0.35} ${-r - 2} A${r + 6} ${r + 6} 0 0 1 ${r + 6} -4`} stroke={HAIR} strokeWidth={STROKE * 0.9} />
            ) : (
              <g stroke={HEADSET} strokeWidth={STROKE * 0.75}>
                <path d={`M${-r - 8} 4 A${r + 8} ${r + 8} 0 0 1 ${r + 8} 4`} />
                <circle cx={-r - 6} cy={8} r={12} fill={HEADSET} />
                <path d={`M${-r - 4} 18 Q${-r + 6} 44 -22 36`} strokeWidth={STROKE * 0.4} />
              </g>
            )}
            <Face face={face} mouth={mouth} glasses={who === "grandpa"} />
          </g>
          {/* Phone on top of the head so it reads at the ear. */}
          {who === "grandpa" ? (
            <rect x={armR.end.x - 16} y={armR.end.y - 30} width={32} height={60} rx={8} fill={INK} transform={`rotate(-12 ${armR.end.x} ${armR.end.y})`} />
          ) : null}
        </g>
      </g>
    </g>
  );
};
