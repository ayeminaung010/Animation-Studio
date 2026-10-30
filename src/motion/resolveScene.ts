// Engine contract v1.1 scene → everything SceneView needs, in scene-local frames.
// Word indices resolve through vo.words; gaze targets resolve to yaw from where everyone (and the
// camera) is at that moment. Pure in (project, scene index, fps).
import { random } from "remotion";
import type { Pose } from "../components/actions";
import { EXPRESSION_FACE, speakRanges, type Expression, type ProjectV11 } from "../lib/scenes";
import type { CharacterDef, FaceName, LightingName, Vec3 } from "../lib/shots";
import type { Placement } from "../lib/staging";
import { CAMERA, densify, trackAt, type TrackSpec } from "./cameraTrack";
import { TOWARD_CHEAT, TOWARD_MAX } from "./defaults";
import { clamp01, SPRINGS, springStep, springTrack, type GazeKey } from "./motion-kit";
import type { TransitionType } from "./Transition";
import type { ActionSpan, Performance } from "./useCharacterMotion";

/** Characters and props enter/exit this many frames before their shot starts/ends (camera is mid-travel). */
const ENTER = 10;
/** Emphasis punch: size and how long it holds before easing back. */
const PUNCH = 0.05;
const PUNCH_HOLD = 24;

export interface SceneCast {
  id: string;
  def: CharacterDef;
  perf: Performance;
  posAt: (f: number) => Vec3;
  facingAt: (f: number) => number;
  /** Presence scale (0 = off set). */
  scaleAt: (f: number) => number;
  /** Leg swing while walking between marks, added to the pose. */
  legsAt: (f: number) => Pick<Pose, "legL" | "legR">;
}

export interface SceneProp {
  key: string;
  name: string;
  place: Placement;
  from: number;
  to: number;
  /** Scene frame that is the prop animation's frame 0. */
  zero: number;
  scaleAt: (f: number) => number;
}

export interface ResolvedScene {
  id: string;
  /** Global start frame and length. */
  from: number;
  duration: number;
  set: string;
  lighting: LightingName;
  track: TrackSpec;
  cast: SceneCast[];
  props: SceneProp[];
  punchAt: (f: number) => number;
  transitionIn: TransitionType;
  transitionOut: TransitionType;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clampAbs = (a: number, m: number) => Math.max(-m, Math.min(m, a));

/** Global start frame of each scene; the first starts at 0 so the video never opens empty. */
export const sceneStarts = (p: ProjectV11) => p.scenes.map((s, i) => (i === 0 ? 0 : p.vo.words[s.fromWord].start));

export const resolveScene = (p: ProjectV11, index: number, fps: number): ResolvedScene => {
  const s = p.scenes[index];
  const starts = sceneStarts(p);
  const from = starts[index];
  const duration = (starts[index + 1] ?? p.meta.durationInFrames) - from;
  const words = p.vo.words;
  /** Scene frame of a word; the scene's first word maps to 0. */
  const wf = (w: number) => (w === s.fromWord ? 0 : words[w].start - from);
  const exitAt = (w: number) => (w >= s.toWord ? Infinity : words[w + 1].start - from - ENTER);
  const enterAt = (w: number) => (w <= s.fromWord ? -Infinity : wf(w) - ENTER);
  const presence = (inF: number, outF: number) => (f: number) =>
    (inF === -Infinity ? 1 : clamp01(springStep((f - inF) / fps, SPRINGS.arm))) *
    (outF === Infinity ? 1 : clamp01(1 - springStep((f - outF) / fps, SPRINGS.eyes)));

  // Camera
  const keys = s.camera.keys
    .map((k) => ({ frame: wf(k.atWord), pos: k.pos, lookAt: k.lookAt, fov: k.fov }))
    .sort((a, b) => a.frame - b.frame);
  const track: TrackSpec = {
    keys: densify(keys, fps),
    seed: index * 7919 + 13,
    handheld: CAMERA.handheld * (s.camera.handheld ?? 1),
    leadSec: s.camera.leadSec,
    shakes: (s.camera.shake ?? []).map((k) => ({ frame: wf(k.atWord), strength: k.strength })),
  };

  // Positions and facing first: gaze needs everyone's.
  const defs = new Map(p.cast.map((c) => [c.id, c.x_def ?? { preset: "everyman" as const }]));
  const motion = s.performances.map((perf) => {
    const locos = perf.locomotion ?? [];
    const axis = (c: number) => [{ frame: -1e6, value: perf.pos[c] }, ...locos.map((l) => ({ frame: wf(l.fromWord), value: l.to[c] }))];
    const walkSec = Math.max(0.3, ...locos.map((l) => (wf(l.toWord) - wf(l.fromWord)) / fps));
    const posAt = (f: number): Vec3 => [0, 1, 2].map((c) => springTrack(f, fps, axis(c), SPRINGS.body, walkSec)) as Vec3;
    const facingKeys = [{ frame: -1e6, value: perf.facing }, ...(perf.x_facing ?? []).slice(1).map((k) => ({ frame: wf(k.atWord), value: k.facing }))];
    const facingAt = (f: number) => springTrack(f, fps, facingKeys, SPRINGS.body);
    const legsAt = (f: number) => {
      const a = posAt(f);
      const b = posAt(f - 1);
      const amp = Math.min(0.45, Math.hypot(a[0] - b[0], a[2] - b[2]) * 18);
      return { legL: Math.sin(f * 0.45) * amp, legR: -Math.sin(f * 0.45) * amp };
    };
    const [p0, p1] = perf.x_present ?? [s.fromWord, s.toWord];
    return { perf, posAt, facingAt, legsAt, scaleAt: presence(enterAt(p0), exitAt(p1)) };
  });
  const byId = new Map(motion.map((m) => [m.perf.cast, m]));
  const propAt = (name: string) => s.x_props?.find((x) => `prop.${x.name}` === name)?.place.at;

  const cast: SceneCast[] = motion.map(({ perf, posAt, facingAt, legsAt, scaleAt }) => {
    const seed = perf.seed;
    const acts = perf.x_actions?.length ? perf.x_actions : [{ atWord: s.fromWord, action: "idle" }];
    const actions: ActionSpan[] = acts.map((a, k) => {
      const start = k === 0 ? 0 : wf(a.atWord);
      const end = k + 1 < acts.length ? wf(acts[k + 1].atWord) : duration;
      return { action: a.action, from: start, duration: Math.max(1, end - start) };
    });

    const yawTo = (point: Vec3, f: number, cheat: number, max: number) => {
      const me = posAt(f);
      return clampAbs(wrap(Math.atan2(point[0] - me[0], point[2] - me[2]) - facingAt(f)) * cheat, max);
    };
    const gaze: GazeKey[] = [];
    for (const [i, g] of (perf.gaze ?? []).entries()) {
      const frame = Math.max(0, wf(g.atWord) + (g.reactDelay ?? 0));
      const prev = gaze[gaze.length - 1] ?? { yaw: 0, pitch: 0 };
      let key: GazeKey;
      if (g.target === "camera") key = { frame, yaw: yawTo(trackAt(frame, fps, track).pos, frame, 1, 1.1) };
      else if (g.target === "down") key = { frame, yaw: prev.yaw, pitch: 0.35 };
      else if (g.target === "up") key = { frame, yaw: prev.yaw, pitch: -0.25 };
      else if (g.target === "away") key = { frame, yaw: clampAbs(prev.yaw + (random(`away-${seed}-${i}`) < 0.5 ? -0.28 : 0.28), 1.1), pitch: 0.06 };
      else if (g.target.startsWith("cast.")) {
        const other = byId.get(g.target);
        key = { frame, yaw: other ? yawTo(other.posAt(frame), frame, TOWARD_CHEAT, TOWARD_MAX) : prev.yaw };
      } else {
        const at = propAt(g.target);
        key = { frame, yaw: at ? yawTo(at, frame, TOWARD_CHEAT, TOWARD_MAX) : prev.yaw };
      }
      gaze.push(key);
    }
    gaze.sort((a, b) => a.frame - b.frame);

    const ranges = speakRanges(perf);
    const speaks = ranges.flatMap(([a, b]) =>
      Array.from({ length: b - a + 1 }, (_, k) => ({ w: words[a + k].w, start: words[a + k].start - from, end: words[a + k].end - from })));

    return {
      id: perf.cast.replace(/^cast\./, ""),
      def: defs.get(perf.cast)!,
      posAt,
      facingAt,
      scaleAt,
      legsAt,
      perf: {
        seed,
        energy: perf.energy,
        actions,
        gaze,
        gestures: (perf.gestures ?? []).map((g) => ({ pose: g.pose, arm: g.arm, hitFrame: wf(g.atWord), hold: g.hold })),
        speaks,
        stress: (perf.stress ?? []).map((w) => words[w].start - from),
        expressions: (perf.expressions ?? []).map((e, k) => ({
          frame: k === 0 ? 0 : wf(e.atWord),
          face: (EXPRESSION_FACE[e.expr as Expression] ?? e.expr) as FaceName,
        })),
      },
    };
  });

  const props: SceneProp[] = (s.x_props ?? []).map((x, i) => {
    const start = wf(x.fromWord);
    const zero = (x.startWord === x.fromWord ? start : wf(x.startWord)) + (x.startOffset ?? 0);
    return {
      key: `${x.name}-${i}`,
      name: x.name,
      place: x.place,
      from: start,
      to: x.toWord >= s.toWord ? duration : words[x.toWord + 1].start - from,
      zero,
      scaleAt: presence(enterAt(x.fromWord), exitAt(x.toWord)),
    };
  });

  const punches = (s.x_emphasis ?? []).map((w) => wf(w));
  const punchAt = (f: number) =>
    1 + PUNCH * punches.reduce((a, e) => a + springTrack(f, fps, [{ frame: -1e6, value: 0 }, { frame: e, value: 1 }, { frame: e + PUNCH_HOLD, value: 0 }], SPRINGS.head), 0);

  return {
    id: s.id,
    from,
    duration,
    set: p.sets.find((x) => x.id === s.set)?.x_set ?? s.set.replace(/^set\./, ""),
    lighting: s.x_lighting ?? "warm-key",
    track,
    cast,
    props,
    punchAt,
    transitionIn: index > 0 ? p.scenes[index - 1].transitionOut?.type ?? "CUT" : "CUT",
    transitionOut: s.transitionOut?.type ?? "CUT",
  };
};
