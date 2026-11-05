# Lemo channel kit (@InkwellLife)

Read this during every lemo job. It adds the channel layer to a film made with the lemo-opuscar library:
the `@InkwellLife` watermark, the closing "Like / SUBSCRIBE" card, the caption safe area and the final master.
Frame size is always **1080×1920** (9:16). Kit folder: `<repo>/studio/lemo-kit/`.

## 1. Copy `channel.js` into the film

The film page is served from `/@film/`, so it cannot import a file from anywhere else. **Copy** it:

```sh
cp <repo>/studio/lemo-kit/channel.js <film-dir>/channel.js
```

In `film.js`: `import { SAFE, captionBox, ctaBox, drawWatermark, drawCta } from './channel.js';`
(`channel.js` has no imports and uses canvas 2D only; do not edit the copy — change the kit instead.)

## 2. What goes where

All boxes are for W = 1080, H = 1920 (call them with the real `W`, `H`).

| Element | Rule |
| --- | --- |
| Watermark `@InkwellLife` | `drawWatermark(ctx, W, H)` as the **very last** draw call of every frame, above captions and the CTA. Pill sits top-left at (76, 86), 56 px tall. Never cover it with picture content. |
| Captions | Centred at x ≈ 497, inside `captionBox(W, H)`: top 1300, 88 px tall, at most 0.63·W (680 px) wide. Fit the text to that width; never wider. |
| CTA card | `drawCta(ctx, W, H, t, tLike)` after the captions are drawn but before the watermark. `tLike` = the second the closing line **"Like and subscribe for more."** starts, taken from `voices/words.json` (the word "Like" of that last line). The card pops in at `tLike`, stays to the end, and sits in `ctaBox(W, H)` (560×96, 16 px above the caption box). |
| Safe area | Keep text and key action inside `SAFE`: x from 7 % to 85 % of W, above 80 % of H. Nothing important in the bottom 20 % or the right 15 % (YouTube buttons). |

The closing line must be exactly `Like and subscribe for more.` and be the last sentence of the narration (put it in `lines.json`).
The watermark text is fixed: `@InkwellLife`.

Frame order in `renderFilm(ctx, t)`:

```js
drawScene(ctx, t);                       // picture
drawCaption(ctx, t);                     // inside captionBox(W, H)
drawCta(ctx, W, H, t, K.like);           // K.like = start of "Like and subscribe for more." from voices/words.json
drawWatermark(ctx, W, H);                // always last
```

`glass(ctx, x, y, w, h, alpha)` (frosted pill) is exported if the film needs another pill in the same style;
it blurs what is already on the canvas, so draw it after the picture.

Fonts: the kit asks for `Jost` (600) and `Slab` and falls back to `system-ui`. Use the library's font setup so those load before the first frame.

## 3. Render

```sh
cd ~/lemo-opuscar
node core/render/still.mjs <film-dir> <t> [<t> ...] --size 1080x1920       # stills: check the pill is top-left and the CTA sits above the caption
node core/render/video.mjs <film-dir> --size 1080x1920 --fps 24 --out <film-dir>/out/video.mp4
```

Check stills at an early time, at mid-film, and at about `tLike + 0.5` (CTA visible, caption below it).

## 4. Master

After the picture (`out/video.mp4`) and the mix (`out/mix.wav`) exist:

```sh
sh <repo>/studio/lemo-kit/master.sh <film-dir> <slug>
```

It adds grain through the library's `mux.sh`, re-masters the audio from `out/mix.wav` with a two-pass loudnorm to **−14 LUFS**
(true-peak ceiling −2.2 dBTP so AAC overshoot stays under −1), writes `<film-dir>/<slug>.mp4` and prints the measured lines:

```
I:         -14.0 LUFS
Peak:      -2.9 dBFS
```

Exit codes: `0` ok · `1` true peak above −1.0 dBTP (lower or limit the mix, then run again) · `2` missing project, library, `out/video.mp4` or `out/mix.wav`.
`LIB` overrides the library folder (default `~/lemo-opuscar`).

## 5. Before delivering

1. `readcheck`: `node core/render/readcheck.mjs <film-dir> --size 1080x1920` — every on-screen text readable.
2. Whisper the **final mix** (`out/mix.wav` or the audio of `<slug>.mp4`) with the library's speech check and confirm each line transcribes back, including the closing line.
3. Go through the library's `DIRECTOR.md` §11 "Before you deliver" list (review loop, one fix round, loudness ≈ −14 LUFS, no black frames, subtitles in sync, sound-design table, no LemoLab sign-off grep).
4. Copy the finished file to `<repo>/out/<slug>.mp4` (the studio picks it up from there) and deliver the §11 file list (`<slug>.mp4`, `poster.jpg`, `.srt`, `TREATMENT.md`, `CREDITS`, source + `build.sh`).
