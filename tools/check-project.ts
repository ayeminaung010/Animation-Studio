// Packager/QA check for a v1.1 project.json (niche/TOON-3D.md, STATE 9).
// Usage: node tools/run-ts.mjs tools/check-project.ts <slug> [--estimate]
//   --estimate  fills an empty vo.words with pre-TTS timings from the beat % table (overwrite with align_words.py later).
//   --words     takes vo.words from the TTS alignment (episodes/<slug>/04-words.json) and fits durationInFrames to it.
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { isHardCut, validateProject, type ProjectV11 } from "../src/lib/scenes";

const BEAT_PCT = [0, 5, 12, 20, 33, 55, 70, 85, 100];

export const estimateWords = (p: ProjectV11) => {
  const tokens = (p.vo.script ?? "").split(/\s+/).filter(Boolean);
  const beats = p.beats ?? [];
  assert.equal(beats.length, 8, "estimate needs the 8 beats");
  const words: ProjectV11["vo"]["words"] = [];
  beats.forEach((b, i) => {
    const f0 = (BEAT_PCT[i] / 100) * p.meta.durationInFrames;
    const f1 = (BEAT_PCT[i + 1] / 100) * p.meta.durationInFrames;
    const n = b.toWord - b.fromWord + 1;
    for (let k = 0; k < n; k++) {
      const w = tokens[b.fromWord + k];
      assert.ok(w, `beat ${b.id} runs past the script`);
      words.push({ w, start: Math.round(f0 + ((f1 - f0) * k) / n), end: Math.round(f0 + ((f1 - f0) * (k + 1)) / n) });
    }
  });
  assert.equal(words.length, tokens.length, "beat word ranges must cover the script exactly");
  return words;
};

export const checkProject = (p: ProjectV11) => {
  const fails: string[] = [];
  const fps = p.meta.fps;
  const W = p.vo.words;
  const sec = (a: number, b: number) => (W[b].end - W[a].start) / fps;
  const at = (w: number) => W[w].start / fps;

  const tokens = (p.vo.script ?? "").split(/\s+/).filter(Boolean);
  if (tokens.join(" ") !== W.map((w) => w.w).join(" ")) fails.push("vo.words differ from vo.script");

  const changes = p.scenes.length - 1;
  const hard = p.scenes.slice(0, -1).filter((s) => isHardCut(s.transitionOut?.type)).length;
  const runtime = W[W.length - 1].end / fps;
  const perMin = (changes / runtime) * 60;
  if (perMin > 5) fails.push(`${changes} scene changes = ${perMin.toFixed(1)}/min (> 5)`);
  const lens = p.scenes.map((s) => sec(s.fromWord, s.toWord));
  const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
  if (avg < 8) fails.push(`average scene ${avg.toFixed(1)} s (< 8)`);
  if (runtime > p.meta.targetSec * 1.05) fails.push(`runtime ${runtime.toFixed(1)} s > target + 5%`);
  for (let i = 1; i < W.length; i++) {
    const gap = (W[i].start - W[i - 1].end) / fps;
    if (gap > 0.25) fails.push(`VO gap ${gap.toFixed(2)} s before word ${i} "${W[i].w}"`);
  }

  const hero = p.cast.find((c) => c.role === "hero")?.id;
  const payoff = p.beats?.[p.beats.length - 1]?.fromWord ?? Infinity;
  p.scenes.forEach((s, i) => {
    const n = s.camera.keys.length;
    if (n < 3 || n > 6) fails.push(`${s.id}: ${n} camera keys (3–6)`);
    const end = at(s.toWord) + (W[s.toWord].end - W[s.toWord].start) / fps;
    for (const perf of s.performances) {
      const who = `${s.id} ${perf.cast}`;
      const marks = [at(s.fromWord), ...(perf.gaze ?? []).map((g) => at(g.atWord)), end].sort((a, b) => a - b);
      const worst = Math.max(...marks.slice(1).map((t, k) => t - marks[k]));
      if (worst > 4.05) fails.push(`${who}: ${worst.toFixed(1)} s without a gaze change`);
      (perf.gaze ?? []).forEach((g) => {
        if (g.reactDelay !== undefined && (g.reactDelay < 6 || g.reactDelay > 10)) fails.push(`${who}: reactDelay ${g.reactDelay}`);
      });
      const gs = (perf.gestures ?? []).map((g) => at(g.atWord));
      gs.slice(1).forEach((t, k) => { if (t - gs[k] < 2 - 1e-6) fails.push(`${who}: gestures ${(t - gs[k]).toFixed(1)} s apart (< 2)`); });
      if (perf.cast === hero) {
        (perf.expressions ?? []).filter((e) => e.atWord < payoff && e.expr !== "smug").forEach((e) =>
          fails.push(`${who}: "${e.expr}" at word ${e.atWord}, before the payoff`));
      }
    }
    if (i < p.scenes.length - 1 && !s.transitionOut) fails.push(`${s.id}: no transitionOut`);
  });
  return { fails, changes, hard, avg, lens, runtime };
};

{
  const slug = process.argv[2];
  if (!slug) throw new Error("usage: check-project.ts <slug> [--estimate | --words]");
  const file = `episodes/${slug}/project.json`;
  const p = JSON.parse(readFileSync(file, "utf8")) as ProjectV11;
  if (process.argv.includes("--estimate") && !p.vo.words.length) {
    p.vo.words = estimateWords(p);
    writeFileSync(file, JSON.stringify(p, null, 2) + "\n");
    console.log(`filled ${p.vo.words.length} estimated words (pre-TTS)`);
  }
  if (process.argv.includes("--words")) {
    const tts = JSON.parse(readFileSync(`episodes/${slug}/04-words.json`, "utf8")) as { text: string; startMs: number; endMs: number }[];
    const fr = (ms: number) => Math.round((ms / 1000) * p.meta.fps);
    p.vo.words = tts.map((w) => ({ w: w.text, start: fr(w.startMs), end: fr(w.endMs) }));
    // The first word owns frame 0 (no intro silence); the last frame is the last word plus a short button.
    p.vo.words[0].start = 0;
    p.meta.durationInFrames = p.vo.words[p.vo.words.length - 1].end + 6;
    writeFileSync(file, JSON.stringify(p, null, 2) + "\n");
    console.log(`took ${p.vo.words.length} TTS words, ${(p.meta.durationInFrames / p.meta.fps).toFixed(1)} s`);
  }
  validateProject(p);
  console.log("validateProject: OK");
  const r = checkProject(p);
  console.log(`runtime ${r.runtime.toFixed(1)} s · scenes ${p.scenes.length} (${r.lens.map((l) => l.toFixed(1)).join(" / ")} s) · avg ${r.avg.toFixed(1)} s · changes ${r.changes} · hard cuts ${r.hard}`);
  if (r.fails.length) {
    console.log(`FAIL\n- ${r.fails.join("\n- ")}`);
    process.exit(1);
  }
  console.log("engine checks: PASS");
}
