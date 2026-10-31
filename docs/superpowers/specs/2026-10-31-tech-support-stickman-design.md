# Tech Support — 2D stickman comedy Short (design)

Date: 2026-10-31 · Slug: `tech-support`

## Intent

A ~90-second vertical (1080×1920, 30 fps) comedy Short for the existing channel (global, English-speaking;
rules in `niche/TWIST-STORY-ENGINE.md`: no logos/brands, readable text, a twist that recolors what came
before). Two stickmen talk on the phone. It should be funny all the way through and land on a sweet ending.

## Story (decided)

- **Grandpa** calls tech support sure "the internet is broken." Slow, warm, wanders off topic, calls the
  router "the blinking box."
- **Agent**: young, chirpy, script-reading; cracks under pressure as each troubleshooting step goes
  sillier (unplugs the fridge, reads the Wi-Fi password off a cereal box, puts the router in the oven to
  "reset it" — exact gags are the script's call).
- **Turn (~70 s)**: the agent's own screen freezes — their office internet was down all along. Grandpa
  calmly talks them through fixing it ("Is the blinking box blinking, son?").
- **Twist / sweet ending (kept, user's choice)**: grandpa's internet was fine all along; he was lonely and
  wanted someone to talk to. The agent stays on the line. Last shot: both smiling in split-screen.
- Hook in the first 2 s (e.g. Grandpa: "Young man, I've broken the internet.").
- No narrator — dialogue only.

## Look (decided: option B, "line + accents")

- Flat 2D SVG. Black stick bodies (round white-filled head, stick torso/limbs, ~3 px at mockup scale,
  scaled up for 1080 wide), simple faces (eyes, brows, mouth) with a handful of expressions.
- A few color accents only: warm room tint for Grandpa (#F6EEDC-ish), cool tint for the Agent's office
  (#E4EEF6-ish), Grandpa's grey hair + round glasses, Agent's blue headset, router with a green light.
- Default staging: split-screen phone call, Grandpa top half, Agent bottom half; full-frame cutaways
  for gags (router in oven, cereal box) are allowed. Mockup: `.superpowers/brainstorm/*/content/stickman-style.html`.
- Generic props only (router, phone, computer, fridge, oven, cereal box) — no brand names.
- **Watermark** (user request): text "Inkwell Life" on every frame. *My call:* top-left inside the safe
  area, small (~36 px), white-ish/black at ~45% opacity so it never competes with captions.

## Sound (decided, my proposal accepted)

- English. Two distinct Speko TTS voices (gpt-4o-mini-tts like the channel's existing request): Grandpa
  warm/slow/creaky; Agent young/fast/chirpy, softening at the end.
- Each line generated as its own clip → `tools/join_lines.py` → `voice.mp3` + `04-words.json`. Shots use
  `lines: [{speaker, text}]` so only the speaker's mouth moves.
- Short silent beats after punchlines for reaction faces (`tts_pause_after_ms`).
- SFX from `public/audio/sfx` + `tools/make_audio.py` where missing: phone ring/dial, hold music, record
  scratch (exists) when the agent's screen freezes, beeps. Music light under the voices, turns gentle for
  the last ~15 s. Mix targets from `CLAUDE.md` apply (`npm run mix:check`).
- Captions: existing `Captions` component, one yellow emphasis word per sentence.

## How it's built (my call)

In this repo, inside Remotion, reusing the pipeline: `03-shots.json` / `04-words.json`, `src/lib/timing.ts`,
`Captions`, `Soundtrack`, cue sheet, stills, mix check, QA. New: a 2D SVG stickman renderer (character,
faces, split-screen layout, a few props, watermark) for this episode. The 3D pipeline and existing
episodes stay untouched. Golden rules still apply (all motion from `useCurrentFrame()`, seeded random,
timing only from words).

## Process

1. Write the script (dialogue, beat-tagged) → **user approves** before any animation.
2. **Voice samples (user's choice):** 2–3 sample lines per character, a couple of Speko voice options each
   (e.g. Grandpa "ballad" slowed; Agent "coral" or "verse") → **user picks** voice + speed + style.
3. Shot list + all line clips with the picked voices + word timings.
4. Build the 2D renderer and the episode composition; `npm run check`, stills review.
5. User renders on their machine.

## Builder calls (from the review)

- *My call:* `tools/qa.py` hard-fails outside 55–66 s; make the runtime check take a per-episode target
  (this one ~90 s, ~230–260 words) rather than special-casing the slug.
- *My call:* `03-shots.json` stays the source of story text + `lines`; 2D staging (panel, pose, props)
  lives in `src/episodes/tech-support.tsx` like `LAYOUT` does for 3D. 3D-only fields are omitted.
- *My call:* `motion-upgrade/tools/motion_qa.py` assumes the 3D rig — skip it for this episode;
  `tools/qa.py` still runs.
- The engine doc's "no watermark" is an image-prompt negative; the user asked for this one, so it stays.

## Non-goals

- A reusable 2D character library beyond these two characters.
- New music synthesis beyond the existing tools; 16:9 or other formats.
- Changing the 3D look or existing episodes.

## Anti-goals

- Mean-spirited jokes about old people — Grandpa is the hero by the end.
- Real brands/ISPs/logos; unreadable tiny text; key action in the bottom 20% / right 15%.

## Left to the builder

Exact gags and line wording (subject to script approval), expression set, prop drawings, shot count and
cut rhythm, exact SFX choices, music track.
