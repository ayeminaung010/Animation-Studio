// src/episodes/ice-king.cues.ts: when each sound lands (pure data, tools read it too).
import type { CueSheet } from "../lib/cues";

/** Unlisted sounds start on the shot's first frame. `at`: frame, { word, offset }, or (t) => frame. */
export const CUES: CueSheet = {
  s01: { "ice-thunk": { at: { word: "ice" } } },
  s02: { "crowd-laugh": { at: { word: "laughing", offset: -4 } } },
  s05: { "soft-pat": { at: { word: "pats" } } },
  s06: { "hammer-knock": { at: { word: "building", offset: -6 } } },
  // Three "Drip" words: one drop on each (word lookup would only find the first).
  s09: { "water-drip": [0, 1, 2].map((i) => ({ at: (t) => t.words[i].start })) },
  s11: { "egg-sizzle": { at: { word: "fries" } } },
  s12: { "hatch-slam": { at: { word: "shut", offset: 5 }, db: -12 } },
  s14: { "hollow-clink": { at: { word: "solid" }, db: -11 } },
  s17: { "hollow-clink": { at: { word: "free" } } },
  s21: { "hollow-clink": { at: { word: "taste" } }, "tv-crowd-cheer": { at: { word: "hooked" } } },
  s23: { "coin-drop": { at: { word: "buying" } } },
};
