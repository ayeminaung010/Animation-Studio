import { LEMO_LIB } from "./paths.ts";
import type { Job } from "./types.ts";

const WATERMARK = "@InkwellLife";
const CLOSING_LINE = "Like and subscribe for more.";

export const STUDIO_APPEND = `You are running headless inside the Studio web app for the ${WATERMARK} channel. Nobody can answer questions while you work, so never ask: do not use AskUserQuestion and do not end a turn with a question. Where a skill, guide or prompt says to ask the user, choose a sensible default instead and state each default you chose in your final message.

Hard rules:
- Never commit, push, reset, rebase or otherwise change git history or the git index. Never run sudo. Never run \`npm run clean\`.
- Stay inside this repository and the project folder you are given. Do not touch other episodes or films.
- Every video is 1080x1920 (9:16), carries the ${WATERMARK} watermark from frame 0, and ends with the line "${CLOSING_LINE}" and the like/subscribe card.

End each phase with a short report: what was made, where (repo-relative paths), and anything you are uncertain about.`;

function notesBlock(notes?: string): string {
  return notes && notes.trim() ? `\n\nUser notes:\n${notes.trim()}` : "";
}

function planPromptRemotion(job: Job): string {
  const input = `{"topic": ${JSON.stringify(job.idea)}, "duration": ${job.seconds}, "aspect": "9:16"}`;
  return `Make a 3D Twist Shorts episode "${job.slug}" for the ${WATERMARK} channel. This is the PLAN phase.

1. Read \`niche/TOON-3D.md\` and \`AGENTS.md\`. Then run the engine in AUTOPILOT mode, exactly as if this were the first message:

AUTOPILOT: ${input}

   Run states 1 to 9 in one pass, picking the highest-scoring idea at STATE 1, with the self-checks and at most 3 retries per gate.
2. Save the validated project JSON as \`episodes/${job.slug}/project.json\`.
3. Write \`episodes/${job.slug}/PLAN.md\` for the user to approve. It contains: the title, the logline, the full narration (word for word, ending with "${CLOSING_LINE}"), and the scene list (one line per scene: what we see, who is on screen, the beat it carries). Add the report from AUTOPILOT (chosen idea, self-check results, retries, any FOLKLORE flags) at the end.
4. The episode is vertical 9:16 at 1080x1920, shows the ${WATERMARK} watermark from frame 0 and closes with the like/subscribe card while the closing line is spoken. Plan for this in the scenes.

Do not record voice or render. Stop after PLAN.md. Finish with a short report.`;
}

function planPromptLemo(job: Job): string {
  return `Make a 2D film "${job.slug}" for the ${WATERMARK} channel with the lemo-opuscar library at ${LEMO_LIB}. This is the PLAN phase.

Brief (everything is decided; there is nobody to ask, so do not run the library's question step):
- Style: \`${job.style ?? ""}\` (see \`${LEMO_LIB}/styles/${job.style ?? ""}/STYLE.md\`).
- Topic / story idea: ${job.idea}
- Length: ~${job.seconds} s, vertical 1080x1920 (pass \`--size 1080x1920\` to the render tools).
- Language: English, for voice and burned-in subtitles; also export an .srt.
- Storyboard: no storyboard stop. Do not wait for approval inside this phase.
- Project folder: \`studio-data/films/${job.slug}\` (create it and build everything there, never inside the library's \`styles/\`).

Steps:
1. Read \`${LEMO_LIB}/AGENTS.md\`, \`${LEMO_LIB}/DIRECTOR.md\` and the style's \`STYLE.md\`. Follow the Workflow and DIRECTOR.md §1-§5, with the answers above in place of the questions.
2. Read \`studio/lemo-kit/README.md\`: it describes the channel layer every ${WATERMARK} film needs (the ${WATERMARK} watermark from frame 0, the closing like/subscribe card, the caption safe area, mastering). Plan the film so it fits that layer. The narration ends with "${CLOSING_LINE}".
3. Write \`studio-data/films/${job.slug}/TREATMENT.md\` (DIRECTOR.md §4): three candidate structures and the choice, logline and arc, benchmark, shot list, beat sheet, cue map, sound design table, subtitle and title design, and the full narration word for word.
4. Render three style frames with the real drawing code into \`studio-data/films/${job.slug}/stills/\` as .jpg files, and check them against STYLE.md.

Stop after TREATMENT.md and three style frames in stills/. Do not make the voice, the music or the film yet. Finish with a short report.`;
}

export function planPrompt(job: Job): string {
  return job.engine === "remotion" ? planPromptRemotion(job) : planPromptLemo(job);
}

function producePromptRemotion(job: Job): string {
  const s = job.slug;
  return `The user approved the plan in \`episodes/${s}/PLAN.md\`. This is the PRODUCE phase: build and render "${s}". Do not change the approved story text.

Run these steps in order. After each one, check that it passed; if it fails, fix the cause and re-run the failed step before moving on.
1. \`npm run voice -- ${s}\`
2. \`python3 tools/tighten_vo.py ${s}\`
3. \`node tools/run-ts.mjs tools/check-project.ts ${s} --words\`
4. Register the composition in \`src/Root.tsx\` like \`paintbrush-submarine\` (and add the episode staging and any missing sets or props that AGENTS.md and the project's build list call for).
5. \`npm run check\` (zero type or lint errors)
6. \`npm run stills -- ${s}\`, then look at every still: both characters in frame, faces not cropped, nothing hidden, readable text, the ${WATERMARK} watermark visible.
7. \`npm run mix:check -- ${s}\`
8. \`npm run render -- ${s}\` (final file \`out/${s}.mp4\`)
9. \`npm run qa -- ${s}\`

Fix failures and re-run the failed step until every check passes. Finish with a short report: the output path, the QA result, anything uncertain.`;
}

function producePromptLemo(job: Job): string {
  const dir = `studio-data/films/${job.slug}`;
  return `The user approved the treatment in \`${dir}/TREATMENT.md\`. This is the PRODUCE phase: make the whole film "${job.slug}". Do not change the approved story and narration.

- Same brief as before: style \`${job.style ?? ""}\`, ~${job.seconds} s, 1080x1920, English voice and subtitles, no further questions (choose defaults and say which).
- Work in \`${dir}\` and follow ${LEMO_LIB}/AGENTS.md (Workflow, step Produce) and TECHNIQUE.md: voice, check, score, animation, mix, render.
- Apply the channel layer from \`studio/lemo-kit/README.md\`: the ${WATERMARK} watermark from frame 0, the closing line "${CLOSING_LINE}" with the like/subscribe card, captions inside the safe area.
- Produce through delivery per the library's DIRECTOR.md §11: run the review loop, make one fix round, and deliver poster.jpg, the .srt, TREATMENT.md, CREDITS and the source with a one-command build.sh.
- Master the final mix and file with \`studio/lemo-kit/master.sh\` (grain, about -14 LUFS, true peak below -1 dBTP).
- The final film must be \`${dir}/${job.slug}.mp4\` (1080x1920) with \`${dir}/${job.slug}.srt\` next to it. Do not write to \`out/\`: Studio copies the film there.

Fix failures and re-run the failed step. Finish with a short report: where the film is, the checks you ran, anything uncertain.`;
}

export function producePrompt(job: Job, notes?: string): string {
  const body = job.engine === "remotion" ? producePromptRemotion(job) : producePromptLemo(job);
  return body + notesBlock(notes);
}

export function revisePrompt(job: Job, notes: string): string {
  const doc = job.engine === "remotion" ? `episodes/${job.slug}/PLAN.md` : `studio-data/films/${job.slug}/TREATMENT.md`;
  return `The user did not approve the plan for "${job.slug}" yet and sent notes:

${notes.trim()}

Apply the notes to \`${doc}\`${job.engine === "remotion" ? ` and \`episodes/${job.slug}/project.json\`` : ""}. Update the plan and the stills, then stop again before production. Finish with a short report of what changed.`;
}

export function retryPrompt(job: Job): string {
  return `The previous run was interrupted. Check what already exists and continue the ${job.phase} phase from there. Do not redo finished work; re-run only the step that was cut off, and keep to the rules of that phase.`;
}
