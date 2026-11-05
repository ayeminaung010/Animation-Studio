import assert from "node:assert/strict";
import test from "node:test";
import { planPrompt, producePrompt, retryPrompt, revisePrompt, STUDIO_APPEND } from "../server/prompts.ts";
import type { Job } from "../server/types.ts";

const base: Job = {
  id: "j1",
  slug: "bus-story",
  engine: "remotion",
  idea: "The bus that never came",
  seconds: 60,
  phase: "plan",
  status: "running",
  costUsd: 0,
  createdAt: 0,
  phaseStartedAt: 0,
};
const lemo: Job = { ...base, engine: "lemo", style: "blueprint", seconds: 45, slug: "bus-film" };

test("STUDIO_APPEND rules", () => {
  assert.match(STUDIO_APPEND, /never ask/i);
  assert.match(STUDIO_APPEND, /npm run clean/);
  assert.match(STUDIO_APPEND, /headless/i);
  assert.match(STUDIO_APPEND, /commit/i);
  assert.match(STUDIO_APPEND, /final message/i);
  assert.match(STUDIO_APPEND, /report/i);
});

test("planPrompt remotion", () => {
  const p = planPrompt(base);
  assert.match(p, /niche\/TOON-3D\.md/);
  assert.match(p, /AUTOPILOT/);
  assert.ok(p.includes('{"topic": "The bus that never came", "duration": 60, "aspect": "9:16"}'));
  assert.match(p, /episodes\/bus-story\/project\.json/);
  assert.match(p, /episodes\/bus-story\/PLAN\.md/);
  assert.match(p, /title/i);
  assert.match(p, /logline/i);
  assert.match(p, /Like and subscribe for more\./);
  assert.match(p, /Do not record voice or render\. Stop after PLAN\.md\./);
});

test("planPrompt lemo", () => {
  const p = planPrompt(lemo);
  assert.match(p, /lemo-opuscar/);
  assert.match(p, /blueprint/);
  assert.match(p, /~45 s/);
  assert.match(p, /1080x1920/);
  assert.match(p, /English/);
  assert.match(p, /studio-data\/films\/bus-film/);
  assert.match(p, /studio\/lemo-kit\/README\.md/);
  assert.match(p, /no storyboard stop/);
  assert.match(p, /Stop after TREATMENT\.md and three style frames in stills\//);
  assert.match(p, /@InkwellLife/);
  assert.match(p, /Like and subscribe for more\./);
});

test("producePrompt remotion runs the steps in order", () => {
  const p = producePrompt(base);
  assert.match(p, /approved/i);
  const steps = [
    "npm run voice -- bus-story",
    "python3 tools/tighten_vo.py bus-story",
    "node tools/run-ts.mjs tools/check-project.ts bus-story --words",
    "src/Root.tsx",
    "paintbrush-submarine",
    "npm run check",
    "npm run stills -- bus-story",
    "npm run mix:check -- bus-story",
    "npm run render -- bus-story",
    "npm run qa -- bus-story",
  ];
  let at = -1;
  for (const s of steps) {
    const i = p.indexOf(s, at + 1);
    assert.ok(i > at, `missing or out of order: ${s}`);
    at = i;
  }
  assert.match(p, /re-run the failed step/i);
});

test("producePrompt lemo", () => {
  const p = producePrompt(lemo);
  assert.match(p, /DIRECTOR\.md/);
  assert.match(p, /§11/);
  assert.match(p, /studio\/lemo-kit\/master\.sh/);
  assert.match(p, /studio-data\/films\/bus-film\/bus-film\.mp4/);
});

test("notes are included under User notes:", () => {
  assert.ok(producePrompt(base, "make it shorter").includes("User notes:\nmake it shorter"));
  assert.ok(producePrompt(lemo, "make it shorter").includes("User notes:\nmake it shorter"));
  assert.ok(!producePrompt(base).includes("User notes:"));
});

test("revisePrompt and retryPrompt", () => {
  const r = revisePrompt(base, "less dark");
  assert.match(r, /less dark/);
  assert.match(r, /Update the plan and the stills, then stop again before production\./);
  assert.match(
    retryPrompt(base),
    /The previous run was interrupted\. Check what already exists and continue the plan phase from there\./,
  );
  assert.match(
    retryPrompt({ ...base, phase: "produce" }),
    /continue the produce phase from there\./,
  );
});
