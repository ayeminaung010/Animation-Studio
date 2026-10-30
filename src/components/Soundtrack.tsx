// Voice, music and sound effects. Every effect lands on the frame of its action.
// Mix: voice 0 dB · music −21 dB (−20…−24) · SFX −6…−12 dB.
import { Audio } from "@remotion/media";
import React from "react";
import { Sequence, staticFile } from "remotion";
import { dbToGain, MASTER_DB, MUSIC_DB, type PlacedCue } from "../lib/cues";

export const Soundtrack: React.FC<{ voice: string; music: string; cues: PlacedCue[] }> = ({ voice, music, cues }) => (
  <>
    <Audio src={staticFile(voice)} volume={dbToGain(MASTER_DB)} />
    {/* The music file already contains the half-second silence before the reveal line. */}
    <Audio src={staticFile(music)} volume={dbToGain(MASTER_DB + MUSIC_DB)} />
    {cues.map((c) => (
      <Sequence key={c.key} name={`sfx ${c.shot} ${c.name}`} from={c.from} durationInFrames={c.durationInFrames} layout="none">
        <Audio src={staticFile(`audio/sfx/${c.name}.wav`)} volume={dbToGain(MASTER_DB + c.db)} />
      </Sequence>
    ))}
  </>
);
