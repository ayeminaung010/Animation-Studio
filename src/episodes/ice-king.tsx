// src/episodes/ice-king.tsx: one <Sequence> per shot, timed from 04-words.json.
// Story data lives in episodes/ice-king/*.json; this file only adds staging.
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import shotsJson from "../../episodes/ice-king/03-shots.json";
import wordsJson from "../../episodes/ice-king/04-words.json";
import { Captions } from "../components/Captions";
import { ShotView, type MotionVersion, type ShotLayout } from "../components/Shot";
import { Soundtrack } from "../components/Soundtrack";
import { placeCues } from "../lib/cues";
import { CUES } from "./ice-king.cues";
import { parseEpisode, parseWords } from "../lib/shots";
import { computeTimings, totalFrames } from "../lib/timing";

export const episode = parseEpisode(shotsJson);
export const words = parseWords(wordsJson);
export const timings = computeTimings(episode.shots, words, episode.fps);
export const DURATION = totalFrames(words, episode.fps);
const VOICE = "episodes/ice-king/voice.mp3";
const MUSIC = "audio/music/ice-king.wav";

const SNOW = { snowfall: [{ at: [0, 0, 0] as [number, number, number] }] };
const LANTERN = { lantern: [{ at: [-1.8, 2.3, 0.2] as [number, number, number] }] };
const SIGN = { "bar-sign": [{ at: [1.3, 1.16, -1.75] as [number, number, number] }] };
const MID: [number, number, number] = [0, 1.2, 0];

export const LAYOUT: Record<string, ShotLayout> = {
  s01: {
    props: {
      ...SNOW,
      "ice-block": [{ at: [-0.72, 0, 0.15] }],
      "merchant-ship": [{ at: [-3.8, -0.3, -4.5], scale: 0.9 }],
      "ice-crate": [{ at: [1.2, 0, -0.5], rot: [0, 0.3, 0] }, { at: [1.75, 0, -1.2], rot: [0, -0.2, 0] }],
    },
    chars: { hero: { facing: -1.25 } },
    target: [-0.3, 1.1, 0],
  },
  s02: { props: { ...SNOW, "merchant-ship": [{ at: [-2.5, -0.3, -5.5], scale: 0.9 }] }, target: [0, 1.1, 0] },
  s03: { props: { ...SNOW, "thought-bubble": [{ at: [0.32, 2.0, 0.3], scale: 0.6, startAt: { word: "soup", offset: -4 } }] }, target: [0, 1.6, 0] },
  s04: { props: { "sawdust-sack": [{ at: [-0.05, 0, 0.1] }] }, chars: { captain: { facing: -0.3 }, hero: { facing: 0.3 } }, target: MID },
  s05: { props: { "sawdust-sack": [{ at: [-0.2, 0, 0.35] }] }, chars: { hero: { facing: 0.2 } }, azimuth: 0.2 },
  s06: {
    props: { "ice-house": [{ at: [-0.6, 0, -1.6], focus: [0.6, 1.1, 1] }], hammer: [{ char: "buddy", hand: "R" }] },
    chars: { buddy: { facing: -0.6 } },
  },
  s07: { props: { "ice-house": [{ at: [-0.6, 0, -1.6], focus: [0.3, 0.9, 1.2] }] }, chars: { buddy: { facing: -0.4 } } },
  s08: {
    props: { hatch: [{ at: [0.66, 0, 0.85], focus: [-0.6, 1.0, -0.6] }], "sun-timelapse": [{ at: [0, 3, -18] }] },
    chars: { sailor_a: { facing: 0 }, hero: { facing: 0.3 } },
  },
  s09: { props: { ...LANTERN, "ice-stack": [{ at: [0, 0, -0.6], focus: [0, 0.9, 0] }], "water-drips": [{ at: [0, 0, -0.6] }] }, frameScale: 1.5 },
  s10: { props: { hatch: [{ at: [0.2, 0, 1.0] }] }, chars: { sailor_a: { facing: -0.5 }, hero: { facing: 0.3 } }, target: MID },
  s11: { props: { "frying-egg": [{ at: [0, 0, 0], focus: [0, 0.05, 0] }] }, elevation: 0.9 },
  s12: { props: { "hatch-closing": [{ at: [0.45, 0, 0.6], startAt: { word: "shut" } }] }, chars: { hero: { facing: 0.3 } }, target: [-0.3, 1.1, 0] },
  s13: { props: { "merchant-ship": [{ at: [0, -0.2, -4], focus: [0, 2.6, 0] }] }, frameScale: 1.6 },
  s14: {
    props: {
      ...LANTERN,
      "ice-stack": [{ at: [0.3, 0, -0.6], focus: [-0.5, 1.0, 0.4] }],
      "god-rays": [{ at: [0.3, 0, -0.3] }],
    },
    chars: { hero: { facing: 0.4 } },
  },
  s15: { props: SIGN, chars: { barkeep: { facing: -0.3 }, hero: { facing: 0.3 } }, target: MID },
  s16: { chars: { barkeep: { facing: -0.2 } } },
  s17: { props: { "drink-glass": [{ char: "hero", hand: "R" }] }, chars: { hero: { facing: 0.5 }, barkeep: { facing: -0.4 } } },
  s18: { props: { "sawdust-macro": [{ at: [0, 1.2, 0] }] } },
  s19: { props: { "picnic-cooler": [{ at: [0, 0, 0.5], focus: [0.15, 0.3, 0] }] }, frameScale: 1.4 },
  s20: { props: { ...LANTERN, "ice-stack": [{ at: [0.2, 0, -0.6], focus: [-0.4, 1.0, 0.4] }] }, chars: { hero: { facing: 0.4 } } },
  s21: {
    props: { ...SIGN, "drink-glass": [{ char: "barkeep", hand: "R" }] },
    chars: { sailor_b: { facing: 0.4 }, sailor_c: { facing: -0.4 } },
  },
  s22: {
    props: {
      ...SNOW,
      "merchant-ship": [{ at: [-4, -0.3, -5] }, { at: [3.5, -0.3, -8] }, { at: [10, -0.3, -11] }],
      "ice-crate": [
        { char: "sailor_b", front: true, at: [0, 0.6, 0.38], scale: 0.7 },
        { char: "sailor_c", front: true, at: [0, 0.6, 0.38], scale: 0.7 },
      ],
    },
    chars: { sailor_b: { facing: 0.9 }, sailor_c: { facing: 0.9 } },
  },
  s23: {
    props: { ...SIGN, "gold-coin": [{ char: "sailor_a", hand: "R" }] },
    chars: { sailor_a: { facing: -0.4 }, hero: { facing: 0.4 } },
  },
};

// Every shot needs a staging entry.
for (const t of timings) {
  if (!LAYOUT[t.shot.id]) throw new Error(`LAYOUT is missing shot ${t.shot.id}`);
}

export const cues = placeCues(timings, CUES);
const emphasis = new Set(timings.flatMap((t) => (t.emphasisWord === null ? [] : [t.emphasisWord])));

export const IceKing: React.FC<{ motion: MotionVersion }> = ({ motion }) => (
  <AbsoluteFill
    style={{
      backgroundColor: "black"
    }}
  >
    {timings.map((t) => (
      <Sequence key={t.shot.id} name={`${t.shot.id} · ${t.shot.beat}`} from={t.from} durationInFrames={t.durationInFrames}>
        <ShotView timing={t} characters={episode.characters} layout={LAYOUT[t.shot.id]} voice={VOICE} motion={motion} />
      </Sequence>
    ))}
    <Captions words={words} emphasis={emphasis} />
    <Soundtrack voice={VOICE} music={MUSIC} cues={cues} />
  </AbsoluteFill>
);
