// Default performances for a v1 shot (motion v2 without hand-written performance data).
// Every character gets: a seeded idle and energy, gaze toward whoever is talking (listeners react
// 7 frames late), a glance at least every ~3.5 s, mouth and nods only on their own words.
import { random } from "remotion";
import { markWorld } from "../components/Character";
import type { Vec3 } from "../lib/shots";
import type { ShotTiming } from "../lib/timing";
import { reactAt, type GazeKey } from "./motion-kit";
import type { Performance } from "./useCharacterMotion";

/** Stable per-character seed, so a character idles the same way in every shot. */
export const seedFor = (id: string) => Math.floor(random(`seed-${id}`) * 100000);

/** Longest stretch without a gaze change (Living Frame law: at least one every 4 s). */
const MAX_HOLD_SEC = 3.5;
/** Speakers cheat their look this much toward the lens. */
const CAMERA_CHEAT = 0.7;
/**
 * Looks at another character are scaled down and capped: layout `facing` already turns people
 * toward each other, and a full turn puts faces in profile (stills: s04, s17, s23).
 */
const TOWARD_CHEAT = 0.45;
const TOWARD_MAX = 0.65;

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clampYaw = (a: number) => Math.max(-1.1, Math.min(1.1, a));
const norm = (w: string) => w.replace(/[^A-Za-z0-9']/g, "");

export interface ShotStaging {
  chars?: Record<string, { facing?: number; offset?: Vec3 }>;
  azimuth?: number;
}

export const shotPerformances = (timing: ShotTiming, staging: ShotStaging, fps: number): Record<string, Performance> => {
  const { shot, words, durationInFrames: d, emphasisFrame } = timing;
  const cast = shot.characters;
  const facing = (id: string) => staging.chars?.[id]?.facing ?? 0;
  const at = (id: string) => {
    const c = cast.find((x) => x.id === id);
    return c ? markWorld(c.pos, staging.chars?.[id]?.offset) : null;
  };
  const yawTo = (from: string, to: string) => {
    const a = at(from);
    const b = at(to);
    if (!a || !b) return 0;
    const yaw = wrap(Math.atan2(b[0] - a[0], b[2] - a[2]) - facing(from)) * TOWARD_CHEAT;
    return Math.max(-TOWARD_MAX, Math.min(TOWARD_MAX, yaw));
  };
  const camYaw = (id: string) => clampYaw(wrap((staging.azimuth ?? 0) - facing(id)) * CAMERA_CHEAT);
  const ownWords = (id: string) =>
    words.filter((w) => (shot.lines ? w.speaker === id : cast.find((c) => c.id === id)?.speaking));

  // Who is talking from each word on (on-screen speakers only).
  const turns = words
    .filter((w, i) => w.speaker && cast.some((c) => c.id === w.speaker) && w.speaker !== words[i - 1]?.speaker)
    .map((w) => ({ frame: w.start, speaker: w.speaker as string }));

  const out: Record<string, Performance> = {};
  for (const c of cast) {
    const seed = seedFor(c.id);
    const mine = ownWords(c.id);
    const others = cast.filter((o) => o.id !== c.id);
    const base = others.length ? yawTo(c.id, others[0].id) : camYaw(c.id);

    // Speakers look at the listener (or the lens when alone); listeners turn to each new speaker.
    const gaze: GazeKey[] = [{ frame: 0, yaw: mine.length && !others.length ? camYaw(c.id) : base }];
    for (const t of turns) {
      if (t.speaker === c.id) continue;
      gaze.push({ frame: reactAt(t.frame), yaw: yawTo(c.id, t.speaker) });
    }
    gaze.sort((a, b) => a.frame - b.frame);

    // Fill long holds with a short glance away and back.
    const hold = Math.round(MAX_HOLD_SEC * fps);
    const back = Math.round(fps * 1.1);
    const filled: GazeKey[] = [];
    gaze.forEach((g, i) => {
      filled.push(g);
      const next = gaze[i + 1]?.frame ?? d;
      for (let f = g.frame + hold, n = 0; f + back < next; f += hold, n++) {
        const side = random(`glance-${c.id}-${shot.id}-${g.frame}-${n}`) < 0.5 ? -1 : 1;
        filled.push({ frame: f, yaw: clampYaw(g.yaw + side * 0.28), pitch: 0.06 });
        filled.push({ frame: f + back, yaw: g.yaw });
      }
    });

    const stress = mine
      .filter((w) => w.start === emphasisFrame || norm(w.text).length >= 7)
      .map((w) => w.start);

    out[c.id] = {
      seed,
      energy: Math.min(1.3, 0.7 + 0.3 * random(`energy-${c.id}-${shot.id}`) + (mine.length ? 0.3 : 0)),
      actions: [{ action: c.action, from: 0, duration: d }],
      gaze: filled,
      speaks: mine.map((w) => ({ w: w.text, start: w.start, end: w.end })),
      stress,
      expressions: [{ frame: 0, face: c.face }],
      // Listeners blink a beat after the line's punch word.
      blinks: !mine.length && emphasisFrame !== null ? [reactAt(emphasisFrame)] : [],
    };
  }
  return out;
};
