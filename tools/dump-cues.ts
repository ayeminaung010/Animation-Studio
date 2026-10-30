// Print the placed sound cues for an episode as JSON (used by tools/check_mix.py).
// usage: node tools/run-ts.mjs tools/dump-cues.ts <slug> [out/cues.json]   (no path → prints to stdout)
import fs from "node:fs";
import path from "node:path";
import { BED, placeCues, MASTER_DB, MUSIC_DB, musicDbAt } from "../src/lib/cues";
import { parseEpisode, parseWords } from "../src/lib/shots";
import { computeTimings, totalFrames } from "../src/lib/timing";

const [slug, out] = process.argv.slice(2);
// esbuild bundles every file matching these patterns, so any episode can be picked at run time
const { CUES } = await import(`../src/episodes/${slug}.cues.ts`);
const episode = parseEpisode((await import(`../episodes/${slug}/03-shots.json`)).default);
const words = parseWords((await import(`../episodes/${slug}/04-words.json`)).default);
const timings = computeTimings(episode.shots, words, episode.fps);
const frames = totalFrames(words, episode.fps);
const duck = musicDbAt(words, episode.fps);
// The motion-v2 mix: music ducks per frame over a continuous room-tone bed.
const json = JSON.stringify({
    fps: episode.fps,
    frames,
    masterDb: MASTER_DB,
    musicDb: MUSIC_DB,
    musicDbPerFrame: Array.from({ length: frames }, (_, f) => duck(f)),
    bed: { path: `public/audio/sfx/${BED.name}.wav`, db: BED.db },
    voice: `public/episodes/${slug}/voice.mp3`,
    music: `public/audio/music/${slug}.wav`,
    cues: placeCues(timings, CUES),
});
if (out) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, json);
} else {
  console.log(json);
}
