// v1 shot list (03-shots.json + LAYOUT) → engine contract v1.1 scenes.
// - Consecutive shots on the same set merge into one scene (one camera take).
// - Each shot's camera from/to become keys at its first, middle and last word.
// - Actions/faces become base actions, gestures (where a gesture matches) and expressions.
// - Every character gets a seeded default performance: energy 0.7–1.0, gaze at whoever talks
//   (listeners 7 frames late), a glance away at least every ~3.5 s.
// - Hard cuts survive only on set changes, at most 5 per 60 s; the rest become WHIP / FLYOVER / IRIS.
import { random } from "remotion";
import { framingAt } from "../components/CameraRig";
import { markWorld } from "../components/Character";
import { seedFor } from "../motion/defaults";
import type { GesturePose } from "../motion/gestures";
import { fromV1Transition, type TransitionType } from "../motion/Transition";
import { isHardCut, type PerformanceV11, type ProjectV11, type SceneV11 } from "./scenes";
import type { Episode, Vec3, Word } from "./shots";
import { cameraSpecAt, placementsFor, type Placement, type ShotLayout } from "./staging";
import { computeTimings, msToFrame, totalFrames, type ShotTiming } from "./timing";

/** v1 actions that are really one of the contract's gestures (base pose becomes idle, the gesture hits on the stressed word). */
const ACTION_GESTURE: Record<string, GesturePose> = {
  "yell-point": "point",
  shrug: "shrug",
  "wave-hello": "wave",
  "give-coin": "hand_over",
  "hand-bread-over": "hand_over",
  "count-coins": "count_money",
};
const MOVE_LABEL: Record<string, string> = {
  static: "HOLD", "push-in": "PUSH", "pull-out": "PULL", "pan-left": "TRACK", "pan-right": "TRACK",
  orbit: "ARC", whip: "WHIP", shake: "HOLD", "dolly-zoom": "PUSH",
};
/** Replacements for hard cuts over budget, in rotation. */
const SOFT: TransitionType[] = ["WHIP", "FLYOVER", "IRIS"];
const CUTS_PER_MIN = 5;
const GLANCE_SEC = 3.5;
const REACT = 7;

const cast = (id: string) => `cast.${id}`;
const lastWord = (t: ShotTiming) => t.firstWord + t.words.length - 1;

export const migrateV1toV2 = (
  episode: Episode,
  rawWords: Word[],
  layout: Record<string, ShotLayout>,
  targetSec = 60,
): ProjectV11 => {
  const fps = episode.fps;
  const timings = computeTimings(episode.shots, rawWords, fps);
  const words = rawWords.map((w) => ({ w: w.text, start: msToFrame(w.startMs, fps), end: msToFrame(w.endMs, fps) }));
  const duration = totalFrames(rawWords, fps);

  // 1. Group shots by set.
  const groups: ShotTiming[][] = [];
  for (const t of timings) {
    const g = groups[groups.length - 1];
    if (g && g[0].shot.set === t.shot.set) g.push(t);
    else groups.push([t]);
  }

  // 2. Transitions: keep hard cuts on beat changes first, up to the budget.
  const budget = Math.floor((CUTS_PER_MIN * duration) / fps / 60);
  const wanted = groups.slice(1).map((g) => fromV1Transition(g[0].shot.transition_in));
  const hardIdx = wanted.map((t, i) => (isHardCut(t) ? i : -1)).filter((i) => i >= 0);
  const beatChange = (i: number) => groups[i + 1][0].shot.beat !== groups[i][groups[i].length - 1].shot.beat;
  // MATCH first (a designed shape cut), then cuts on a beat change, then the rest, in story order.
  const rank = (i: number) => (wanted[i] === "MATCH" ? 0 : beatChange(i) ? 1 : 2);
  const keep = new Set([...hardIdx].sort((a, b) => rank(a) - rank(b) || a - b).slice(0, budget));
  let soft = 0;
  const outs = wanted.map((t, i) => (isHardCut(t) && !keep.has(i) ? SOFT[soft++ % SOFT.length] : t));

  const scenes: SceneV11[] = groups.map((g, gi) => {
    const fromWord = g[0].firstWord;
    const toWord = lastWord(g[g.length - 1]);
    const wordFrame = (w: number) => words[w].start;

    // Camera keys from each shot's framing at its first and last word (shot-local frames for the aim).
    const keys = g.flatMap((t) => {
      const lay = layout[t.shot.id];
      const placed = placementsFor(t.shot, lay);
      const n = lastWord(t);
      // A middle key on every shot keeps the camera gliding through it instead of holding the opening
      // framing until the last word (motion_qa: frozen frames and abrupt starts sat in those holds).
      const at = [t.firstWord, Math.round((t.firstWord + n) / 2), n];
      return [...new Set(at)].map((w, j, all) => {
        const p = all.length === 1 ? 0 : j / (all.length - 1);
        const r = framingAt(cameraSpecAt(t.shot, lay, placed, wordFrame(w) - t.from, t.durationInFrames), p);
        return { atWord: w, move: MOVE_LABEL[t.shot.camera.move], pos: [r.eye.x, r.eye.y, r.eye.z] as Vec3, lookAt: [r.aim.x, r.aim.y, r.aim.z] as Vec3, fov: r.fov };
      });
    });
    const shake = g.filter((t) => t.shot.camera.move === "shake").map((t) => ({ atWord: t.emphasisWord ?? t.firstWord, strength: 1 }));

    // Props: one occurrence per shot; the same prop at the same spot in the next shot just stays.
    const props: NonNullable<SceneV11["x_props"]> = [];
    for (const t of g) {
      for (const { name, place } of placementsFor(t.shot, layout[t.shot.id])) {
        // `focus` only aims the camera (already baked into the keys), so it doesn't make a prop "different".
        const rest: Placement = { ...place };
        delete rest.focus;
        delete rest.startAt;
        const { startAt } = place;
        const prev = props.find((x) => x.name === name && x.toWord === t.firstWord - 1 && JSON.stringify(x.place) === JSON.stringify(rest));
        if (prev) {
          prev.toWord = lastWord(t);
          continue;
        }
        let startWord = t.firstWord;
        let startOffset = 0;
        if (typeof startAt === "number") startOffset = startAt;
        else if (startAt) {
          const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9']/g, "");
          const k = t.words.findIndex((w) => norm(w.text) === norm(startAt.word));
          if (k < 0) throw new Error(`migrate: shot ${t.shot.id} prop ${name} starts at "${startAt.word}", not spoken there`);
          startWord = t.firstWord + k;
          startOffset = startAt.offset ?? 0;
        }
        props.push({ name, place: rest, fromWord: t.firstWord, toWord: lastWord(t), startWord, startOffset });
      }
    }

    // Performances: everyone who appears in any shot of the scene.
    const ids = [...new Set(g.flatMap((t) => t.shot.characters.map((c) => c.id)))];
    const speakerOf = (w: number) => {
      const t = g.find((x) => w >= x.firstWord && w <= lastWord(x));
      if (!t) return undefined;
      const local = t.words[w - t.firstWord];
      if (t.shot.lines) return local.speaker;
      return t.shot.characters.find((c) => c.speaking)?.id;
    };
    const performances: PerformanceV11[] = ids.map((id) => {
      const mine = g.filter((t) => t.shot.characters.some((c) => c.id === id));
      const charIn = (t: ShotTiming) => t.shot.characters.find((c) => c.id === id)!;
      const mark = (t: ShotTiming) => markWorld(charIn(t).pos, layout[t.shot.id].chars?.[id]?.offset);
      const facingIn = (t: ShotTiming) => layout[t.shot.id].chars?.[id]?.facing ?? 0;

      const locomotion: NonNullable<PerformanceV11["locomotion"]> = [];
      mine.forEach((t, k) => {
        if (k === 0) return;
        const a = mark(mine[k - 1]);
        const b = mark(t);
        if (Math.hypot(a[0] - b[0], a[2] - b[2]) > 0.01) {
          locomotion.push({ fromWord: Math.max(lastWord(mine[k - 1]) - 1, mine[k - 1].firstWord), toWord: t.firstWord, to: b, gait: "walk" });
        }
      });

      const actions: NonNullable<PerformanceV11["x_actions"]> = [];
      const gestures: NonNullable<PerformanceV11["gestures"]> = [];
      for (const t of mine) {
        const action = charIn(t).action;
        const pose = ACTION_GESTURE[action];
        actions.push({ atWord: t.firstWord, action: pose ? "idle" : action });
        if (pose) {
          const hit = t.emphasisWord ?? Math.min(lastWord(t), t.firstWord + 1);
          const hold = words[lastWord(t)].end - words[hit].start;
          gestures.push({ atWord: hit, pose, hold: Math.max(10, hold) });
        }
      }

      const expressions = mine
        .map((t) => ({ atWord: t.firstWord, expr: charIn(t).face }))
        .filter((e, k, all) => k === 0 || e.expr !== all[k - 1].expr);

      // Words this character speaks, as inclusive ranges.
      const spoken: [number, number][] = [];
      for (let w = fromWord; w <= toWord; w++) {
        if (speakerOf(w) !== id) continue;
        const r = spoken[spoken.length - 1];
        if (r && r[1] === w - 1) r[1] = w;
        else spoken.push([w, w]);
      }
      const stress = spoken.flatMap(([a, b]) =>
        Array.from({ length: b - a + 1 }, (_, k) => a + k).filter((w) =>
          g.some((t) => t.emphasisWord === w) || words[w].w.replace(/[^A-Za-z0-9']/g, "").length >= 7),
      );

      // Gaze: at the listener when talking, at each new on-screen speaker (late) when listening.
      const others = (t: ShotTiming) => t.shot.characters.filter((c) => c.id !== id);
      const gaze: NonNullable<PerformanceV11["gaze"]> = [];
      for (const t of mine) {
        const o = others(t);
        gaze.push({ atWord: t.firstWord, target: o.length ? cast(o[0].id) : "camera" });
        for (let w = t.firstWord; w <= lastWord(t); w++) {
          const sp = speakerOf(w);
          if (sp && sp !== id && sp !== speakerOf(w - 1) && t.shot.characters.some((c) => c.id === sp)) {
            gaze.push({ atWord: w, target: cast(sp), reactDelay: REACT });
          }
        }
      }
      // Glance away and back when a look is held longer than ~3.5 s.
      const filled: typeof gaze = [];
      gaze.forEach((k, i) => {
        filled.push(k);
        const end = i + 1 < gaze.length ? gaze[i + 1].atWord : toWord;
        const nextGlance = (from: number) =>
          words.findIndex((x, j) => j > from && j < end && x.start - words[from].start >= GLANCE_SEC * fps);
        for (let away = nextGlance(k.atWord); away >= 0 && away + 3 < end; away = nextGlance(away + 3)) {
          filled.push({ atWord: away, target: "away" }, { atWord: away + 3, target: k.target });
        }
      });

      return {
        cast: cast(id),
        seed: seedFor(id),
        pos: mark(mine[0]),
        facing: facingIn(mine[0]),
        energy: Math.round((0.7 + 0.3 * random(`energy-${id}-${gi}`)) * 100) / 100,
        speaks: spoken.length > 0,
        speakWords: spoken,
        stress,
        gaze: filled,
        gestures,
        expressions,
        locomotion,
        x_actions: actions,
        x_facing: mine.map((t) => ({ atWord: t.firstWord, facing: facingIn(t) })),
        x_present: [mine[0].firstWord, lastWord(mine[mine.length - 1])],
      };
    });

    return {
      id: `scene.${String(gi + 1).padStart(2, "0")}`,
      set: `set.${g[0].shot.set}`,
      fromWord,
      toWord,
      camera: { keys, leadSec: 1.1, handheld: 1, shake },
      performances,
      transitionOut: gi + 1 < groups.length ? { type: outs[gi], via: null } : undefined,
      x_lighting: g[0].shot.lighting,
      x_props: props,
      x_emphasis: g.flatMap((t) => (t.emphasisWord === null ? [] : [t.emphasisWord])),
    };
  });

  const beats: NonNullable<ProjectV11["beats"]> = [];
  for (const t of timings) {
    const b = beats[beats.length - 1];
    if (b && b.label === t.shot.beat) b.toWord = lastWord(t);
    else beats.push({ id: `beat.${String(beats.length + 1).padStart(2, "0")}`, label: t.shot.beat, fromWord: t.firstWord, toWord: lastWord(t) });
  }

  return {
    meta: {
      title: episode.title, slug: episode.slug, aspect: "9:16", width: episode.width, height: episode.height,
      fps, durationInFrames: duration, targetSec,
    },
    cast: Object.entries(episode.characters).map(([id, def]) => ({ id: cast(id), x_def: def })),
    sets: [...new Set(episode.shots.map((s) => s.set))].map((s) => ({ id: `set.${s}`, x_set: s })),
    vo: { words, script: rawWords.map((w) => w.text).join(" ") },
    beats,
    scenes,
  };
};
