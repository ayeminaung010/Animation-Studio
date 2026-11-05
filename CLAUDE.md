# Twist Shorts — instructions for coding agents

60-second narrated twist stories in stylized toon 3D, vertical 9:16. Remotion renders,
Three.js (via `@remotion/three`, React Three Fiber, drei) draws, the voice comes from TTS.
The story side (ideas, script, shot list, voice) is produced elsewhere; this repo builds and
renders it. Read `README.md` for the layout and `SETUP.md` for commands.

## Golden rules (breaking these causes flicker or drift)

- Every movement comes from the shot's local frame: `useCurrentFrame()` in `ShotView`, passed down
  as `frame` / `f`, animated with `interpolate`, `spring` or `Easing` from `remotion`.
- Never use React Three Fiber's `useFrame`, `Date.now()`, `performance.now()` or `Math.random()`.
  Randomness = `random("a-seed")` from `remotion`.
- Each shot is its own `<Sequence>`, so animation restarts at frame 0 in every shot.
- Timing comes from `episodes/<slug>/04-words.json` only (`src/lib/timing.ts`). Never hand-type a
  shot's frame numbers. `tts_pause_after_ms` is already baked into the voice file.
- Materials are created once (`useToon` / `useMemo`) and disposed on unmount.

## Where things live

- `episodes/<slug>/03-shots.json` — the shot list (story data). Don't edit story text here; it must
  equal the approved script word for word.
- `src/episodes/<slug>.tsx` — staging per shot (`LAYOUT`: prop placement, facing, camera aim,
  `frameScale`) + the composition. `src/episodes/<slug>.cues.ts` — when each sound lands.
- `src/components/` — `Character` (one rig for everyone), `Face` (10 expressions), `actions.ts`
  (poses as pure functions of frame), `CameraRig`, `Lighting`, `Shot` (renders one shot),
  `Captions`, `Soundtrack`, `toon` (`T` = toon mesh with outline, `Ink` = flat black detail).
- `src/motion/` — motion v2 (in progress, see `motion-upgrade/`): `motion-kit.ts` (copied from the
  bundle, don't edit), `useCharacterMotion.ts` (all layers for one character at one frame, on top of the
  action pose), `gestures.ts` (15 gesture poses), `defaults.ts`, `resolveScene.ts` (v1.1 scene → frames), `cameraTrack.ts` + `TrackCamera.tsx`
  (continuous camera; knobs in `CAMERA`), `Transition.tsx` (FLYOVER/THROUGH/IRIS/MATCH/FLASH/WHIP/CUT). v1 is
  untouched when `motion` is "v1" (the composition default). v2 renders `src/lib/migrate.ts` output
  (v1.1 contract, `src/lib/scenes.ts`) through `src/components/SceneView.tsx`, one `<Sequence>` per scene. Check v2 with `MOTION=v2 npm run stills -- <slug>`
  (→ `out/stills-v2/`), gesture poses with the `gesture-sheet` composition, and `npm test` after motion changes.
- `src/sets/index.tsx`, `src/props/*` — the library. New props must be registered in
  `src/props/index.tsx`; unknown names throw with a message saying where to add them.
- `tools/` — `make_audio.py` (music + SFX synthesis), `align_words.py` (transcript → words),
  `stills.mjs` (review stills), `dump-cues.ts` + `check_mix.py` (offline mix check), `qa.py`,
  `ep.mjs` (what every `npm run <task> -- <slug>` goes through).

## Conventions

- Characters face +z (towards the default camera). In shot-list `pos`, x/z are multiplied by
  `STAGE` (2.2) to get world units; y is world units.
- Arm euler: x < 0 swings the hand forward; z > 0 swings the LEFT arm (on +x) outward, z < 0 the RIGHT
  arm (on −x) outward. Get this wrong and a reach goes the wrong way.
- `outline` on `T` is a weight (0.02 ≈ 5.6 px at 1080 wide); floors and walls use `outline={false}`.
- Framings are sized for 9:16 width (`FRAME_H` in `CameraRig.tsx`). Two characters further apart
  than ~2.5 world units won't fit a medium shot: set a `target` between them or `frameScale`.
- Props that should start on a spoken word use `startAt: { word, offset }`; sounds use the same
  form in the cue sheet, so a receipt pop and its ding stay in sync.
- Dialogue: give a shot `lines: [{ speaker, text }]` (joined = `text`); each speaker's mouth moves
  only on their own words (an off-screen speaker moves no mouth). Without `lines`, every `speaking: true` character moves on all words.
- Captions sit at 55% height (motion v2: 70%, one yellow word per sentence; a console warning names
  any scene/word where the band covers a face) inside the 7–85% width safe area; keep key action out of the bottom
  20% and right 15% (YouTube buttons).
- Every episode carries the channel watermark **@InkwellLife**, from frame 0 to the end, layered above
  the picture and captions: `<GlassWatermark />` (`src/components/GlassWatermark.tsx`, frosted-glass pill,
  low opacity, top-left at 7% / 4.5%) in 3D episodes; `src/stick/Watermark.tsx` in 2D stickman episodes.
  Keep faces and key action clear of that corner.
- Every episode ends with a call to action: right after the punchline the narrator says one line, by default
  "Like and subscribe for more." (~2 s, part of the script, the word budget and the runtime target), while a small
  like/subscribe card (`<GlassCta />` in `src/components/GlassCta.tsx`, in a `<Sequence>` from the CTA's first word)
  pops in above the captions. The picture keeps moving under it (no freeze, no separate end screen), and nothing
  else follows it.
- Engine-contract episodes (`niche/TOON-3D.md`) render straight from `episodes/<slug>/project.json` through
  `loadProject` (`src/lib/project.ts`: contract units × 1.75 → world, grade → lighting); check them with
  `node tools/run-ts.mjs tools/check-project.ts <slug>` (`--words` after TTS). Voice: `npm run voice -- <slug>`,
  then `python3 tools/tighten_vo.py <slug>` to close pauses over 0.25 s before re-checking.

## Mix targets

Voice 0 dB (reference), music −21 dB (−20…−24), SFX −6…−12 dB, final true peak below −1 dBTP,
voice at least ~3 dB above music + SFX in every spoken window. `MASTER_DB` in `src/lib/cues.ts`
leaves headroom for AAC overshoot. Motion v2 ducks the music (−21 dB under the voice, +12 dB in
pauses, `musicDbAt` in `src/lib/cues.ts`) over a continuous room-tone `BED`, so the mix never drops out;
`mix:check` models the v2 mix. Check without rendering: `npm run mix:check -- <slug>`.

## Before you say you're done

1. `npm run check` — zero type or lint errors.
2. `npm run stills -- <slug>` (and `npm run stills -- <slug> 0.15` / `0.95` for shots with timed events) — look at
   every still: both characters in frame, faces not cropped, nothing hidden behind set pieces,
   readable text.
3. `npm run mix:check -- <slug>` after any audio change.
4. Rendering is done by the user on their own machine (`npm run render -- <slug>`); don't start a
   full render unless asked. `MOTION=v1|v2` picks the version (→ `out/<slug>-<motion>.mp4`),
   `npm run render:draft` renders at half size. After a render: `npm run qa -- <slug>` (same `MOTION`) runs
   `tools/qa.py` and `motion-upgrade/tools/motion_qa.py` — all checks PASS. The `motion-test` composition
   (6 s, `src/lab/MotionTest.tsx`) is the quick motion regression check. To read the whole
   render in one image: `python3 claude-video-kit/.claude/skills/video-qa/scripts/csheet.py out/<slug>.mp4 0 60 2 out/qa/sheet.jpg`.
5. Only when the user says the episode is final: `npm run clean -- <slug>`, show them the list, then
   `--yes`. Then `npm run check`.
