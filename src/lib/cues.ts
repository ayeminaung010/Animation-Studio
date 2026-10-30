// Pure cue-sheet logic (no React), shared by the composition and tools/dump-cues.ts.
import type { Word } from "./shots";
import { msToFrame, resolveAt, type ShotTiming, type StartAt } from "./timing";

export const MUSIC_DB = -21;
/** Motion v2: music rises this much (dB) above MUSIC_DB when nobody talks, ducking back under the voice. */
export const DUCK_DB = 12;
/** Duck envelope in frames: dip starts `attack` before a word, holds `hold` after it, recovers over `release`. */
const DUCK = { attack: 4, hold: 12, release: 18 };
/**
 * Motion v2: a room-tone loop under the whole mix so the audio never drops out (QA: no gaps > 0.25 s
 * below −45 dB). room-tone.wav is ≈ −30 dBFS RMS; at −10 dB it sits ≈ 22 dB under the voice.
 */
export const BED = { name: "room-tone", db: -10 };
/** Pauses in the voice longer than this must be filled by the bed (or fail the build). */
export const MAX_VO_GAP_SEC = 0.25;
/** Whole-mix trim so peaks stay under −1 dBFS. Levels below are relative to the voice (0 dB). */
export const MASTER_DB = -2.8; // includes ~0.6 dB headroom for AAC overshoot

/** Default level per effect (dB). Sustained beds sit lower than one-shot hits. */
const SFX_DB: Record<string, number> = {
  "cash-register-ding": -11,
  "cash-register-ding-soft": -12,
  "town-ambience": -12,
  "dish-whirr": -12,
  "cart-bump": -9,
  "candle-fizzle": -10,
  "phone-buzz": -12,
  "calendar-flip": -10,
  "hollow-clink": -9,
  "gut-thud": -8,
  whoosh: -9,
  "coins-cascade": -12,
  "door-creak": -10,
  "clock-tick": -12,
  "plate-clatter": -10,
  "wedding-bells-distant": -11,
  "tv-crowd-cheer": -11,
  "glass-crack": -10,
  "soft-chime": -12,
  "soft-pat": -10,
  "room-tone": -12,
  "ceramic-crack": -8,
  "paper-avalanche": -11,
  "sting-low": -9,
  "bite-crunch": -9,
  "crowd-murmur": -12,
  "chicken-cluck": -10,
  wind: -12,
  birdsong: -12,
  "church-bell": -11,
  "crow-caw": -11,
  "record-scratch": -9,
  snore: -11,
  "horse-neigh": -10,
  "sword-draw": -10,
  "door-kick": -7,
  "ice-thunk": -8,
  "crowd-laugh": -10,
  "water-drip": -10,
  "egg-sizzle": -12,
  "hammer-knock": -11,
  "hatch-slam": -8,
  "coin-drop": -9,
};

export type CueAt = StartAt | ((t: ShotTiming) => number);

export interface Cue {
  /** When it lands inside the shot: a frame, a spoken word, or a function of the shot timing. */
  at?: CueAt;
  db?: number;
  /** Stop at the end of the shot (ambience beds). */
  fit?: boolean;
}

export type CueSheet = Record<string, Record<string, Cue | Cue[]>>;

export const dbToGain = (db: number) => 10 ** (db / 20);

export interface PlacedCue {
  key: string;
  name: string;
  shot: string;
  from: number;
  durationInFrames?: number;
  db: number;
}

/** Every sfx named in the shot list gets a cue (default: the shot's first frame). */
export const placeCues = (timings: ShotTiming[], sheet: CueSheet): PlacedCue[] => {
  const out: PlacedCue[] = [];
  for (const t of timings) {
    const own = sheet[t.shot.id] ?? {};
    for (const name of Object.keys(own)) {
      if (!t.shot.sfx.includes(name)) throw new Error(`Cue sheet: ${t.shot.id} cues "${name}" but the shot list doesn't name it`);
    }
    for (const name of t.shot.sfx) {
      if (SFX_DB[name] === undefined) throw new Error(`No sound "${name}" — add it to tools/make_audio.py and SFX_DB`);
      const cues = own[name] === undefined ? [{}] : Array.isArray(own[name]) ? own[name] : [own[name]];
      cues.forEach((c, i) => {
        const at = typeof c.at === "function" ? c.at(t) : resolveAt(c.at, t);
        out.push({
          key: `${t.shot.id}-${name}-${i}`,
          name,
          shot: t.shot.id,
          from: t.from + Math.max(0, at),
          durationInFrames: c.fit ? Math.max(1, t.durationInFrames - at) : undefined,
          db: c.db ?? SFX_DB[name],
        });
      });
    }
  }
  return out;
};


/** Music level (dB, before MASTER_DB) per frame: MUSIC_DB under the voice, + DUCK_DB in real pauses. */
export const musicDbAt = (words: Word[], fps: number) => {
  const spans = words.map((w) => [msToFrame(w.startMs, fps), msToFrame(w.endMs, fps)]);
  return (f: number) => {
    let depth = 0;
    for (const [a, b] of spans) {
      if (f < a - DUCK.attack) break;
      const d = f < a ? (f - (a - DUCK.attack)) / DUCK.attack
        : f <= b + DUCK.hold ? 1
          : 1 - (f - b - DUCK.hold) / DUCK.release;
      depth = Math.max(depth, d);
    }
    return MUSIC_DB + DUCK_DB * (1 - Math.min(1, Math.max(0, depth)));
  };
};

/** Silences in the voice longer than MAX_VO_GAP_SEC (seconds: start, length). */
export const voGaps = (words: Word[]) =>
  words.slice(1)
    .map((w, i) => ({ at: words[i].endMs / 1000, len: (w.startMs - words[i].endMs) / 1000 }))
    .filter((g) => g.len > MAX_VO_GAP_SEC);

/** Fails the build when the voice has gaps and nothing continuous plays under them. */
export const assertGapsFilled = (words: Word[], bed: typeof BED | null) => {
  const gaps = voGaps(words);
  if (gaps.length && !bed) {
    throw new Error(`Voice has ${gaps.length} gaps over ${MAX_VO_GAP_SEC}s (first at ${gaps[0].at.toFixed(1)}s) and no ambience bed to fill them`);
  }
  return gaps;
};

/**
 * Runtime against the target. Returns a message when the voice runs over target × 1.05, naming how many
 * words to cut and the two longest beats to cut them from (we never time-stretch the voice).
 */
export const runtimeProblem = (timings: ShotTiming[], words: Word[], targetSec: number) => {
  const sec = (words[words.length - 1].endMs - words[0].startMs) / 1000;
  if (sec <= targetSec * 1.05) return null;
  const wps = words.length / sec;
  const trim = Math.ceil((sec - targetSec) * wps);
  const beats = new Map<string, number>();
  for (const t of timings) beats.set(t.shot.beat, (beats.get(t.shot.beat) ?? 0) + t.durationInFrames);
  const longest = [...beats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([b]) => b);
  return `Runtime ${sec.toFixed(1)} s is ${Math.round((sec / targetSec - 1) * 100)}% over the ${targetSec} s target: ` +
    `trim ~${trim} words (longest beats: ${longest.join(", ")}) and re-voice. The voice is never time-stretched.`;
};
