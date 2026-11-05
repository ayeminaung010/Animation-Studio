import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { Job } from "../server/types.ts";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "studio-engines-"));
process.env.STUDIO_DATA = tmp;
const { slugify, listLemoStyles, findOutputs, projectDir, planDocPath, finalizeLemo, isSlugTaken, cleanEpisode } = await import(
  "../server/engines.ts"
);
const { REPO } = await import("../server/paths.ts");

function lemoJob(slug: string): Job {
  return {
    id: "j1",
    slug,
    engine: "lemo",
    style: "blueprint",
    idea: "x",
    seconds: 30,
    phase: "plan",
    status: "running",
    costUsd: 0,
    createdAt: 0,
    phaseStartedAt: 0,
  };
}

test("slugify", () => {
  assert.equal(slugify("The Bus that Never Came!! (part 2)"), "the-bus-that-never-came");
  assert.equal(slugify("???"), "episode");
  assert.equal(slugify("Don't Panic"), "dont-panic");
  assert.ok(slugify("a".repeat(100)).length <= 40);
  assert.match(slugify("Ünïcode café trick"), /^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test("lemo styles load from a library folder", () => {
  const lib = fs.mkdtempSync(path.join(os.tmpdir(), "studio-lib-"));
  fs.mkdirSync(path.join(lib, "styles", "a"), { recursive: true });
  fs.mkdirSync(path.join(lib, "styles", "_template"), { recursive: true });
  fs.writeFileSync(
    path.join(lib, "styles", "a", "style.json"),
    JSON.stringify({ slug: "a", en: "A", category_en: "Cat", line: "l", uses: ["x"] }),
  );
  fs.writeFileSync(
    path.join(lib, "styles", "_template", "style.json"),
    JSON.stringify({ slug: "my-style", en: "My Style", category_en: "Cat", line: "l", uses: [] }),
  );
  fs.writeFileSync(path.join(lib, "styles", "README.md"), "# styles");
  assert.deepEqual(listLemoStyles(lib), [{ slug: "a", name: "A", category: "Cat", line: "l", uses: ["x"] }]);
  assert.deepEqual(listLemoStyles("/nope"), []);
});

test("lemo styles are sorted by category then name", () => {
  const lib = fs.mkdtempSync(path.join(os.tmpdir(), "studio-lib-"));
  const mk = (slug: string, en: string, category_en: string) => {
    fs.mkdirSync(path.join(lib, "styles", slug), { recursive: true });
    fs.writeFileSync(
      path.join(lib, "styles", slug, "style.json"),
      JSON.stringify({ slug, en, category_en, line: "", uses: [] }),
    );
  };
  mk("z1", "Zed", "A cat");
  mk("a1", "Alpha", "B cat");
  mk("b1", "Beta", "A cat");
  assert.deepEqual(
    listLemoStyles(lib).map((s) => s.slug),
    ["b1", "z1", "a1"],
  );
});

test("lemo paths and outputs are found in the film folder", () => {
  const job = lemoJob("t-film");
  assert.equal(projectDir(job), path.join(tmp, "films", "t-film"));
  assert.equal(planDocPath(job), path.join(tmp, "films", "t-film", "TREATMENT.md"));
  assert.equal(isSlugTaken("t-film"), false);

  const dir = path.join(tmp, "films", "t-film");
  fs.mkdirSync(path.join(dir, "stills"), { recursive: true });
  fs.writeFileSync(path.join(dir, "stills", "1.jpg"), "x");
  fs.writeFileSync(path.join(dir, "t-film.mp4"), "x");
  assert.equal(isSlugTaken("t-film"), true);

  const o = findOutputs(job);
  assert.equal(o.stills.length, 1);
  assert.match(o.video!, /t-film\.mp4$/);
  assert.equal(o.srt, undefined);
  assert.equal(o.planDoc, undefined);

  fs.writeFileSync(path.join(dir, "t-film.srt"), "x");
  fs.writeFileSync(path.join(dir, "TREATMENT.md"), "x");
  const o2 = findOutputs(job);
  assert.match(o2.srt!, /t-film\.srt$/);
  assert.match(o2.planDoc!, /TREATMENT\.md$/);
});

test("remotion paths and outputs", () => {
  const slug = "zz-engines-test";
  const job: Job = { ...lemoJob(slug), engine: "remotion", style: undefined, createdAt: Date.now() - 1000 };
  assert.equal(projectDir(job), path.join(REPO, "episodes", slug));
  assert.equal(planDocPath(job), path.join(REPO, "episodes", slug, "PLAN.md"));
  const o = findOutputs(job);
  assert.deepEqual(o, { stills: [] });
});

test("finalizeLemo copies the film to out/<slug>.mp4", () => {
  const slug = "zz-finalize-test";
  const dir = path.join(tmp, "films", slug);
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(REPO, "out", `${slug}.mp4`);
  try {
    finalizeLemo(lemoJob(slug));
    assert.equal(fs.existsSync(target), false, "nothing to copy yet");
    fs.writeFileSync(path.join(dir, `${slug}.mp4`), "video");
    finalizeLemo(lemoJob(slug));
    assert.equal(fs.readFileSync(target, "utf8"), "video");
  } finally {
    fs.rmSync(target, { force: true });
  }
});

test("cleanEpisode keeps only a lemo film's video and subtitles", async () => {
  const job = lemoJob("tidy-film");
  const dir = projectDir(job);
  fs.mkdirSync(path.join(dir, "stills"), { recursive: true });
  for (const f of ["tidy-film.mp4", "tidy-film.srt", "TREATMENT.md", "stills/a.jpg"]) fs.writeFileSync(path.join(dir, f), "x");
  await cleanEpisode(job);
  assert.deepEqual(fs.readdirSync(dir).sort(), ["tidy-film.mp4", "tidy-film.srt"]);
});

test("cleanEpisode discard removes a whole lemo film, and is fine with nothing to clean", async () => {
  const job = lemoJob("dropped-film");
  fs.mkdirSync(projectDir(job), { recursive: true });
  fs.writeFileSync(path.join(projectDir(job), "TREATMENT.md"), "x");
  await cleanEpisode(job, true);
  assert.ok(!fs.existsSync(projectDir(job)));
  await cleanEpisode(job, true);
  await cleanEpisode({ ...job, engine: "remotion", slug: "no-such-episode-zz" }, true);
});
