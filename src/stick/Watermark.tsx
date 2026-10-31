// Channel watermark on every frame, top-left inside the safe area.
import React from "react";
import { AbsoluteFill } from "remotion";
import { WATERMARK } from "./geometry";
import { INK } from "./style";

// Fredoka is loaded by Captions, which every episode renders alongside this.
export const Watermark: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div style={{ position: "absolute", left: WATERMARK.x, top: WATERMARK.y - WATERMARK.px, fontFamily: "Fredoka, sans-serif", fontWeight: 700,
      fontSize: WATERMARK.px, lineHeight: 1, color: INK, opacity: WATERMARK.opacity, whiteSpace: "nowrap" }}>
      {WATERMARK.text}
    </div>
  </AbsoluteFill>
);
