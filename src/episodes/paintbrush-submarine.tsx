// "How a Paintbrush Beat a Submarine": rendered straight from the engine-contract project.json
// (niche/TOON-3D.md), one <Sequence> per continuous scene (motion v2).
import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import projectJson from "../../episodes/paintbrush-submarine/project.json";
import { Captions } from "../components/Captions";
import { GlassWatermark } from "../components/GlassWatermark";
import { SceneView } from "../components/SceneView";
import { captionWords, loadProject } from "../lib/project";
import { onePerSentence } from "../lib/timing";
import { captionFaceHits } from "../motion/captionCheck";
import { resolveScene } from "../motion/resolveScene";

export const project = loadProject(projectJson);
export const DURATION = project.meta.durationInFrames;
const FPS = project.meta.fps;
const CAPTION_Y = 0.7;
const VOICE = "episodes/paintbrush-submarine/voice.mp3";

const scenes = project.scenes.map((_, i) => resolveScene(project, i, FPS));
const words = captionWords(project);
const emphasis = onePerSentence(words, new Set((project.captions as { x_emphasisWords?: number[] }).x_emphasisWords ?? []));

for (const h of scenes.flatMap((s) => captionFaceHits(s, project.vo.words, FPS, project.meta.width, project.meta.height, CAPTION_Y))) {
  console.warn(`[paintbrush-submarine] caption over ${h.cast}'s face in ${h.scene}: words ${h.words[0]}–${h.words[h.words.length - 1]}`);
}

/** Periscope POV: a round lens over black with a crosshair, opening to full frame. */
const IRIS_FROM = project.vo.words[159].start;
const IRIS_OPEN = project.vo.words[165].start;
const Iris: React.FC = () => {
  const f = useCurrentFrame() + IRIS_FROM;
  const r = interpolate(f, [IRIS_OPEN, IRIS_OPEN + 14], [430, 1400], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const line = interpolate(f, [IRIS_OPEN, IRIS_OPEN + 8], [0.7, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 42%, transparent ${r}px, #000 ${r + 6}px)` }}>
      <AbsoluteFill style={{ opacity: line }}>
        <div style={{ position: "absolute", left: 120, right: 120, top: "42%", height: 3, background: "#000" }} />
        <div style={{ position: "absolute", top: 380, bottom: 740, left: "50%", width: 3, background: "#000" }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const PaintbrushSubmarine: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "black" }}>
    {scenes.map((s) => (
      <Sequence key={s.id} name={`${s.id} · ${s.set}`} from={s.from} durationInFrames={s.duration + s.tail}>
        <SceneView scene={s} voice={VOICE} />
      </Sequence>
    ))}
    <Sequence name="periscope iris" from={IRIS_FROM} durationInFrames={IRIS_OPEN + 14 - IRIS_FROM}>
      <Iris />
    </Sequence>
    <Captions words={words} emphasis={emphasis} yRatio={CAPTION_Y} />
    <GlassWatermark />
    {/* shortcut: voice only; music bed + SFX cues come from tools/make_audio.py once the timing is final. */}
    <Audio src={staticFile(VOICE)} />
  </AbsoluteFill>
);
