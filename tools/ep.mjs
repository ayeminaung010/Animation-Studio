// One entry point so every npm script takes the episode slug.
// usage: npm run <render|render:draft|stills|audio|voice|mix:check|qa> -- <slug> [extra args]
// MOTION=v1|v2 picks the motion version for render/render:draft/qa (output out/<slug>-<motion>.mp4);
// without it the composition's default renders to out/<slug>.mp4.
import { execFileSync } from "node:child_process";

const [task, slug, ...rest] = process.argv.slice(2);
if (!slug) {
  console.error(`usage: npm run ${task} -- <slug>`);
  process.exit(1);
}
const win = process.platform === "win32";
const py = win ? "py" : "python3";
const motion = process.env.MOTION;
const name = motion ? `${slug}-${motion}` : slug;
const mp4 = `out/${name}.mp4`;
const props = motion ? [`--props=${JSON.stringify({ motion })}`] : [];

const steps = {
  render: [["npx", "remotion", "render", "src/index.ts", slug, mp4, "--codec=h264", "--crf=18", "--x264-preset=veryfast", ...props, ...rest]],
  // Half size, fast encode: for checking motion and timing, not for upload.
  "render:draft": [["npx", "remotion", "render", "src/index.ts", slug, `out/${name}-draft.mp4`, "--codec=h264", "--crf=28",
    "--x264-preset=ultrafast", "--scale=0.5", ...props, ...rest]],
  stills: [["node", "tools/stills.mjs", slug, ...(rest.length ? rest : ["0.6"])]],
  audio: [[py, "tools/make_audio.py", slug]],
  voice: [[py, "tools/speko_voice.py", slug]],
  "mix:check": [
    ["node", "tools/run-ts.mjs", "tools/dump-cues.ts", slug, "out/cues.json"],
    [py, "tools/check_mix.py", "out/cues.json", ...rest],
  ],
  // Producer checklist, then motion QA (cuts, takes, frozen frames, abrupt starts, audio gaps, runtime).
  qa: [[py, "tools/qa.py", slug, mp4], [py, "motion-upgrade/tools/motion_qa.py", mp4, "--target-sec", "60", ...rest]],
}[task];
if (!steps) {
  console.error(`unknown task "${task}" (render, render:draft, stills, audio, voice, mix:check, qa)`);
  process.exit(1);
}

// QA runs every step and reports the worst result; other tasks stop at the first failure.
let status = 0;
for (const [cmd, ...args] of steps) {
  try {
    execFileSync(cmd, args, { stdio: "inherit", shell: win }); // Windows needs a shell to find npx/py
  } catch (e) {
    status = e.status ?? 1;
    if (task !== "qa") process.exit(status);
  }
}
process.exit(status);
