# Motion upgrade — Toon-3D Shorts Engine v1.1

What's in here:

| Path | What it is |
|---|---|
| `engine/PROMPT_ENGINE.md` | Prompt engine v1.1 (scenes + performance tracks, Living Frame Law, Motion QA Law) |
| `src/motion-kit.ts` | Pure, frame-deterministic motion helpers (springs, idle, breath, blink, gaze chain, gestures, follow-through, lip-flap, camera track, handheld, impact shake) |
| `src/Stickman.tsx` | `@remotion/three` stickman rig that layers all of the above |
| `src/Scene.example.tsx` | One continuous take: camera track + two acting characters keyed to TTS words |
| `tools/motion_qa.py` | Render QA: cuts/min, take length, motion energy, frozen frames, abrupt starts, audio gaps, runtime |
| `demo/` | The before/after demo (plain Three.js, rendered with Playwright) |

## Wiring it into your engine

1. Copy `src/motion-kit.ts` into your Remotion project. It has no dependencies.
2. In your character component, every frame, call `idle`, `breathe`, `blink` and `gazeChain`, then `gesture` for each gesture and `mouth`/`talkNods` for the speaker. Add the results onto your bone or pivot rotations (see `Stickman.tsx` for the order).
3. Replace per-shot camera tweens with **one `cameraTrack()` per scene**, built from the scene's `camera.keys` (resolve `atWord` → frame with `atWord()` or your TTS timings), plus `handheld()`.
4. Map the v1.1 contract: `scenes[].performances[]` → your character props; `scenes[].camera.keys[]` → `CameraKey[]`.
5. After every render: `python3 tools/motion_qa.py out.mp4 --target-sec 60`. Ship only on PASS.

## Tuning cheatsheet

- Too floaty → raise `stiffness`. Too bouncy → raise `damping`. (`SPRINGS` in motion-kit.)
- Camera feels robotic → raise `leadSec` (it starts earlier and arrives softer) or `rampSec`.
- Characters look nervous → lower `energy`. Look dead → raise it to 0.8–1.0.
- Gesture lacks punch → raise `windup` (0.25) and lower `anticipation` (6 frames).
- Hat wobble too much → set the multiplier on `followThrough(...) - signal` to 1.0 or use a stiffer spring.

## Rebuilding the demo

```bash
npm i three@0.169.0 esbuild@0.24.0 playwright
npx esbuild demo/demo.ts --bundle --outfile=demo/out/demo.js --format=iife
node demo/render.js
ffmpeg -framerate 30 -i demo/frames/%04d.png -c:v libx264 -pix_fmt yuv420p demo/before_after.mp4
```
