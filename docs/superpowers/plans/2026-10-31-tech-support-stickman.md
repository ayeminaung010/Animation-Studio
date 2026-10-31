# Tech Support (2D stickman) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A ~90 s vertical 2D-line-stickman comedy Short, "Tech Support", built and checked in this repo, ready for the user to render.

**Architecture:** Story data uses the existing v1 shot-list pipeline (`03-shots.json` + `04-words.json` → `computeTimings`, `.cues.ts` → `placeCues`, `Captions`, `Soundtrack`, `useMouth`). A new `src/stick/` module draws flat SVG stickmen, props, split-screen panels and the watermark in place of the Three.js `Shot`. Voices: one Speko clip per line → existing `tools/join_lines.py`.

**Tech Stack:** Remotion 4 (React + TS, SVG), Python 3 tools (numpy, ffmpeg), Speko MCP (`audio.synthesize`, gpt-4o-mini-tts).

**Spec:** `docs/superpowers/specs/2026-10-31-tech-support-stickman-design.md`

## Global Constraints

- Slug `tech-support`; 1080×1920, 30 fps; target runtime ~90 s (QA window 85–96 s), ~230–260 words.
- English only. No brands, ISPs or logos anywhere (lines, props, screens).
- Look "B": black stick bodies, white-filled heads, stroke ≈ 16 px at 1080 wide; accents only: Grandpa room `#F6EEDC`, Agent office `#E4EEF6`, Grandpa grey hair + round glasses, Agent blue headset `#2F6FD6`, router light `#2ECC40`.
- Watermark: text `Inkwell Life` on every frame, top-left (x = 7% of width, baseline y ≈ 5% of height), 36 px, `#111` at opacity 0.45, Fredoka.
- Golden rules from `CLAUDE.md`: all motion from `useCurrentFrame()` via `interpolate`/`spring`; no `useFrame`, `Date.now()`, `performance.now()`, `Math.random()` (use `random("seed")`); one `<Sequence>` per shot; timing only from `04-words.json`.
- Keep key action out of bottom 20% and right 15%. Captions via `Captions` with one emphasis word per sentence (`onePerSentence`).
- Mix targets from `CLAUDE.md` (voice 0 dB, music −21 dB, SFX −6…−12 dB, true peak < −1 dBTP).
- 3D pipeline and other episodes must not change behavior. `npm run check` and `npm test` stay green.
- Two user gates: script approval (Task 1) and voice pick (Task 3). Do not pass a gate without the user's answer.

## Review Focus

1. Caption band over a face: in split layout the caption sits on the split line; both heads must stay clear of it → `test-stick.ts` asserts head boxes vs caption band for every `LAYOUT` (Task 6).
2. Shot with no `LAYOUT` entry or an unknown pose/prop/panel name → must throw naming `src/episodes/tech-support.tsx` / `src/stick/*`, never render blank (Tasks 4–6 tests).
3. Wrong mouth moving: in a cutaway the off-panel speaker's mouth must not move, and the on-panel listener's mouth stays shut on the other's words → test in Task 6.
4. Clip count / order drift between `03-shots.json` lines and `voice-clips/` → `speko_lines.py` names clips from the same line enumeration `join_lines.py` uses; test in Task 2.
5. Watermark or props drifting into the bottom-20% / right-15% zone → `test-stick.ts` asserts watermark box and every prop anchor in `LAYOUT` (Task 6).

---

### Task 1: Script (GATE: user approves)

**Files:**
- Create: `episodes/tech-support/02-script.md`

- [ ] **Step 1:** Write the dialogue, each line tagged `[BEAT] SPEAKER: text`, beats in order `HOOK, SETUP, ESC-1, ESC-2, ESC-3, TWIST, BUTTON` (the music generator keys on `ESC-3`, `TWIST`, `BUTTON`). Speakers `grandpa`, `agent`. Hook in first 2 s ("Young man, I've broken the internet." or better). Escalating gags (fridge, cereal-box password, router in oven — final picks are the writer's), turn ~70 s (agent's screen freezes, grandpa talks them through it), twist: grandpa's internet was fine; he was lonely. Agent stays on the line. 230–260 words. Mark `(beat)` where a silent reaction pause goes. Not mean about old people.
- [ ] **Step 2:** Count words: `grep -v '^#' episodes/tech-support/02-script.md | sed 's/^\[[^]]*\] [a-z]*: //' | wc -w` → 230–260.
- [ ] **Step 3:** Show the user the script; apply edits until they approve. **Stop here until approved.**
- [ ] **Step 4:** Commit `02-script.md` ("tech-support: approved script").

### Task 2: Per-line Speko tool

**Files:**
- Modify: `tools/speko_voice.py` (move the top-level run code under `if __name__ == "__main__":` so `Speko`, `api_key`, `find_url` import cleanly; behavior unchanged)
- Create: `tools/speko_lines.py`
- Create: `episodes/tech-support/04-voices.json`
- Modify: `tools/ep.mjs` (add `lines: [[py, "tools/speko_lines.py", slug, ...rest]]`, add it to the usage message)
- Test: `tools/test_speko_lines.py`

**Interfaces:**
- Produces: `segments(shots: list[dict]) -> list[tuple[str, str]]` — `(speaker, text)` per line in shot order, a shot without `lines` = `("narrator", text)`; same order as `join_lines.py`'s `segs`. `clip_name(i: int, speaker: str) -> str` → `f"{i+1:02d}-{speaker}.wav"`.
- CLI: `python3 tools/speko_lines.py tech-support samples` → `out/voice-samples/<speaker>-<voice>-<n>.wav` for each speaker × each `candidates[]` × first 3 of that speaker's lines (from `02-script.md` order if `03-shots.json` doesn't exist yet: read `03-shots.json` if present else parse `02-script.md` lines `[BEAT] speaker: text`). `python3 tools/speko_lines.py tech-support` → `episodes/tech-support/voice-clips/NN-speaker.wav` for every segment using the speaker's picked `voice`, then runs `join_lines.py` and the loudnorm ffmpeg command from `SETUP.md` → `public/episodes/tech-support/voice.mp3`.
- `04-voices.json` shape:
  ```json
  { "model": "gpt-4o-mini-tts",
    "speakers": {
      "grandpa": { "candidates": ["ballad", "ash"], "voice": null, "speed": 0.92,
                   "instructions": "Warm, slow, slightly creaky grandfather. Chatty, wanders off topic, kind. Never mocking." },
      "agent":   { "candidates": ["coral", "verse"], "voice": null, "speed": 1.1,
                   "instructions": "Young, fast, chirpy call-centre agent reading a script; cracks under pressure; soft and sincere at the end." } } }
  ```
  Synthesize body per line: `{text, voice, model, speed, instructions, intent: {language: "en-US", optimizeFor: "accuracy"}, constraints: {allowedProviders: {tts: ["openai-tts"]}}}` (same shape as `episodes/dead-man-army/04-voice-request.json`). Convert each download to mono 16-bit wav at one sample rate (`ffmpeg -ac 1 -ar 24000 -c:a pcm_s16le`) — `join_lines.py` asserts equal rates. Exit with a clear message if a speaker's `voice` is `null` in full mode.

- [ ] **Step 1: Write the failing test** `tools/test_speko_lines.py` (plain asserts, run with `python3`):
  ```python
  shots = [{"text": "Hi there. Hello.", "lines": [{"speaker": "grandpa", "text": "Hi there."}, {"speaker": "agent", "text": "Hello."}]},
           {"text": "Narration line."}]
  assert segments(shots) == [("grandpa", "Hi there."), ("agent", "Hello."), ("narrator", "Narration line.")]
  assert clip_name(0, "grandpa") == "01-grandpa.wav" and clip_name(11, "agent") == "12-agent.wav"
  assert sorted(clip_name(i, s) for i, (s, _) in enumerate(segments(shots))) == [clip_name(i, s) for i, (s, _) in enumerate(segments(shots))]
  ```
- [ ] **Step 2:** `python3 tools/test_speko_lines.py` → fails (ImportError).
- [ ] **Step 3:** Implement `speko_lines.py` and the `speko_voice.py` guard as specified.
- [ ] **Step 4:** `python3 tools/test_speko_lines.py` → no output, exit 0. `python3 -c "import sys; sys.path.insert(0,'tools'); import speko_voice"` → no Speko call, exit 0.
- [ ] **Step 5:** Commit.

### Task 3: Voice samples (GATE: user picks)

- [ ] **Step 1:** `npm run lines -- tech-support samples` (needs `SPEKO_API_KEY` in `.env`; if missing, ask the user — don't invent one).
- [ ] **Step 2:** Give the user the absolute paths of the sample files; ask which voice (and any speed/style change) per character. **Stop until they pick.**
- [ ] **Step 3:** Set `voice` (and edits) in `04-voices.json`; commit.

### Task 4: Shot list + full voice

**Files:**
- Create: `episodes/tech-support/03-shots.json`
- Generated: `episodes/tech-support/voice-clips/*.wav`, `04-words.json`, `public/episodes/tech-support/voice.mp3`

**Interfaces:**
- Produces: v1 `Episode` (`src/lib/shots.ts`) with `slug: "tech-support"`, `fps: 30`, `width: 1080`, `height: 1920`, `"style": "stickman-2d"`, `"target_sec": 90`, `characters: { grandpa: {preset:"custom"}, agent: {preset:"custom"} }`. Every shot has `lines` (dialogue), `beat`, `emphasis_word`, `sfx`, `tts_pause_after_ms` (reaction beats 400–900 ms), `face` per character from `FACES`, `action` = a 2D pose name (Task 5). 3D-only fields get fixed placeholder values the 2D renderer ignores: `set: "phone-call"`, `props: []`, `lighting: "warm-key"`, `camera: {move:"static", from:"medium", to:"medium", target:"grandpa"}`, `transition_in: "cut"` — except exactly one `TWIST` shot (the "I was just lonely" reveal line) with `camera.move: "dolly-zoom"`, which `make_audio.py` uses to place the hard silence before the reveal.
- Story text = approved script word for word; ~1 shot per 1–3 lines (≈ 25–35 shots).

- [ ] **Step 1:** Write `03-shots.json`. Verify the joined shot texts equal `02-script.md`'s dialogue word for word: `python3 -c "import json;s=json.load(open('episodes/tech-support/03-shots.json'))['shots'];print(' '.join(x['text'] for x in s))"` diffed against the script's line texts → identical. (`parseEpisode` runs for real in Task 7 via `dump-cues.ts`.)
- [ ] **Step 2:** `npm run lines -- tech-support` → `voice.mp3` + `04-words.json`. Check `ffprobe` duration of `voice.mp3` is 80–94 s; if outside, tighten/loosen `tts_pause_after_ms` (not the approved words) and re-run `join_lines.py` only.
- [ ] **Step 3:** Commit the shot list, words, voice.mp3 (clips stay uncommitted like other episodes' raw audio — check `.gitignore`).

### Task 5: Stickman, faces, poses

**Files:**
- Create: `src/stick/style.ts` — constants: `INK = "#111"`, `STROKE = 16`, `ROOM = { grandpa: "#F6EEDC", agent: "#E4EEF6" }`, `HEADSET = "#2F6FD6"`, `LED = "#2ECC40"`, `HAIR = "#BBBBBB"`.
- Create: `src/stick/poses.ts`
- Create: `src/stick/Stickman.tsx`
- Test: `tools/test-stick.ts` (add to `npm test` in `package.json`: `&& node tools/run-ts.mjs tools/test-stick.ts`)

**Interfaces:**
- `interface Pose { lean: number; head: number; armL: [number, number]; armR: [number, number]; legL: [number, number]; legR: [number, number]; lift: number }` — radians (shoulder/hip, elbow/knee), `lift` px body offset (bob/jump). `armR` holds the phone by convention.
- `POSES: Record<PoseName, (f: number, fps: number) => Pose>` with `PoseName` = `"idle" | "phone-ear" | "talk" | "facepalm" | "shrug" | "type" | "point" | "slump" | "jump" | "lean-in" | "wave" | "hug-phone"`; every pose has a seeded, small breathing/bob from `f` (`random("pose-<name>")` for phase).
- `pose(name: string): (f, fps) => Pose` — throws `Unknown pose "<name>" — add it to POSES in src/stick/poses.ts`.
- `<Stickman x y scale who={"grandpa"|"agent"} pose={Pose} face={FaceName} mouth={number /*0..1*/} flip?={boolean} />` — SVG `<g>`: head circle r = 70·scale white-filled, torso 170·scale, limbs 2 segments each, stroke `STROKE·scale`, round caps; face: eyes/brows/mouth per the 10 `FACES` (2D re-draw of `src/components/Face.tsx` expression table, mouth opens by `mouth`); accents: grandpa grey hair arc + round glasses, agent headset arc + mic dot. Head-box helper `headBox(x, y, scale): {x0,y0,x1,y1}` exported for the caption test.

- [ ] **Step 1: Write the failing tests** in `tools/test-stick.ts`:
  ```ts
  for (const n of Object.keys(POSES)) assert.deepEqual(POSES[n](17, 30), POSES[n](17, 30)); // deterministic
  assert.notDeepEqual(POSES.idle(0, 30), POSES.idle(20, 30)); // breathes
  assert.throws(() => pose("moonwalk"), /src\/stick\/poses\.ts/);
  ```
- [ ] **Step 2:** `npm test` → fails (module not found).
- [ ] **Step 3:** Implement `style.ts`, `poses.ts`, `Stickman.tsx`.
- [ ] **Step 4:** `npm test` and `npm run check` → pass.
- [ ] **Step 5:** Commit.

### Task 6: Props, panels, watermark, shot renderer

**Files:**
- Create: `src/stick/props.tsx`, `src/stick/Panel.tsx`, `src/stick/Watermark.tsx`, `src/stick/StickShot.tsx`
- Modify: `tools/test-stick.ts`

**Interfaces:**
- `STICK_PROPS: Record<string, React.FC<{ f: number; fps: number; state?: string }>>` — `router` (LED blinks; `state:"off"` dark), `phone`, `computer` (`state:"frozen"` shows a stuck spinner + crooked window, no text), `desk`, `armchair`, `fridge`, `oven`, `cereal-box` (generic, no brand), `window`, `lamp`. `stickProp(name)` throws `Unknown prop "<name>" — add it to STICK_PROPS in src/stick/props.tsx`.
- `type PanelName = "split" | "grandpa" | "agent"`. `split`: grandpa panel y 0–960, agent 960–1920, 6 px ink divider at 960; full panels fill the frame with that room's tint.
- `interface StickLayout { panel: PanelName; grandpa?: { x: number; y: number; scale: number; flip?: boolean }; agent?: {...same}; props?: { name: string; x: number; y: number; scale?: number; state?: string; startAt?: StartAt }[] }` — coordinates in 1080×1920 px; a character absent from the layout is off-panel.
- `<StickShot timing={ShotTiming} layout={StickLayout} voice={string} />` — uses `useCurrentFrame()`, `useMouth(voice, timing.from + f, true)` from `src/components/Shot.tsx`, talker rule identical to `Shot.tsx` lines 46–48 (latest started word's `speaker`); character drawn only if in layout; `pose(shot.characters[i].action)`, `face` from the shot.
- `<Watermark />` — Global Constraints values.
- `CAPTION_Y = 0.5` (exported from `StickShot.tsx`); caption band = `CAPTION_Y·1920 ± CAPTION_PX·0.75`.

- [ ] **Step 1: Write the failing tests** (append to `tools/test-stick.ts`; layouts imported from `src/episodes/tech-support.tsx` once Task 7 exists — for now a local fixture):
  ```ts
  assert.throws(() => stickProp("toaster-9000"), /src\/stick\/props\.tsx/);
  // caption band clear of faces, watermark + props out of the bottom-20% / right-15% zone
  for (const [id, l] of Object.entries(LAYOUT)) {
    for (const who of ["grandpa", "agent"] as const) if (l[who]) {
      const b = headBox(l[who]!.x, l[who]!.y, l[who]!.scale);
      assert(b.y1 < bandTop || b.y0 > bandBottom, `${id}: ${who}'s face under captions`);
      assert(b.y1 < 0.8 * 1920 && b.x1 < 0.85 * 1080, `${id}: ${who}'s face in the button zone`);
    }
    for (const p of l.props ?? []) assert(p.x < 0.85 * 1080, `${id}: prop ${p.name} in the right 15%`);
  }
  assert(WATERMARK_BOX.x1 < 0.85 * 1080 && WATERMARK_BOX.y1 < 0.2 * 1920);
  // talker: only the latest word's speaker moves; listener stays shut
  assert.equal(talkerAt([{ text: "Hi", start: 0, end: 5, speaker: "agent" }, { text: "Yo", start: 6, end: 9, speaker: "grandpa" }], 7), "grandpa");
  ```
  Export `talkerAt(words, f): string | undefined` and `WATERMARK_BOX` for this.
- [ ] **Step 2:** `npm test` → fails.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test`, `npm run check` → pass.
- [ ] **Step 5:** Commit.

### Task 7: Episode composition, cues, sound

**Files:**
- Create: `src/episodes/tech-support.tsx` — `LAYOUT: Record<shotId, StickLayout>` (throws `No LAYOUT for shot <id> — add it in src/episodes/tech-support.tsx` for a missing id), `DURATION = totalFrames(words, 30)`, `TechSupport` composition: `<AbsoluteFill>` + one `<Sequence>` per `computeTimings` entry rendering `StickShot`, then `<Captions words emphasis={onePerSentence(words, new Set(timings.map(t => t.emphasisWord).filter(n => n !== null)))} yRatio={CAPTION_Y} />`, `<Watermark />`, `<Soundtrack voice music={"audio/music/tech-support.wav"} cues={placeCues(timings, CUES)} musicDbAt={musicDbAt(words, 30)} bed={BED} />`; `assertGapsFilled(words, BED)`.
- Create: `src/episodes/tech-support.cues.ts` — `CUES: CueSheet` (record scratch on the freeze line, phone-buzz on the opening ring, typing, oven door, etc., placed with `{ word, offset }`).
- Modify: `src/Root.tsx` — add `<Composition id="tech-support" ...>` in the Episodes folder, 1080×1920, 30 fps.
- Modify: `tools/make_audio.py` + `src/lib/cues.ts` `SFX_DB` — add only the sounds the shot list names that don't exist (likely `dial-tone`, `hold-music`, `keyboard-typing`, `oven-door`; each −8…−12 dB).

- [ ] **Step 1:** `tools/test-stick.ts`: replace the fixture with the real `LAYOUT`; add `for (const s of episode.shots) assert(LAYOUT[s.id], s.id)`.
- [ ] **Step 2:** Implement the files above.
- [ ] **Step 3:** `npm run audio -- tech-support` → prints the music section times (b/c/cut/d) without error.
- [ ] **Step 4:** `npm test`, `npm run check` → pass. `npm run mix:check -- tech-support` → all PASS.
- [ ] **Step 5:** `npm run stills -- tech-support`, then `0.15` and `0.95` → look at every still in `out/stills/`: both characters in their panels, faces clear of captions, watermark readable, props readable, no brand text. Fix `LAYOUT` until clean.
- [ ] **Step 6:** Commit.

### Task 8: QA for a 90 s 2D episode

**Files:**
- Modify: `tools/qa.py:53` — read `target_sec` from `03-shots.json` (default 60); check `target−5 ≤ dur ≤ target+6` with label `f"Length matches the chosen duration ({t} s)"`.
- Modify: `tools/ep.mjs` `qa` — read `episodes/<slug>/03-shots.json` if it exists; pass `--target-sec <target_sec ?? 60>` to `motion_qa.py`, and skip `motion_qa.py` when `style === "stickman-2d"` (print `motion QA skipped: 2D episode`).

- [ ] **Step 1:** `python3 tools/qa.py dead-man-army out/dead-man-army.mp4` (if that render exists) still reports the 60 s window; otherwise inspect the diff. 
- [ ] **Step 2:** `npm run check` → pass. Commit.
- [ ] **Step 3:** Tell the user: render with `npm run render -- tech-support`, then `npm run qa -- tech-support`.
