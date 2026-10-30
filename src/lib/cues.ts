// Pure cue-sheet logic (no React), shared by the composition and tools/dump-cues.ts.
import { resolveAt, type ShotTiming, type StartAt } from "./timing";

export const MUSIC_DB = -21;
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

