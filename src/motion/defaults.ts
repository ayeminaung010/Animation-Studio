// Defaults shared by the v1 → v2 migration and the scene resolver.
import { random } from "remotion";

/** Stable per-character seed, so a character idles the same way in every scene. */
export const seedFor = (id: string) => Math.floor(random(`seed-${id}`) * 100000);

/**
 * Looks at another character are scaled down and capped: layout `facing` already turns people
 * toward each other, and a full turn puts faces in profile (v2 stills: s04, s17, s23).
 */
export const TOWARD_CHEAT = 0.45;
export const TOWARD_MAX = 0.65;
