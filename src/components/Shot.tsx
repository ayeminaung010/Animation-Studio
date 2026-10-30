// Renders one shot from the shot list: set, characters, props, lighting, camera,
// emphasis punch and the in-transition. Animation restarts at frame 0 in every shot.
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { ThreeCanvas } from "@remotion/three";
import React from "react";
import { AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { CharacterDef } from "../lib/shots";
import { cameraSpecAt, placementsFor, type Placement, type ShotLayout } from "../lib/staging";
import { resolveAt, type ShotTiming } from "../lib/timing";
import { propComponent } from "../props";
import { setDef } from "../sets";
import { CameraRig, type CameraSpec } from "./CameraRig";
import { Character } from "./Character";
import { BACKGROUND, Lighting } from "./Lighting";

export type MotionVersion = "v1" | "v2";

export type { Placement, ShotLayout } from "../lib/staging";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Mouth opening from the voice loudness at this frame (only for characters marked speaking). */
export const useMouth = (voice: string, globalFrame: number, enabled: boolean) => {
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
}> = ({ timing, characters, layout, voice }) => {
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

  const placed = placementsFor(shot, layout);

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

  const specAt = (fr: number): CameraSpec => cameraSpecAt(shot, layout, placed, fr, d);

  const SetC = set.component;
  const whip = shot.transition_in === "whip";
  const flash = shot.transition_in === "flash";

  const scene = (
    <ThreeCanvas width={width} height={height} gl={{ antialias: true }}>
      <color attach="background" args={[bg]} />
      <Lighting name={shot.lighting} bulb={layout.bulb} />
      <CameraRig spec={specAt(f)} frame={f} duration={d} />
      {/* No inner <Suspense>: ThreeCanvas's own boundary holds the frame until textures load. */}
      <SetC f={f} />
      {shot.characters.map((c) => (
        <Character
          key={c.id}
          def={characters[c.id]}
          pos={c.pos}
          face={c.face}
          action={c.action}
          frame={f}
          duration={d}
          mouthOpen={talks(c) ? mouth : 0}
          facing={chars[c.id]?.facing}
          offset={chars[c.id]?.offset}
          leftHand={slot(c.id, "L")}
          rightHand={slot(c.id, "R")}
          headwear={slot(c.id, "head")}
          front={slot(c.id, "front")}
        />
      ))}
      {world}
    </ThreeCanvas>
  );

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
        {scene}
      </AbsoluteFill>
      {flash ? (
        <AbsoluteFill style={{ backgroundColor: "white", opacity: interpolate(f, [0, 6], [0.9, 0], clamp) }} />
      ) : null}
    </AbsoluteFill>
  );
};
