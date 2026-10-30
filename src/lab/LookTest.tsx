// Look test: three characters around a bench in any set, for before/after stills of rig and set changes.
// npx remotion still src/index.ts look-test out/stills/look.png --frame=30 --props='{"set":"waiting-room"}'
import { ThreeCanvas } from "@remotion/three";
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { CameraRig } from "../components/CameraRig";
import { Character } from "../components/Character";
import { BACKGROUND, Lighting } from "../components/Lighting";
import type { CharacterDef } from "../lib/shots";
import { Bench } from "../props/furniture";
import { setDef } from "../sets";

const CAST: Record<string, CharacterDef> = {
  banker: { preset: "custom", outfit: "grey-suit-boutonniere", hair: "bald", accessory: "small-glasses" },
  kid: { preset: "custom", outfit_color: "#7FD1B9", hair: "slick-black" },
  farmer: { preset: "custom", outfit_color: "#C8693A", hair: "messy-brown" },
};

export const LookTest: React.FC<{ set: string; azimuth?: number }> = ({ set, azimuth = 0 }) => {
  const f = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const def = setDef(set);
  const bg = def.sky?.["warm-key"] ?? BACKGROUND["warm-key"];
  const SetC = def.component;
  const d = 90;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: bg,
        scale: 1.012
      }}
    >
      <ThreeCanvas width={width} height={height} gl={{ antialias: true }}>
        <color attach="background" args={[bg]} />
        <Lighting name="warm-key" />
        <CameraRig
          spec={{ move: "static", from: "medium", to: "medium", target: [0, 1.0, 0], isCharacter: false, frameScale: 1.35, azimuth }}
          frame={f}
          duration={d}
        />
        <>
          <SetC f={f} />
          <group position={[0, 0, -0.08]}>
            <Bench f={f} d={d} fps={fps} />
          </group>
          <Character def={CAST.banker} pos={[-0.42, 0, 0.12]} face="suspicious" action="idle" frame={f} duration={d} facing={0.35} />
          <Character def={CAST.kid} pos={[0, 0, 0]} face="smug" action="sit-sofa" frame={f} duration={d} />
          <Character def={CAST.farmer} pos={[0.42, 0, 0.12]} face="neutral" action="arms-cross-smug" frame={f} duration={d} facing={-0.35} />
        </>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
