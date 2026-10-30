// Free disk space once an episode is rendered: removes its story data, voice, music, code and review
// output, and unregisters it from src/Root.tsx. The finished out/<slug>.mp4 and the shared library
// (sfx, props, sets, fonts) are kept.
// usage: npm run clean -- <slug>          (lists what would be removed)
//        npm run clean -- <slug> --yes    (removes it)
import fs from "node:fs";
import path from "node:path";

const [slug, flag] = process.argv.slice(2);
const root = path.resolve(import.meta.dirname, "..");
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

if (!slug || !/^[a-z0-9-]+$/.test(slug)) fail("usage: npm run clean -- <slug> [--yes]");

const targets = [
  `episodes/${slug}`,
  `public/episodes/${slug}`,
  `public/audio/music/${slug}.wav`,
  `src/episodes/${slug}.tsx`,
  `src/episodes/${slug}.cues.ts`,
  "out/stills",
  "out/qa",
  "out/cues.json",
].filter((p) => fs.existsSync(path.join(root, p)));

const rootFile = path.join(root, "src/Root.tsx");
let rootSrc = fs.readFileSync(rootFile, "utf8");
const imp = new RegExp(`^import \\{([^}]*)\\} from "\\./episodes/${slug}";\\n`, "m").exec(rootSrc);
if (imp) {
  rootSrc = rootSrc.replace(imp[0], "");
  for (const name of imp[1].split(",").map((s) => s.trim())) {
    rootSrc = rootSrc.replace(new RegExp(`\\n\\s*<Composition\\b[^>]*component=\\{${name}\\}[^>]*/>`), "");
  }
}

if (!targets.length && !imp) fail(`nothing to clean for "${slug}".`);
const size = (p) => {
  const st = fs.statSync(p);
  return st.isDirectory() ? fs.readdirSync(p).reduce((n, f) => n + size(path.join(p, f)), 0) : st.size;
};
for (const p of targets) console.log(`  ${p}  (${(size(path.join(root, p)) / 1e6).toFixed(1)} MB)`);
if (imp) console.log("  src/Root.tsx: unregister the episode");
const hasMp4 = fs.existsSync(path.join(root, `out/${slug}.mp4`));
if (!hasMp4) console.log(`\n  warning: out/${slug}.mp4 not found; after cleaning the episode can't be rendered again.`);

if (flag !== "--yes") {
  console.log(`\nNothing removed yet. Run: npm run clean -- ${slug} --yes`);
  process.exit(0);
}
for (const p of targets) fs.rmSync(path.join(root, p), { recursive: true, force: true });
if (imp) fs.writeFileSync(rootFile, rootSrc);
if (rootSrc.includes(`./episodes/${slug}`)) console.log("warning: src/Root.tsx still mentions the episode; fix by hand.");
console.log(`Cleaned ${slug}.${hasMp4 ? ` Kept out/${slug}.mp4.` : ""}`);
