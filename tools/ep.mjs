// One entry point so every npm script takes the episode slug.
// usage: npm run <render|stills|audio|voice|mix:check|qa> -- <slug> [extra args]
import { execFileSync } from "node:child_process";

const [task, slug, ...rest] = process.argv.slice(2);
if (!slug) {
  console.error(`usage: npm run ${task} -- <slug>`);
  process.exit(1);
}
const win = process.platform === "win32";
const py = win ? "py" : "python3";
const mp4 = `out/${slug}.mp4`;

const steps = {
  render: [["npx", "remotion", "render", "src/index.ts", slug, mp4, "--codec=h264", "--crf=18", "--x264-preset=veryfast", ...rest]],
  stills: [["node", "tools/stills.mjs", slug, ...(rest.length ? rest : ["0.6"])]],
  audio: [[py, "tools/make_audio.py", slug]],
  voice: [[py, "tools/speko_voice.py", slug]],
  "mix:check": [
    ["node", "tools/run-ts.mjs", "tools/dump-cues.ts", slug, "out/cues.json"],
    [py, "tools/check_mix.py", "out/cues.json", ...rest],
  ],
  qa: [[py, "tools/qa.py", slug, mp4]],
}[task];
if (!steps) {
  console.error(`unknown task "${task}" (render, stills, audio, voice, mix:check, qa)`);
  process.exit(1);
}

for (const [cmd, ...args] of steps) {
  try {
    execFileSync(cmd, args, { stdio: "inherit", shell: win }); // Windows needs a shell to find npx/py
  } catch (e) {
    process.exit(e.status ?? 1);
  }
}
