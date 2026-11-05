// A hand-written engine-contract project.json (niche/TOON-3D.md) → a validated ProjectV11 in world units.
// The contract measures in rig heights (the rig is 1.0 tall); ours is ≈ 1.75 world units tall,
// so every world position (performances, walks, camera, free-standing props) is scaled once here.
import type { LightingName, Vec3, Word } from "./shots";
import { validateProject, type ProjectV11 } from "./scenes";

export const CONTRACT_UNIT = 1.75;

/** The contract's colour grades on our four lighting rigs. */
const GRADE_LIGHTING: Record<string, LightingName> = {
  day_warm: "warm-key",
  golden: "warm-key",
  storm_blue: "cold-blue",
  night_drama: "red-rim",
};

const k = (v: Vec3): Vec3 => [v[0] * CONTRACT_UNIT, v[1] * CONTRACT_UNIT, v[2] * CONTRACT_UNIT];

export const loadProject = (json: unknown): ProjectV11 => {
  const p = structuredClone(json) as ProjectV11;
  for (const s of p.scenes) {
    s.x_lighting ??= GRADE_LIGHTING[s.grade ?? ""] ?? "warm-key";
    s.camera.keys = s.camera.keys.map((key) => ({ ...key, pos: k(key.pos), lookAt: k(key.lookAt) }));
    for (const perf of s.performances) {
      perf.pos = k(perf.pos);
      perf.locomotion = perf.locomotion?.map((l) => ({ ...l, to: k(l.to) }));
    }
    // Held props keep their slot offsets; free-standing ones are placed in contract units.
    s.x_props = s.x_props?.map((x) => (x.place.char || !x.place.at ? x : { ...x, place: { ...x.place, at: k(x.place.at) } }));
  }
  return validateProject(p);
};

/** vo.words (frames) → caption words (ms). */
export const captionWords = (p: ProjectV11): Word[] =>
  p.vo.words.map((w) => ({ text: w.w, startMs: (w.start / p.meta.fps) * 1000, endMs: (w.end / p.meta.fps) * 1000 }));
