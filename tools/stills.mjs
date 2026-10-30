// Render review stills: one frame per shot (at a chosen point in each shot) from a single bundle.
// usage: node tools/stills.mjs <composition> [at=0.5] [shotIds,comma,separated]
// env: REMOTION_BROWSER (Chrome/Chromium path), REMOTION_GL (default "angle"; use "swangle" with no GPU)
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";

const [comp, atArg = "0.5", only = ""] = process.argv.slice(2);
const at = Number(atArg);
const root = path.resolve(import.meta.dirname, "..");
const shots = JSON.parse(fs.readFileSync(path.join(root, `episodes/${comp}/03-shots.json`), "utf8")).shots;
const words = JSON.parse(fs.readFileSync(path.join(root, `episodes/${comp}/04-words.json`), "utf8"));
const fps = 30;

// Same rule as src/lib/timing.ts: shots start at their first word.
const isDash = (w) => /^[—–-]$/.test(w);
let i = 0;
const starts = shots.map((s) => {
  const f = Math.round((words[i].startMs / 1000) * fps);
  i += s.text.split(/\s+/).filter((w) => w && !isDash(w)).length;
  return f;
});
starts[0] = 0;
const end = Math.round(((words[words.length - 1].endMs + 500) / 1000) * fps);

const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts") });
const chromiumOptions = { gl: process.env.REMOTION_GL ?? "angle" };
const browserExecutable = process.env.REMOTION_BROWSER ?? null;
const composition = await selectComposition({ serveUrl, id: comp, chromiumOptions, browserExecutable });
const outDir = path.join(root, "out/stills");
fs.mkdirSync(outDir, { recursive: true });

const wanted = only ? new Set(only.split(",")) : null;
try {
  for (let k = 0; k < shots.length; k++) {
    if (wanted && !wanted.has(shots[k].id)) continue;
    const to = k + 1 < shots.length ? starts[k + 1] : end;
    const frame = Math.min(to - 1, Math.round(starts[k] + (to - starts[k]) * at));
    const output = path.join(outDir, `${shots[k].id}.png`);
    await renderStill({ composition, serveUrl, frame, output, chromiumOptions, browserExecutable, logLevel: "error" });
    console.log(`${shots[k].id} frame ${frame} → ${path.relative(root, output)}`);
  }
} finally {
  fs.rmSync(serveUrl, { recursive: true, force: true }); // the bundle is ~50 MB in the temp folder
}
