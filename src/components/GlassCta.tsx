// End-of-episode call to action (niche/TOON-3D.md, Ending Rule): a small glass card, same style as the
// watermark, that pops in while the narrator says "Like and subscribe for more." and stays to the last frame.
// Usage: <Sequence from={project.vo.words[ctaBeat.fromWord].start}><GlassCta /></Sequence>
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const glass: React.CSSProperties = {
  background: "linear-gradient(135deg, rgba(255,255,255,0.26), rgba(255,255,255,0.08))",
  border: "1.5px solid rgba(255,255,255,0.4)",
  boxShadow: "0 6px 24px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.4)",
  backdropFilter: "blur(12px) saturate(140%)",
  WebkitBackdropFilter: "blur(12px) saturate(140%)",
};

export const GlassCta: React.FC<{ yRatio?: number }> = ({ yRatio = 0.6 }) => {
  const f = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const pop = spring({ frame: f, fps, config: { damping: 11, stiffness: 160 } }); // overshoots a little, then settles
  // The subscribe button "gets pressed" once, half a second after the card lands.
  const press = interpolate(f, [15, 19, 25], [1, 0.9, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          ...glass,
          position: "absolute",
          // Centred in the 7–85 % safe width, above the caption band.
          left: 0.46 * width,
          top: yRatio * height,
          transform: `translate(-50%, -50%) scale(${0.6 + 0.4 * pop})`,
          opacity: Math.min(1, pop * 1.5),
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "16px 20px 16px 30px",
          borderRadius: 999,
          fontFamily: "Fredoka, sans-serif",
          fontWeight: 700,
          fontSize: 44,
          lineHeight: 1,
          color: "#FFFFFF",
          textShadow: "0 1px 3px rgba(0,0,0,0.45)",
          whiteSpace: "nowrap",
        }}
      >
        <span>Like</span>
        <span style={{ opacity: 0.7 }}>&middot;</span>
        <span
          style={{
            background: "#E8413C",
            borderRadius: 999,
            padding: "12px 26px",
            transform: `scale(${press})`,
            boxShadow: "0 3px 10px rgba(0,0,0,0.25)",
            textShadow: "none",
          }}
        >
          Subscribe
        </span>
      </div>
    </AbsoluteFill>
  );
};
