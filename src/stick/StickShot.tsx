// One shot of a 2D stickman episode: rooms, props, the two stickmen, mouths from the voice.
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useMouth } from "../components/Shot";
import { resolveAt, type ShotTiming } from "../lib/timing";
import { BODY, H, W, talkerAt, type StickLayout } from "./geometry";
import { Panel, sideAt } from "./Panel";
import { pose } from "./poses";
import { stickProp } from "./props";
import { Stickman, type Who } from "./Stickman";
import { INK } from "./style";

export const StickShot: React.FC<{ timing: ShotTiming; layout: StickLayout; voice: string }> = ({ timing, layout, voice }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { shot } = timing;
  const mouth = useMouth(voice, timing.from + f, true);
  const talker = talkerAt(timing.words, f);
  const zoom = interpolate(f, [0, Math.max(1, timing.durationInFrames)], [1, 1.04], { extrapolateRight: "clamp" });

  const content: Record<Who, React.ReactNode[]> = { grandpa: [], agent: [] };
  (layout.props ?? []).forEach((p, i) => {
    const Prop = stickProp(p.name);
    const at = p.startAt === undefined ? 0 : resolveAt(p.startAt, timing);
    if (f < at) return;
    const pop = p.startAt === undefined ? 1 : spring({ frame: f - at, fps, config: { damping: 12 } });
    content[sideAt(layout.panel, p.y)].push(
      <g key={`p${i}`} transform={`translate(${p.x} ${p.y}) scale(${(p.scale ?? 1) * pop})`}>
        <Prop f={f} fps={fps} state={p.state} />
      </g>,
    );
  });
  for (const who of ["grandpa", "agent"] as const) {
    const at = layout[who];
    if (!at) continue;
    const c = shot.characters.find((ch) => ch.id === who);
    if (!c) throw new Error(`shot ${shot.id}: LAYOUT places ${who} but 03-shots.json has no such character`);
    const floor = at.y + (BODY.thigh + BODY.shin) * at.scale;
    const room = content[sideAt(layout.panel, at.y)];
    room.unshift(<path key={`floor-${who}`} d={`M0 ${floor} L${W} ${floor}`} stroke={INK} strokeOpacity={0.18} strokeWidth={6} />);
    room.push(
      <Stickman key={who} x={at.x} y={at.y} scale={at.scale} flip={at.flip} who={who} pose={pose(c.action)(f, fps)} face={c.face}
        mouth={talker === who ? mouth : 0} />,
    );
  }
  return (
    <svg width={W} height={H} style={{ position: "absolute" }}>
      <Panel panel={layout.panel} zoom={zoom} content={content} />
    </svg>
  );
};
