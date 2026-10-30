# Run it on your own computer

## 1. Install the tools (once)

| Tool | Version | Get it |
|---|---|---|
| Node.js | 20.19+ or 22.13+ | https://nodejs.org (LTS) |
| Python | 3.10+ | https://python.org — on Windows tick "Add python.exe to PATH" |
| FFmpeg | any recent | macOS: `brew install ffmpeg` · Windows: `winget install ffmpeg` · Linux: `sudo apt install ffmpeg` |
| Google Chrome | any | Remotion downloads its own headless Chrome on first render |

## 2. Set up the project (once)

Unzip, open a terminal in the `twist-shorts` folder, then:

```bash
npm install
pip install -r requirements.txt        # Windows: py -m pip install -r requirements.txt
```

## 3. Everyday commands

Every command except `dev`/`check` needs the episode slug after `--`, e.g. `npm run render -- my-episode`.

| Command | What it does |
|---|---|
| `npm run dev` | Opens Remotion Studio in your browser: scrub the timeline, see every shot |
| `npm run check` | Type check + lint (run after every code change) |
| `npm run stills` | One review still per shot → `out/stills/` (`npm run stills -- <slug> 0.15` for another point) |
| `npm run render` | Final MP4 → `out/<slug>.mp4` |
| `npm run audio` | Rebuild the music and sound effects from code |
| `npm run mix:check` | Simulates the mix: peaks and voice clarity, in seconds |
| `npm run qa` | Runs the QA checklist on the rendered MP4 |
| `npm run clean -- <slug>` | After the final render: lists the episode's data to delete (voice, music, story, code, review output); add `--yes` to delete. Keeps `out/<slug>.mp4` |

**Rendering speed.** Three.js needs WebGL. With a graphics card the default (`angle`) is fast.
On a machine without one (a server, a VM) set software rendering first:

```bash
export REMOTION_GL=swangle          # Windows PowerShell: $env:REMOTION_GL="swangle"
```

## 4. Customise

| You want to change | Edit |
|---|---|
| The story, shots, camera moves, faces, actions | `episodes/<slug>/03-shots.json` (from the producer prompt) |
| Where props sit, who faces whom, camera aim | `LAYOUT` in `src/episodes/<slug>.tsx` |
| When each sound lands, its level | `src/episodes/<slug>.cues.ts` and `SFX_DB` in `src/lib/cues.ts` |
| Character looks (hair, outfits, colours) | `src/components/Character.tsx` |
| Facial expressions | `src/components/Face.tsx` |
| Poses and movements | `src/components/actions.ts` |
| Camera framings and moves | `src/components/CameraRig.tsx` |
| Mood lighting | `src/components/Lighting.tsx` |
| Sets / props | `src/sets/index.tsx` / `src/props/` (register new props in `src/props/index.tsx`) |
| Caption style | `src/components/Captions.tsx` |
| Music and sound design | `tools/make_audio.py`, then `npm run audio` |

A typo in the shot list, or a set/prop/action that doesn't exist, stops the preview with an
error naming the file to edit.

## 5. A new episode

1. Run the producer prompt (Steps 1–5) in a chat assistant. Save `03-shots.json` and `04-words.json`
   into `episodes/<new-slug>/` and the voiceover as `public/episodes/<new-slug>/voice.mp3`.
2. Build any new sets, props and actions the shot list's build list names.
3. Write `src/episodes/<new-slug>.tsx` and `src/episodes/<new-slug>.cues.ts` from the skeleton below,
   fill in `LAYOUT` (one entry per shot) and `CUES`, and register it in `src/Root.tsx`.
4. `npm run audio -- <new-slug>` → music for the new timing.
5. `npm run check`, `npm run stills -- <new-slug>`, `npm run mix:check -- <new-slug>`, fix framing, then
   `npm run render -- <new-slug>` and `npm run qa -- <new-slug>`.

Episode skeleton (`<slug>` and `MyEpisode` are placeholders):

```tsx
// src/episodes/<slug>.tsx: one <Sequence> per shot, timed from 04-words.json.
// Story data lives in episodes/<slug>/*.json; this file only adds staging.
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import shotsJson from "../../episodes/<slug>/03-shots.json";
import wordsJson from "../../episodes/<slug>/04-words.json";
import { Captions } from "../components/Captions";
import { ShotView, type ShotLayout } from "../components/Shot";
import { Soundtrack } from "../components/Soundtrack";
import { placeCues } from "../lib/cues";
import { CUES } from "./<slug>.cues";
import { parseEpisode, parseWords } from "../lib/shots";
import { computeTimings, totalFrames } from "../lib/timing";

export const episode = parseEpisode(shotsJson);
export const words = parseWords(wordsJson);
export const timings = computeTimings(episode.shots, words, episode.fps);
export const DURATION = totalFrames(words, episode.fps);
const VOICE = "episodes/<slug>/voice.mp3";
const MUSIC = "audio/music/<slug>.wav";

// Per shot: props (placement per prop name), chars (facing/offset), target, frameScale… see ShotLayout.
export const LAYOUT: Record<string, ShotLayout> = {
  s01: { props: { "floating-receipt": [{ at: [-0.38, 1.85, 0.4] }] }, chars: { townie_a: { facing: 0.3 } } },
};

// Every shot needs a staging entry.
for (const t of timings) {
  if (!LAYOUT[t.shot.id]) throw new Error(`LAYOUT is missing shot ${t.shot.id}`);
}

export const cues = placeCues(timings, CUES);
const emphasis = new Set(timings.flatMap((t) => (t.emphasisWord === null ? [] : [t.emphasisWord])));

export const MyEpisode: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "black" }}>
    {timings.map((t) => (
      <Sequence key={t.shot.id} name={`${t.shot.id} · ${t.shot.beat}`} from={t.from} durationInFrames={t.durationInFrames}>
        <ShotView timing={t} characters={episode.characters} layout={LAYOUT[t.shot.id]} voice={VOICE} />
      </Sequence>
    ))}
    <Captions words={words} emphasis={emphasis} />
    <Soundtrack voice={VOICE} music={MUSIC} cues={cues} />
  </AbsoluteFill>
);
```

```ts
// src/episodes/<slug>.cues.ts: when each sound lands (pure data, tools read it too).
import type { CueSheet } from "../lib/cues";

/** Unlisted sounds start on the shot's first frame. `at`: frame, { word, offset }, or (t) => frame. */
export const CUES: CueSheet = {
  s01: { "cash-register-ding": { at: { word: "dollar", offset: 8 } } },
  s02: { "town-ambience": { fit: true } },
};
```

```tsx
// src/Root.tsx: one <Composition> per episode (alias the imports when there are several)
import { MyEpisode, DURATION, episode } from "./episodes/<slug>";
<Composition id={episode.slug} component={MyEpisode} durationInFrames={DURATION}
  fps={episode.fps} width={episode.width} height={episode.height} />
```

Or open the folder in Claude Code / Codex and ask it to do steps 2–5: `CLAUDE.md` and `AGENTS.md`
teach the agent this project's rules.

## 6. The voice (Speko)

Voices are made with Speko (OpenAI `gpt-4o-mini-tts`, voice Echo, speed 1.08). Save the request as
`episodes/<slug>/04-voice-request.json`, send it as the body of Speko `audio.synthesize`, then run
`audio.transcribe` on the returned url with the `_transcribe` settings:

```json
{
  "text": "<the approved script, word for word>",
  "intent": { "language": "en-US", "optimizeFor": "accuracy" },
  "voice": "echo",
  "model": "gpt-4o-mini-tts",
  "speed": 1.08,
  "instructions": "Casual YouTube Shorts storyteller. Conversational, a little fast, playful and wry in the first half, like telling a friend a weird story. <per-episode delivery notes: which word to punch, where to slow down, the beat of silence before the twist, a flat final line>",
  "constraints": { "allowedProviders": { "tts": ["openai-tts"] } },
  "_transcribe": { "word_timestamps": true, "language": "en", "keywords": ["<names and odd words>"] }
}
```

**Without the Claude plugin:** put `SPEKO_API_KEY=sk_...` in `.env` (git-ignored) and run
`npm run voice -- <slug>`. It sends this file to the same Speko tools, then does the steps below
and writes `04-words.json` and `public/episodes/<slug>/voice.mp3` (it overwrites both). Narrator-only
episodes; dialogue episodes still use the clip steps further down.

By hand: save the transcript JSON, then:

```bash
python3 tools/align_words.py transcript.json voice-raw.wav    # → 04-words.json + voice-padded.wav
ffmpeg -i voice-padded.wav -af loudnorm=I=-16:TP=-1.5:LRA=11 -ar 44100 -ac 1 -b:a 192k voice.mp3
```

## Licences

Remotion is free for individuals and teams of up to 3 people; companies need a licence
(https://remotion.pro/license). Three.js, React Three Fiber and drei are MIT; Fredoka is under the
SIL Open Font License (`public/fonts/FREDOKA-OFL.txt`). The music and sound effects are original
code output (`public/audio/LICENSES.md`). Check your Speko/OpenAI terms for commercial TTS use.

### Dialogue episodes (several voices)

Give each shot with dialogue `lines: [{ "speaker": "<character id>", "text": "..." }]`. Synthesize one
clip per line (a shot without `lines` is one narrator clip) and save them in shot order as
`episodes/<slug>/voice-clips/01-narr.wav`, `02-boss.wav`, … (the order is what counts, not the names). Then:

```bash
python3 tools/join_lines.py <slug>     # → 04-words.json + voice-joined.wav (trims, adds gaps and tts_pause_after_ms)
ffmpeg -i episodes/<slug>/voice-joined.wav -af loudnorm=I=-16:TP=-1.5:LRA=11 -ar 44100 -ac 1 -b:a 192k public/episodes/<slug>/voice.mp3
```
