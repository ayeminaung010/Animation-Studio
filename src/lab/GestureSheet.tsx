// Gesture sheet: every motion-v2 gesture pose on one rig, for checking poses after rig changes.
// Hits on frame 15 and holds; frame ~9 shows the wind-up, ~30 the settled pose.
// npx remotion still src/index.ts gesture-sheet out/stills/gestures.png --frame=30
import { ThreeCanvas } from "@remotion/three";
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { CameraRig } from "../components/CameraRig";
import { Character } from "../components/Character";
import { BACKGROUND, Lighting } from "../components/Lighting";
import type { CharacterDef } from "../lib/shots";
import { GESTURE_POSES } from "../motion/gestures";
import { characterMotion } from "../motion/useCharacterMotion";

const DEF: CharacterDef = { preset: "custom", outfit_color: "#2EC4E6", hair: "top-hat", accessory: "scarf" };
const COLS = 3;
const ROWS = 5;
const DX = 1.15;
const DY = 2.3;
const HIT = 15;
/** Camera aim height and visible height (world units). */
const AIM_Y = ((ROWS - 1) * DY) / 2 + 0.9;
const VIEW_H = 6.6 * 1.8;

export const GestureSheet: React.FC<{ facing?: number }> = ({ facing = -0.45 }) => {
  const f = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const bg = BACKGROUND["warm-key"];
  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      <ThreeCanvas width={width} height={height} gl={{ antialias: true }}>
        <color attach="background" args={[bg]} />
        <Lighting name="warm-key" />
        <CameraRig
          spec={{ move: "static", from: "wide", to: "wide", target: [0, AIM_Y, 0], isCharacter: false, frameScale: 1.8, elevation: 0 }}
          frame={f}
          duration={60}
        />
        {GESTURE_POSES.map((pose, i) => {
          const m = characterMotion(f, fps, {
            seed: i + 1,
            gestures: [{ pose, hitFrame: HIT, hold: 60 }],
            expressions: [{ frame: 0, face: "neutral" }],
          });
          const x = ((i % COLS) - (COLS - 1) / 2) * DX;
          const y = (ROWS - 1 - Math.floor(i / COLS)) * DY;
          return (
            <Character key={pose} def={DEF} pos={[x / 2.2, y, 0]} face="neutral" action="idle"
              frame={f} duration={60} facing={facing} motion={m} />
          );
        })}
      </ThreeCanvas>
      {GESTURE_POSES.map((pose, i) => {
        // Label just under the character's feet (screen position of a straight-on camera).
        const x = 50 + (((i % COLS) - (COLS - 1) / 2) * DX * 100 * (height / width)) / VIEW_H;
        const y = 50 - (((ROWS - 1 - Math.floor(i / COLS)) * DY - AIM_Y) * 100) / VIEW_H;
        return (
          <div key={pose} style={{
            position: "absolute", left: `${x - 15}%`, width: "30%", top: `${y}%`, textAlign: "center",
            font: "bold 34px sans-serif", color: "#111",
          }}>{pose}</div>
        );
      })}
    </AbsoluteFill>
  );
};
