import fs from "node:fs";
import path from "node:path";
import { FILMS, LEMO_LIB, REPO } from "./paths.ts";
import type { Job, Outputs } from "./types.ts";

const MAX_SLUG = 40;

export function slugify(idea: string): string {
  const words = idea
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, 5);
  let slug = words.join("-").slice(0, MAX_SLUG).replace(/-+$/, "");
  if (slug.length === 0) return "episode";
  if (slug.length < 3) slug = `episode-${slug}`;
  return slug;
}

export function isSlugTaken(slug: string): boolean {
  return fs.existsSync(path.join(REPO, "episodes", slug)) || fs.existsSync(path.join(FILMS, slug));
}

export function projectDir(job: Job): string {
  return job.engine === "remotion" ? path.join(REPO, "episodes", job.slug) : path.join(FILMS, job.slug);
}

export function planDocPath(job: Job): string {
  return path.join(projectDir(job), job.engine === "remotion" ? "PLAN.md" : "TREATMENT.md");
}

function rel(abs: string): string {
  return path.relative(REPO, abs).split(path.sep).join("/");
}

function listFiles(dir: string, ext: string, minMtimeMs = 0): string[] {
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((n) => n.toLowerCase().endsWith(ext))
    .sort()
    .map((n) => path.join(dir, n))
    .filter((p) => fs.statSync(p).mtimeMs >= minMtimeMs);
}

export function findOutputs(job: Job): Outputs {
  const out: Outputs = { stills: [] };
  const dir = projectDir(job);
  const plan = planDocPath(job);
  if (fs.existsSync(plan)) out.planDoc = rel(plan);

  if (job.engine === "remotion") {
    out.stills = listFiles(path.join(REPO, "out", "stills"), ".png", job.createdAt).map(rel);
    const video = path.join(REPO, "out", `${job.slug}.mp4`);
    if (fs.existsSync(video)) out.video = rel(video);
  } else {
    out.stills = listFiles(path.join(dir, "stills"), ".jpg").map(rel);
    const video = path.join(dir, `${job.slug}.mp4`);
    if (fs.existsSync(video)) out.video = rel(video);
    const srt = path.join(dir, `${job.slug}.srt`);
    if (fs.existsSync(srt)) out.srt = rel(srt);
  }
  return out;
}

export function finalizeLemo(job: Job): void {
  const src = path.join(projectDir(job), `${job.slug}.mp4`);
  if (!fs.existsSync(src)) return;
  const outDir = path.join(REPO, "out");
  fs.mkdirSync(outDir, { recursive: true });
  fs.copyFileSync(src, path.join(outDir, `${job.slug}.mp4`));
}

export interface LemoStyle {
  slug: string;
  name: string;
  category: string;
  line: string;
  uses: string[];
}

export function listLemoStyles(lib: string = LEMO_LIB): LemoStyle[] {
  const root = path.join(lib, "styles");
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const styles: LemoStyle[] = [];
  for (const e of entries) {
    // "_template" is the scaffold for new styles, not a real one.
    if (!e.isDirectory() || e.name.startsWith("_") || e.name.startsWith(".")) continue;
    try {
      const j = JSON.parse(fs.readFileSync(path.join(root, e.name, "style.json"), "utf8"));
      if (typeof j.slug !== "string" || typeof j.en !== "string") continue;
      styles.push({
        slug: j.slug,
        name: j.en,
        category: typeof j.category_en === "string" ? j.category_en : "",
        line: typeof j.line === "string" ? j.line : "",
        uses: Array.isArray(j.uses) ? j.uses.filter((u: unknown): u is string => typeof u === "string") : [],
      });
    } catch {
      // a style folder without a readable style.json is skipped
    }
  }
  return styles.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}
