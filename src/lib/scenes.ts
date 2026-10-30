// Engine contract v1.1 (motion-upgrade/engine/PROMPT_ENGINE.md, PART THREE) and its validator.
// Word indices (atWord/fromWord/toWord) index vo.words; frames are only resolved at render time.
// Fields starting with `x_` are this engine's extensions: staging the contract can't express
// (prop placements, base actions, per-shot facing). Migrated v1 episodes use them; agents may omit them.
import { FACES, LIGHTINGS, type CharacterDef, type FaceName, type LightingName, type Vec3 } from "./shots";
import type { Placement } from "./staging";
import { GESTURE_POSES, type GesturePose } from "../motion/gestures";
import { TRANSITION_TYPES, type TransitionType } from "../motion/Transition";

export const EXPRESSIONS = ["smug", "laugh", "grin", "scoff", "angry", "worried", "shock", "deadpan", "sleepy", "determined"] as const;
export type Expression = (typeof EXPRESSIONS)[number];
/** Contract expressions on our 10 faces. Our own face names are accepted as-is (migration keeps them). */
export const EXPRESSION_FACE: Record<Expression, FaceName> = {
  smug: "smug", laugh: "happy", grin: "happy", scoff: "suspicious", angry: "angry",
  worried: "scared", shock: "shocked", deadpan: "blank", sleepy: "blank", determined: "angry",
};
export const GAZE_WORDS = ["camera", "down", "up", "away"] as const;
export const PACINGS = ["PUNCH", "BREATHE", "LAND"] as const;

export interface WordV11 {
  w: string;
  /** Frames. */
  start: number;
  end: number;
}

export interface CastV11 {
  id: string;
  role?: string;
  lock?: string;
  rig?: unknown;
  defaultExpression?: string;
  /** Our rig look (presets, hair, outfit). */
  x_def?: CharacterDef;
}

export interface SetV11 {
  id: string;
  era?: string;
  description?: string;
  grade?: string;
  assets?: string[];
  /** Our set library name (src/sets). */
  x_set?: string;
}

export interface CameraKeyV11 {
  atWord: number;
  move?: string;
  pos: Vec3;
  lookAt: Vec3;
  fov: number;
}

export interface PerformanceV11 {
  cast: string;
  seed: number;
  /** World units. */
  pos: Vec3;
  facing: number;
  energy: number;
  speaks: boolean;
  /** Inclusive word ranges this character speaks. */
  speakWords?: [number, number] | [number, number][];
  stress?: number[];
  gaze?: { atWord: number; target: string; reactDelay?: number }[];
  gestures?: { atWord: number; arm?: "L" | "R" | "both"; pose: GesturePose; hold?: number }[];
  expressions?: { atWord: number; expr: Expression | FaceName }[];
  locomotion?: { fromWord: number; toWord: number; to: Vec3; gait: string }[];
  /** Base body poses from src/components/actions.ts, each from its word on. */
  x_actions?: { atWord: number; action: string }[];
  x_facing?: { atWord: number; facing: number }[];
  /** On set only for these words (inclusive); enters/exits with a quick scale spring. */
  x_present?: [number, number];
}

export interface SceneV11 {
  id: string;
  set: string;
  grade?: string;
  fromWord: number;
  toWord: number;
  camera: {
    keys: CameraKeyV11[];
    leadSec?: number;
    handheld?: number;
    shake?: { atWord: number; strength: number }[];
  };
  performances: PerformanceV11[];
  fx?: { type: string; atWord: number }[];
  sfx?: { cue: string; atWord: number; gainDb?: number }[];
  transitionOut?: { type: TransitionType; via?: string | null; durationInFrames?: number };
  x_lighting?: LightingName;
  /** Prop occurrences with our placements; `startWord`/`startOffset` = the prop animation's frame 0. */
  x_props?: { name: string; place: Placement; fromWord: number; toWord: number; startWord: number; startOffset?: number }[];
  /** Words that get the emphasis punch. */
  x_emphasis?: number[];
}

export interface ProjectV11 {
  meta: {
    title: string;
    slug: string;
    aspect?: string;
    width: number;
    height: number;
    fps: number;
    durationInFrames: number;
    wps?: number;
    targetSec: number;
    truth?: string;
    sources?: string[];
  };
  style?: unknown;
  cast: CastV11[];
  sets: SetV11[];
  props?: { id: string; source?: string; generatePrompt?: string; diegeticText?: string[] }[];
  vo: { voice?: string; maxSpeed?: number; direction?: string; script?: string; words: WordV11[] };
  beats?: { id: string; label: string; pacing?: (typeof PACINGS)[number]; text?: string; fromWord: number; toWord: number }[];
  scenes: SceneV11[];
  captions?: unknown;
  audio?: unknown;
  covers?: unknown;
}

/** Hard cuts (scene changes that are CUT or MATCH) — the ≤ 5 per 60 s budget. */
export const isHardCut = (t: TransitionType | undefined) => t === undefined || t === "CUT" || t === "MATCH";

export const speakRanges = (p: PerformanceV11): [number, number][] =>
  !p.speakWords ? [] : typeof p.speakWords[0] === "number" ? [p.speakWords as [number, number]] : (p.speakWords as [number, number][]);

/** Fails loudly (all problems at once) on unknown IDs, gaps in the word ranges, or missing performances. */
export const validateProject = (p: ProjectV11): ProjectV11 => {
  const errors: string[] = [];
  const nWords = p.vo?.words?.length ?? 0;
  if (!nWords) errors.push("vo.words is empty");
  const cast = new Set(p.cast.map((c) => c.id));
  const sets = new Set(p.sets.map((s) => s.id));
  const props = new Set((p.props ?? []).map((x) => x.id));
  const idOk = (id: string) =>
    (GAZE_WORDS as readonly string[]).includes(id) || (id.startsWith("cast.") ? cast.has(id) : id.startsWith("prop.") ? props.has(id) : false);

  if (!p.scenes?.length) errors.push("scenes is empty");
  p.scenes.forEach((s, i) => {
    const at = `scene ${s.id}`;
    const inScene = (w: number, what: string) => {
      if (!Number.isInteger(w) || w < s.fromWord || w > s.toWord) errors.push(`${at}: ${what} word ${w} is outside ${s.fromWord}–${s.toWord}`);
    };
    const expectFrom = i === 0 ? 0 : p.scenes[i - 1].toWord + 1;
    if (s.fromWord !== expectFrom) errors.push(`${at}: fromWord ${s.fromWord}, expected ${expectFrom} (scene word ranges must be contiguous)`);
    if (s.toWord < s.fromWord) errors.push(`${at}: toWord ${s.toWord} < fromWord ${s.fromWord}`);
    if (!sets.has(s.set)) errors.push(`${at}: unknown set "${s.set}"`);
    if (s.x_lighting && !(LIGHTINGS as readonly string[]).includes(s.x_lighting)) errors.push(`${at}: unknown lighting "${s.x_lighting}"`);
    if (!s.camera?.keys?.length) errors.push(`${at}: camera.keys is empty`);
    s.camera?.keys?.forEach((k) => inScene(k.atWord, "camera key"));
    s.camera?.shake?.forEach((k) => inScene(k.atWord, "shake"));
    if (s.transitionOut && !(TRANSITION_TYPES as readonly string[]).includes(s.transitionOut.type)) {
      errors.push(`${at}: unknown transition "${s.transitionOut.type}"`);
    }

    const performers = new Set<string>();
    for (const perf of s.performances) {
      const who = `${at} ${perf.cast}`;
      if (!cast.has(perf.cast)) errors.push(`${who}: unknown cast id`);
      if (performers.has(perf.cast)) errors.push(`${who}: two performances`);
      performers.add(perf.cast);
      perf.gaze?.forEach((g) => {
        inScene(g.atWord, `${perf.cast} gaze`);
        if (!idOk(g.target)) errors.push(`${who}: unknown gaze target "${g.target}"`);
      });
      perf.gestures?.forEach((g) => {
        inScene(g.atWord, `${perf.cast} gesture`);
        if (!(GESTURE_POSES as readonly string[]).includes(g.pose)) errors.push(`${who}: unknown gesture "${g.pose}"`);
      });
      perf.expressions?.forEach((e) => {
        inScene(e.atWord, `${perf.cast} expression`);
        if (![...EXPRESSIONS, ...FACES].includes(e.expr)) errors.push(`${who}: unknown expression "${e.expr}"`);
      });
      perf.stress?.forEach((w) => inScene(w, `${perf.cast} stress`));
      speakRanges(perf).forEach(([a, b]) => { inScene(a, `${perf.cast} speakWords`); inScene(b, `${perf.cast} speakWords`); });
      perf.locomotion?.forEach((l) => { inScene(l.fromWord, `${perf.cast} locomotion`); inScene(l.toWord, `${perf.cast} locomotion`); });
      perf.x_actions?.forEach((a) => inScene(a.atWord, `${perf.cast} action`));
    }
    // Everyone the scene points at must be performing in it.
    const referenced = [
      ...s.performances.flatMap((perf) => (perf.gaze ?? []).map((g) => g.target).filter((t) => t.startsWith("cast."))),
      ...(s.x_props ?? []).flatMap((x) => (x.place.char ? [`cast.${x.place.char}`] : [])),
    ];
    for (const id of new Set(referenced)) {
      if (!performers.has(id)) errors.push(`${at}: ${id} is in frame (looked at or holding a prop) but has no performance`);
    }
  });
  const last = p.scenes[p.scenes.length - 1];
  if (last && last.toWord !== nWords - 1) errors.push(`last scene ends at word ${last.toWord}, but vo.words has ${nWords} words`);
  if (errors.length) throw new Error(`Project "${p.meta?.slug}" is invalid:\n- ${errors.join("\n- ")}`);
  return p;
};
