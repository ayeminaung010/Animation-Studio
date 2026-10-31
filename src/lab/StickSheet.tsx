// Every 2D stickman pose (top) and face (bottom) on one frame: a quick look-check for src/stick.
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { FACES } from "../lib/shots";
import { POSES, type PoseName } from "../stick/poses";
import { Stickman } from "../stick/Stickman";
import { ROOM } from "../stick/style";

export const StickSheet: React.FC = () => {
  const f = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const names = Object.keys(POSES) as PoseName[];
  return (
    <AbsoluteFill style={{ backgroundColor: ROOM.agent }}>
      <svg width={width} height={height}>
        {names.map((n, i) => (
          <Stickman key={n} x={135 + (i % 4) * 270} y={400 + Math.floor(i / 4) * 400} scale={0.55} who={i % 2 ? "agent" : "grandpa"}
            pose={POSES[n](f, fps)} face="neutral" mouth={0} />
        ))}
        {FACES.map((face, i) => (
          <Stickman key={face} x={108 + (i % 5) * 216} y={i < 5 ? 1560 : 1850} scale={0.42} who={i % 2 ? "agent" : "grandpa"}
            pose={POSES.idle(f, fps)} face={face} mouth={0} />
        ))}
      </svg>
    </AbsoluteFill>
  );
};
