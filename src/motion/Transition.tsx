// Scene transitions (motion v2), done in Remotion over the rendered take.
// Each type has an OUT half (last frames of the outgoing take) and an IN half (first frames of the
// incoming one); the hard switch between them is hidden under white, blur, black or a fast pan.
import React from "react";
import { AbsoluteFill, Easing, interpolate } from "remotion";

export const TRANSITION_TYPES = ["FLYOVER", "THROUGH", "IRIS", "MATCH", "FLASH", "WHIP", "CUT"] as const;
export type TransitionType = (typeof TRANSITION_TYPES)[number];

/** Frames of the [out, in] halves. MATCH and CUT are hard cuts. */
export const TRANSITION_FRAMES: Record<TransitionType, [number, number]> = {
  FLYOVER: [6, 9],
  THROUGH: [6, 8],
  IRIS: [9, 9],
  MATCH: [0, 0],
  FLASH: [2, 5],
  WHIP: [4, 6],
  CUT: [0, 0],
};

/** v1 shot-list transition names. */
export const fromV1Transition = (t: string): TransitionType =>
  ({ cut: "CUT", whip: "WHIP", flash: "FLASH", "match-cut": "MATCH" } as Record<string, TransitionType>)[t] ?? "CUT";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Look of one half. `t` runs 0 → 1 towards the switch for OUT, and 1 → 0 away from it for IN. */
const half = (type: TransitionType, t: number, dir: 1 | -1): { style: React.CSSProperties; flash: number } => {
  switch (type) {
    case "FLASH":
      return { style: {}, flash: t };
    case "WHIP":
      return { style: { translate: `${dir * -60 * t}% 0`, filter: `blur(${24 * t}px)` }, flash: 0 };
    case "FLYOVER":
      // A fast tilt up over the set and down into the next area.
      return { style: { translate: `0 ${dir * 70 * t}%`, filter: `blur(${18 * t}px)` }, flash: 0 };
    case "THROUGH":
      return { style: { scale: 1 + (dir === 1 ? 0.9 : 0.5) * t, filter: `blur(${14 * t}px) brightness(${1 + 0.5 * t})` }, flash: 0 };
    case "IRIS":
      return { style: { clipPath: `circle(${80 * (1 - t)}% at 50% 45%)` }, flash: 0 };
    default:
      return { style: {}, flash: 0 };
  }
};

export const TransitionWrap: React.FC<{
  in?: TransitionType;
  out?: TransitionType;
  /** Frame inside the take and the take's length. */
  frame: number;
  duration: number;
  children: React.ReactNode;
}> = ({ in: tin = "CUT", out: tout = "CUT", frame, duration, children }) => {
  const nIn = TRANSITION_FRAMES[tin][1];
  const nOut = TRANSITION_FRAMES[tout][0];
  const inT = nIn ? interpolate(frame, [0, nIn], [1, 0], { ...clamp, easing: Easing.out(Easing.cubic) }) : 0;
  const outT = nOut ? interpolate(frame, [duration - nOut, duration - 1], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) }) : 0;
  const active = outT > 0 ? half(tout, outT, 1) : inT > 0 ? half(tin, inT, -1) : { style: {}, flash: 0 };
  return (
    <AbsoluteFill>
      <AbsoluteFill style={active.style}>{children}</AbsoluteFill>
      {active.flash > 0 ? <AbsoluteFill style={{ backgroundColor: "white", opacity: active.flash }} /> : null}
    </AbsoluteFill>
  );
};
