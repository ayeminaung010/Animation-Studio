// Types and loader for episodes/<slug>/03-shots.json and 04-words.json.

export const FRAMINGS = ["extreme-wide", "wide", "medium", "close", "extreme-close"] as const;
export const CAMERA_MOVES = [
  "static", "push-in", "pull-out", "pan-left", "pan-right", "orbit", "whip", "shake", "dolly-zoom",
] as const;
export const FACES = [
  "neutral", "happy", "sad", "smug", "shocked", "scared", "angry", "suspicious", "crying", "blank",
] as const;
export const TRANSITIONS = ["cut", "whip", "flash", "match-cut"] as const;
export const LIGHTINGS = ["warm-key", "cold-blue", "red-rim", "overhead-bulb"] as const;

export type Framing = (typeof FRAMINGS)[number];
export type CameraMove = (typeof CAMERA_MOVES)[number];
export type FaceName = (typeof FACES)[number];
export type TransitionName = (typeof TRANSITIONS)[number];
export type LightingName = (typeof LIGHTINGS)[number];
export type Vec3 = [number, number, number];

export interface CharacterDef {
  preset: "everyman" | "period" | "host" | "custom";
  shirt?: string;
  hair?: string;
  outfit?: string;
  outfit_color?: string;
  accessory?: string;
}

export interface ShotCharacter {
  id: string;
  pos: Vec3;
  face: FaceName;
  action: string;
  speaking?: boolean;
}

export interface Shot {
  id: string;
  beat: string;
  text: string;
  set: string;
  characters: ShotCharacter[];
  props: string[];
  lighting: LightingName;
  camera: { move: CameraMove; from: Framing; to: Framing; target: string };
  sfx: string[];
  emphasis_word: string;
  transition_in: TransitionName;
  note?: string;
  /** Dialogue: who says which part of `text`, in order. Joined, the lines must equal `text`. */
  lines?: { speaker: string; text: string }[];
  /** Already baked into the voice file. Timing must not add it again. */
  tts_pause_after_ms?: number;
}

export interface Episode {
  slug: string;
  title: string;
  fps: number;
  width: number;
  height: number;
  characters: Record<string, CharacterDef>;
  shots: Shot[];
}

export interface Word {
  text: string;
  startMs: number;
  endMs: number;
}

const oneOf = <T extends readonly string[]>(list: T, value: unknown, where: string): T[number] => {
  if (typeof value === "string" && (list as readonly string[]).includes(value)) {
    return value as T[number];
  }
  throw new Error(`${where}: "${String(value)}" is not one of ${list.join(", ")}`);
};

/** Validates the raw JSON so a typo in the shot list fails loudly instead of rendering wrong. */
export const parseEpisode = (raw: unknown): Episode => {
  const e = raw as Episode;
  if (!Array.isArray(e.shots) || e.shots.length === 0) throw new Error("03-shots.json has no shots");
  for (const s of e.shots) {
    const w = `shot ${s.id}`;
    oneOf(LIGHTINGS, s.lighting, `${w} lighting`);
    oneOf(CAMERA_MOVES, s.camera.move, `${w} camera.move`);
    oneOf(FRAMINGS, s.camera.from, `${w} camera.from`);
    oneOf(FRAMINGS, s.camera.to, `${w} camera.to`);
    oneOf(TRANSITIONS, s.transition_in, `${w} transition_in`);
    for (const c of s.characters) {
      oneOf(FACES, c.face, `${w} ${c.id} face`);
      if (!e.characters[c.id]) throw new Error(`${w}: character "${c.id}" is not defined`);
    }
    if (s.lines) {
      const flat = (t: string) => t.trim().split(/\s+/).join(" ");
      if (flat(s.lines.map((l) => l.text).join(" ")) !== flat(s.text)) throw new Error(`${w}: lines joined don't equal text`);
      for (const l of s.lines) {
        // Off-screen speakers are fine (no mouth moves); unknown ones are typos.
        if (!e.characters[l.speaker]) throw new Error(`${w}: speaker "${l.speaker}" is not defined`);
      }
    }
  }
  return e;
};

export const parseWords = (raw: unknown): Word[] => {
  const words = raw as Word[];
  if (!Array.isArray(words) || words.length === 0) throw new Error("04-words.json is empty");
  return words;
};
