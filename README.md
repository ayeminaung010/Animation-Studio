# Twist Shorts — 3D pipeline

**New here? Start with [SETUP.md](SETUP.md).** Coding agents: read [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md).

60-second narrated twist stories in stylized toon 3D. Remotion renders, Three.js (via `@remotion/three`) draws, Speko supplies the voice.

## Layout

```
episodes/<slug>/      03-shots.json  04-words.json  04-voice-request.json   (story data, from the producer prompt)
public/episodes/<slug>/voice.mp3                                            (voiceover)
src/lib/              shots.ts (types + validation)  timing.ts (word → frame)
src/components/       Character  Face  actions  CameraRig  Lighting  Shot  toon  textures
src/sets/             reusable environments
src/props/            prop registry (+ receipts, piggy bank, buildings, furniture, items)
src/episodes/<slug>.tsx  one composition per episode: staging (LAYOUT) + one <Sequence> per shot
tools/                align_words.py (Speko transcript → 04-words.json)  stills.mjs (review stills)
```

## Rules

- Every movement comes from `useCurrentFrame()` (passed down as `frame`/`f`) with `interpolate`/`spring`.
  Never `useFrame`, `Date.now()` or unseeded `Math.random()` — use `random('seed')` from `remotion`.
- Shot timing comes from `04-words.json` only; never hand-type frame numbers.
  `tts_pause_after_ms` is already baked into the voice file.
- Animation restarts at frame 0 in every shot (each shot is its own `<Sequence>`).
- Unknown sets, props, actions, faces or framings throw with a message naming the file to edit.

## Commands

```bash
npm i
npx remotion studio                                  # preview
npx tsc --noEmit && npx eslint src                   # checks
npm run stills -- <slug>                             # one review still per shot → out/stills/
npm run render -- <slug>                             # → out/<slug>.mp4
```

No GPU (servers, CI): `export REMOTION_GL=swangle`. Custom Chrome: `export REMOTION_BROWSER=/path/to/chrome`.

## Studio

A local web page that turns a story idea into a finished episode through a Claude Code agent, on either the 3D
engine (this repo) or the lemo-opuscar 2D engine.

```bash
npm run studio          # builds studio/web/dist/app.js, then starts the server
```

Open <http://127.0.0.1:4317> (change the port with `STUDIO_PORT`). The server only listens on `127.0.0.1`.

- Needs a working `claude` login (Claude Code, the same one the terminal uses).
- Lemo jobs need `~/lemo-opuscar` set up: `setup.sh deps voice music`.
- One job runs at a time. Each job plans first, waits for your approval (or revision notes), then produces.
- Files: job data and logs in `studio-data/` (git-ignored); the finished video is `out/<slug>.mp4`;
  3D plans are `episodes/<slug>/PLAN.md`; lemo films are made in `studio-data/films/<slug>/`.
- A server restart marks a running job as failed (`server restarted`); **Retry** resumes its session.

Tests: `npm run test:studio`.

## New episode

1. Put `03-shots.json`, `04-words.json` in `episodes/<slug>/` and `voice.mp3` in `public/episodes/<slug>/`.
2. Add any new sets/props/actions the shot list's build list names.
3. Write `src/episodes/<slug>.tsx` + `<slug>.cues.ts` from the skeleton in `SETUP.md` §5, register it in `src/Root.tsx`.
