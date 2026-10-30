// Mood lighting: warm for happy beats, cold blue for sadness, red rim for danger,
// a single overhead bulb for confessions and reveals.
import React from "react";
import type { LightingName } from "../lib/shots";

export const BACKGROUND: Record<LightingName, string> = {
  "warm-key": "#F7C98B",
  "cold-blue": "#22325A",
  "red-rim": "#2A0E14",
  "overhead-bulb": "#0F0B08",
};

export const Lighting: React.FC<{ name: LightingName; bulb?: [number, number, number] }> = ({
  name,
  bulb = [0, 3, 0.4],
}) => {
  switch (name) {
    case "warm-key":
      return (
        <>
          <hemisphereLight args={["#FFE8C8", "#9C6B4A", 1.4]} />
          <directionalLight position={[3, 6, 5]} intensity={2.6} color="#FFD8A0" />
          <directionalLight position={[-5, 2, 2]} intensity={0.7} color="#FFB09A" />
        </>
      );
    case "cold-blue":
      return (
        <>
          <hemisphereLight args={["#8FA9E6", "#1B2440", 1.1]} />
          <directionalLight position={[-3, 5, 4]} intensity={1.6} color="#A9C4FF" />
          <directionalLight position={[0, 3, -5]} intensity={1.6} color="#4F7DFF" />
        </>
      );
    case "red-rim":
      return (
        <>
          <hemisphereLight args={["#6A3440", "#1A0A0E", 0.8]} />
          <directionalLight position={[2, 3, 5]} intensity={1.2} color="#FFD2BC" />
          <directionalLight position={[-1, 3, -4]} intensity={5} color="#FF2A2A" />
          <directionalLight position={[3, 1, -3]} intensity={2.5} color="#FF4A3A" />
        </>
      );
    case "overhead-bulb":
      return (
        <>
          <hemisphereLight args={["#4A3A28", "#0A0806", 0.45]} />
          <pointLight position={bulb} intensity={14} distance={9} decay={1.6} color="#FFC46B" />
          <directionalLight position={[0, 2, 5]} intensity={0.25} color="#8FA0C8" />
        </>
      );
  }
};
