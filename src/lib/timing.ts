// Word timestamps → frame timing. Never hand-type frame numbers.
import type { Shot, Word } from "./shots";

export interface ShotTiming {
  shot: Shot;
  from: number;
  durationInFrames: number;
  /** Words spoken during this shot, with frames relative to the shot start. */
  words: { text: string; start: number; end: number; speaker?: string }[];
  /** Frame (relative to the shot) where the emphasis word starts, or null. */
  emphasisFrame: number | null;
  /** Index into 04-words.json of the shot's first word and of its emphasis word (or null). */
  firstWord: number;
  emphasisWord: number | null;
}

const isDash = (w: string) => /^[—–-]$/.test(w);
const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9']/g, "");

/** Number of timed words a shot's text maps to (dashes are merged into the previous word). */
export const wordCount = (text: string) => text.split(/\s+/).filter((w) => w && !isDash(w)).length;

export const msToFrame = (ms: number, fps: number) => Math.round((ms / 1000) * fps);

export const TAIL_MS = 500;

export const computeTimings = (shots: Shot[], words: Word[], fps: number): ShotTiming[] => {
  const total = shots.reduce((n, s) => n + wordCount(s.text), 0);
  if (total !== words.length) {
    throw new Error(`Shot text has ${total} words but 04-words.json has ${words.length}`);
  }
  let i = 0;
  const firstIndex = shots.map((s) => {
    const idx = i;
    i += wordCount(s.text);
    return idx;
  });
  const endFrame = msToFrame(words[words.length - 1].endMs + TAIL_MS, fps);

  return shots.map((shot, k) => {
    // The first shot starts at frame 0 so the video never opens on an empty frame.
    const from = k === 0 ? 0 : msToFrame(words[firstIndex[k]].startMs, fps);
    const to = k + 1 < shots.length ? msToFrame(words[firstIndex[k + 1]].startMs, fps) : endFrame;
    const own = words.slice(firstIndex[k], firstIndex[k] + wordCount(shot.text));
    const speakers = (shot.lines ?? []).flatMap((l) => Array<string>(wordCount(l.text)).fill(l.speaker));
    const rel = own.map((w, j) => ({
      text: w.text,
      start: msToFrame(w.startMs, fps) - from,
      end: msToFrame(w.endMs, fps) - from,
      speaker: speakers[j],
    }));
    const target = norm(shot.emphasis_word);
    const hit = rel.find((w) => norm(w.text) === target) ?? rel.find((w) => norm(w.text).startsWith(target));
    const hitIndex = hit ? rel.indexOf(hit) : -1;
    return {
      shot,
      from,
      durationInFrames: to - from,
      words: rel,
      emphasisFrame: hit ? hit.start : null,
      firstWord: firstIndex[k],
      emphasisWord: hitIndex >= 0 ? firstIndex[k] + hitIndex : null,
    };
  });
};

export const totalFrames = (words: Word[], fps: number) => msToFrame(words[words.length - 1].endMs + TAIL_MS, fps);

export type StartAt = number | { word: string; offset?: number };

/** Resolve a frame-or-word reference to a frame inside the shot. Throws if the word isn't spoken here. */
export const resolveAt = (at: StartAt | undefined, timing: ShotTiming): number => {
  if (at === undefined) return 0;
  if (typeof at === "number") return at;
  const w = timing.words.find((x) => norm(x.text) === norm(at.word));
  if (!w) throw new Error(`Shot ${timing.shot.id}: word "${at.word}" is not spoken in this shot`);
  return w.start + (at.offset ?? 0);
};

/** Keeps at most one caption emphasis word per sentence (the first); sentences end on . ? ! */
export const onePerSentence = (words: Word[], emphasis: Set<number>) => {
  const out = new Set<number>();
  let used = false;
  words.forEach((w, i) => {
    if (emphasis.has(i) && !used) {
      out.add(i);
      used = true;
    }
    if (/[.?!]["”']?$/.test(w.text)) used = false;
  });
  return out;
};
