// Renders one shot from the shot list: set, characters, props, lighting, camera,
// emphasis punch and the in-transition. Animation restarts at frame 0 in every shot.
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { ThreeCanvas } from "@remotion/three";
import React from "react";
import { AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { CharacterDef, Vec3 } from "../lib/shots";
import { shotPerformances } from "../motion/fromShot";
import { characterMotion } from "../motion/useCharacterMotion";
import { resolveAt, type ShotTiming, type StartAt } from "../lib/timing";
import { propComponent } from "../props";
import { setDef } from "../sets";
import { CameraRig, type CameraSpec } from "./CameraRig";
import { poseFor } from "./actions";
import { Character, headWorld, markWorld, poseDrop } from "./Character";
import { BACKGROUND, Lighting } from "./Lighting";

export type MotionVersion = "v1" | "v2";

export interface Placement {
  /** World position, or an offset inside the slot when `hand`/`head`/`front` is set. */
  at?: Vec3;
  rot?: Vec3;
  scale?: number;
  hand?: "L" | "R";
  head?: boolean;
  front?: boolean;
  /** Character that holds/wears/carries the prop. */
  char?: string;
  /** Offset from the prop position to where the camera should aim. */
  focus?: Vec3;
  /** Delay the prop's own animation: a frame, or a spoken word in this shot (it starts on that word). */
  startAt?: StartAt;
}


export interface ShotLayout {
  /** Placement per prop name; the i-th occurrence in the shot list uses the i-th entry. */
  props?: Record<string, Placement[]>;
  /** Props not in the shot list that the scene still needs (a phone in a hand…). */
  extra?: { name: string; place: Placement }[];
  chars?: Record<string, { facing?: number; offset?: Vec3 }>;
  /** Override the camera's aim point (world). */
  target?: Vec3;
  /** Multiply the framing heights (for tiny or huge subjects). */
  frameScale?: number;
  azimuth?: number;
  elevation?: number;
  bulb?: Vec3;
}

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const add = (a: Vec3, b: Vec3 = [0, 0, 0]): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const rotY = (v: Vec3, a: number): Vec3 => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];

/** Mouth opening from the voice loudness at this frame (only for characters marked speaking). */
const useMouth = (voice: string, globalFrame: number, enabled: boolean) => {
  const { fps } = useVideoConfig();
  const audio = useAudioData(staticFile(voice));
  if (!enabled || !audio) return 0;
  const bins = visualizeAudio({ fps, frame: globalFrame, audioData: audio, numberOfSamples: 16 });
  const level = bins.slice(1, 8).reduce((a, b) => a + b, 0) / 7;
  return Math.min(1, level * 6);
};

export const ShotView: React.FC<{
  timing: ShotTiming;
  characters: Record<string, CharacterDef>;
  layout: ShotLayout;
  /** Path of the voice file inside public/ (drives speaking mouths). */
  voice: string;
  /** "v2" layers motion-kit performances (idle, gaze, blinks, follow-through) over the actions. */
  motion?: MotionVersion;
}> = ({ timing, characters, layout, voice, motion = "v1" }) => {
  const f = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const { shot, durationInFrames: d, emphasisFrame } = timing;
  const set = setDef(shot.set);
  const bg = set.sky?.[shot.lighting] ?? BACKGROUND[shot.lighting];
  const speaking = Boolean(shot.lines) || shot.characters.some((c) => c.speaking);
  const mouth = useMouth(voice, timing.from + f, speaking);
  // With dialogue lines, only the speaker of the latest started word moves their mouth.
  const talker = timing.words.filter((w) => w.start <= f).pop()?.speaker;
  const talks = (c: { id: string; speaking?: boolean }) => (shot.lines ? talker === c.id : c.speaking);
  const chars = layout.chars ?? {};
  const perfs = motion === "v2" ? shotPerformances(timing, layout, fps) : null;

  // Resolve every prop occurrence to a placement.
  const seen: Record<string, number> = {};
  const placed = [
    ...shot.props.map((name) => {
      const i = seen[name] ?? 0;
      seen[name] = i + 1;
      const list = layout.props?.[name] ?? [];
      return { name, place: list[i] ?? list[list.length - 1] ?? {} };
    }),
    ...(layout.extra ?? []),
  ];

  const propNode = (name: string, p: Placement, key: string) => {
    const C = propComponent(name);
    const delay = resolveAt(p.startAt, timing);
    return (
      <group key={key} position={p.at ?? [0, 0, 0]} rotation={p.rot ?? [0, 0, 0]} scale={p.scale ?? 1}>
        <C f={f - delay} d={d} fps={fps} />
      </group>
    );
  };

  const slot = (charId: string, kind: "L" | "R" | "head" | "front") =>
    placed
      .map((x, i) => ({ ...x, i }))
      .filter(({ place }) =>
        place.char === charId &&
        (kind === "head" ? place.head : kind === "front" ? place.front : place.hand === kind),
      )
      .map(({ name, place, i }) => propNode(name, place, `${name}-${i}`));

  const world = placed
    .map((x, i) => ({ ...x, i }))
    .filter(({ place }) => !place.char)
    .map(({ name, place, i }) => propNode(name, place, `${name}-${i}`));

  // Camera target: a layout override, a character in the shot, or a placed prop.
  const tName = shot.camera.target;
  const tChar = shot.characters.find((c) => c.id === tName);
  let target: Vec3 = [0, 1.2, 0];
  let isCharacter = false;
  if (layout.target) {
    target = layout.target;
  } else if (tChar) {
    // Aim at the head where the pose actually puts it (kneeling, sitting, leaning).
    const pose = poseFor(tChar.action, f, d);
    target = headWorld(tChar.pos, chars[tChar.id]?.offset, poseDrop(pose) + Math.max(0, pose.lean) * 0.55);
    isCharacter = true;
  } else {
    const p = placed.find((x) => x.name === tName)?.place;
    if (p?.char) {
      const c = shot.characters.find((x) => x.id === p.char);
      if (c) {
        const facing = chars[c.id]?.facing ?? 0;
        target = add(add(markWorld(c.pos, chars[c.id]?.offset), rotY(p.at ?? [0, 0, 0], facing)), p.focus);
      }
    } else if (p) {
      target = add(p.at ?? [0, 0, 0], p.focus);
    }
  }

  const spec: CameraSpec = {
    move: shot.camera.move,
    from: shot.camera.from,
    to: shot.camera.to,
    target,
    isCharacter,
    azimuth: layout.azimuth,
    elevation: layout.elevation,
    frameScale: layout.frameScale,
  };

  const SetC = set.component;
  const whip = shot.transition_in === "whip";
  const flash = shot.transition_in === "flash";

  return (
    <AbsoluteFill style={{ backgroundColor: bg, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          // Emphasis punch: 1.0 → 1.06 over 4 frames on the emphasis word.
          scale: emphasisFrame === null ? 1 : interpolate(f, [emphasisFrame, emphasisFrame + 4], [1, 1.06], { ...clamp, easing: Easing.out(Easing.quad) }),
          translate: whip ? interpolate(f, [0, 6], ["-260px 0px", "0px 0px"], { ...clamp, easing: Easing.out(Easing.cubic) }) : undefined,
          filter: whip ? `blur(${interpolate(f, [0, 6], [18, 0], clamp)}px)` : undefined,
        }}
      >
        <ThreeCanvas width={width} height={height} gl={{ antialias: true }}>
          <color attach="background" args={[bg]} />
          <Lighting name={shot.lighting} bulb={layout.bulb} />
          <CameraRig spec={spec} frame={f} duration={d} />
          {/* No inner <Suspense>: ThreeCanvas's own boundary holds the frame until textures load. */}
          <SetC f={f} />
          {shot.characters.map((c) => {
            const m = perfs ? characterMotion(f, fps, perfs[c.id]) : undefined;
            return (
            <Character
              key={c.id}
              def={characters[c.id]}
              pos={c.pos}
              face={c.face}
              action={c.action}
              frame={f}
              duration={d}
              mouthOpen={(m ? m.speaking : talks(c)) ? mouth : 0}
              motion={m}
              facing={chars[c.id]?.facing}
              offset={chars[c.id]?.offset}
              leftHand={slot(c.id, "L")}
              rightHand={slot(c.id, "R")}
              headwear={slot(c.id, "head")}
              front={slot(c.id, "front")}
            />
            );
          })}
          {world}
        </ThreeCanvas>
      </AbsoluteFill>
      {flash ? (
        <AbsoluteFill style={{ backgroundColor: "white", opacity: interpolate(f, [0, 6], [0.9, 0], clamp) }} />
      ) : null}
    </AbsoluteFill>
  );
};
