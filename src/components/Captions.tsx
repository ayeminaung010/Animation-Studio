// One word on screen at a time: Fredoka bold, white fill, thick black stroke, soft shadow,
// centred at `yRatio` of the height (v1 0.55, v2 0.70) and kept clear of YouTube's bottom 20% and right 15%.
import { loadFont } from "@remotion/fonts";
import React from "react";
import { AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { Word } from "../lib/shots";
import { msToFrame } from "../lib/timing";

const FAMILY = "Fredoka";
loadFont({ family: FAMILY, url: staticFile("fonts/fredoka-700.woff2"), weight: "700" });

export const CAPTION_ACCENT = "#FFD23F";
/** A word stays up this long after it ends when the next word is late (pauses, the twist beat). */
const HOLD_FRAMES = 12;
/** Caption font size (px at 1080 wide) and the emphasis scale; also used for the face-overlap check. */
export const CAPTION_PX = 128;
export const CAPTION_HOT_SCALE = 1.3;

/** Caption text: drop quotes, dashes and trailing commas/periods/colons; keep ? ! … */
export const captionText = (w: string) =>
  w
    .replace(/[“”"]/g, "")
    .replace(/\s*[—–]\s*/g, "")
    .replace(/[.,:;]+$/g, "")
    .trim();

export const Captions: React.FC<{ words: Word[]; emphasis: Set<number>; yRatio?: number }> = ({ words, emphasis, yRatio = 0.55 }) => {
  const f = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // The word currently being spoken: the last one that has started.
  let i = -1;
  for (let k = 0; k < words.length; k++) {
    if (msToFrame(words[k].startMs, fps) <= f) i = k;
    else break;
  }
  if (i < 0) return null;
  const start = msToFrame(words[i].startMs, fps);
  const end = msToFrame(words[i].endMs, fps);
  const next = i + 1 < words.length ? msToFrame(words[i + 1].startMs, fps) : Infinity;
  if (f >= Math.min(next, end + HOLD_FRAMES)) return null;

  const text = captionText(words[i].text);
  if (!text) return null;
  const hot = emphasis.has(i);
  const local = f - start;
  const size = CAPTION_PX * (hot ? CAPTION_HOT_SCALE : 1);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          // Safe area: 7% in from the left, 15% clear on the right (YouTube buttons).
          left: width * 0.07,
          right: width * 0.15,
          top: height * yRatio,
          display: "flex",
          justifyContent: "center",
          translate: "0 -50%",
        }}
      >
        <div
          style={{
            fontFamily: FAMILY,
            fontWeight: 700,
            fontSize: size,
            lineHeight: 1,
            color: hot ? CAPTION_ACCENT : "#FFFFFF",
            WebkitTextStroke: `${hot ? 30 : 24}px #111111`,
            paintOrder: "stroke fill",
            textShadow: "0 10px 26px rgba(0,0,0,0.45)",
            whiteSpace: "nowrap",
            // Pop in over 4 frames.
            scale: interpolate(local, [0, 4], [0.55, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.back(2.2)),
            }),
            opacity: interpolate(local, [0, 2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
};
