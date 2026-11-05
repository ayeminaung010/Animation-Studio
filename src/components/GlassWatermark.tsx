// Channel watermark for the 3D episodes: a small frosted-glass pill, top-left inside the safe area
// (same spot as the 2D episodes' watermark), low opacity so it never competes with the picture.
import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";

export const CHANNEL = "@InkwellLife";

export const GlassWatermark: React.FC<{ text?: string }> = ({ text = CHANNEL }) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 0.07 * width,
          top: 0.045 * height,
          padding: "10px 24px",
          borderRadius: 999,
          background: "linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06))",
          border: "1.5px solid rgba(255,255,255,0.35)",
          boxShadow: "0 4px 18px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.35)",
          backdropFilter: "blur(10px) saturate(140%)",
          WebkitBackdropFilter: "blur(10px) saturate(140%)",
          opacity: 0.6,
          fontFamily: "Fredoka, sans-serif",
          fontWeight: 700,
          fontSize: 34,
          letterSpacing: 0.5,
          lineHeight: 1,
          color: "#FFFFFF",
          textShadow: "0 1px 3px rgba(0,0,0,0.45)",
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
