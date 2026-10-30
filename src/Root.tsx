import React from "react";
import { Composition, Folder } from "remotion";
import { DURATION, episode, IceKing } from "./episodes/ice-king";
import { GestureSheet } from "./lab/GestureSheet";
import { LookTest } from "./lab/LookTest";

// One <Composition> per episode (skeleton in SETUP.md §5).
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Episodes">
        <Composition id={episode.slug} component={IceKing} durationInFrames={DURATION}
          fps={episode.fps} width={episode.width} height={episode.height}
          defaultProps={{ motion: "v1" as const }} />
      </Folder>
      <Composition id="look-test" component={LookTest} durationInFrames={90} fps={30} width={1080} height={1920}
        defaultProps={{ set: "generic-living-room" }} />
      <Composition id="gesture-sheet" component={GestureSheet} durationInFrames={60} fps={30} width={1080} height={1920}
        defaultProps={{ facing: -0.45 }} />
    </>
  );
};
