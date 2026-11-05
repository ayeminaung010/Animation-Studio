# Studio — one web page for both animation engines

Nov 5, 2026. Status: design for the implementation plan `docs/superpowers/plans/2026-11-05-studio-web-app.md`.
The user skipped the brainstorming questions; every choice below not quoted from them is marked **(our call)**.

## Intent

Make an episode for the @InkwellLife channel from one browser page instead of a terminal session. The user types a story
idea, picks an engine (or asks for a suggestion), and a Claude Code agent does the directing and production. The page
shows progress live, stops once for the user to approve the plan, then shows review stills and the finished video.

Two engines, one front door (the user agreed to this shape):
- **3D Twist Shorts** — this repo's Remotion + Three.js engine (`niche/TOON-3D.md` engine contract, `project.json`).
- **Lemo 2D** — the lemo-opuscar library (`~/lemo-opuscar`, 66 styles), driven through its Claude Code skill.

Both deliver the channel layer: the **@InkwellLife** watermark from frame 0 and the closing line
"Like and subscribe for more." with the like/subscribe card.

## Goals

- Start a job from an idea, engine, (lemo) style and length; slug auto-made from the idea, editable.
- Live progress: what the agent says, which tools it runs, cost so far.
- One approval gate per job: after the **plan** phase (script / treatment + a few stills) the user approves, or sends
  notes for a revision; production runs only after approval. (This keeps CLAUDE.md's "never build before the script is approved".)
- Results page: video player, stills, subtitles, plan document, cost.
- "Suggest" button: an agent picks engine + style for the idea, with a one-line reason.
- Survives page reloads (events persisted); a server restart marks running jobs failed with a Retry button.

## Non-goals

- Hosting on the internet, accounts, multiple users. Local, single user, on the Mac that renders.
- Uploading to YouTube, scheduling, analytics.
- Editing scenes by hand in the browser; the agent edits code.
- Running two jobs at once (renders compete for the GPU). **(our call)**
- Replacing the terminal workflow; Studio is a front door to the same files and commands.

## Anti-goals (failure even if it "works")

- Any web page on the internet able to reach the server and make the agent run commands.
- A job that silently hangs waiting for a permission prompt nobody can see.
- The agent committing, pushing, resetting git, or running `npm run clean` on its own.

## Constraints

- Runs on the user's Mac: Node v26 (type stripping, no build step for server code), Python, ffmpeg, Chrome headless.
- Agent: Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`), using the user's existing Claude Code login and settings
  (`settingSources: ["user","project","local"]`, so CLAUDE.md, memory and the installed lemo-opuscar plugin load).
- Only new npm dependency: `@anthropic-ai/claude-agent-sdk`. React and esbuild are already installed. **(our call)**
- Server binds `127.0.0.1` only and rejects requests whose `Host`/`Origin` is not local.
- Job data in `studio-data/` (git-ignored). Lemo films are made in `studio-data/films/<slug>/`; the final MP4 is copied to `out/<slug>.mp4`.

## Decided how (our calls)

- `studio/` folder: `server/` (node:http, SSE), `web/` (React page bundled by esbuild), `lemo-kit/` (channel layer for
  lemo films, lifted from the Early Bus test in `out/early-bus-src/`), `test/` (`node --test`).
- Two phases per job, one agent session: `plan` → (approve | revise) → `produce`; approval resumes the same session.
- 3D plan phase runs `niche/TOON-3D.md` in AUTOPILOT and writes `episodes/<slug>/PLAN.md`; lemo plan phase writes
  `TREATMENT.md` and 3 style frames.
- Agent permissions: edits auto-accepted, a fixed tool allow-list, git write commands / sudo / clean denied, and any
  other permission request denied with a message instead of waiting.

## Left to the builder

Page styling, component split inside `web/`, log formatting, exact wording of status labels.
