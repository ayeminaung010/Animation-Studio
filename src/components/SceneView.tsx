// Renders one v1.1 scene (motion v2): one continuous take on one set. Characters keep living through
// what used to be shot boundaries; the camera travels between framings; props enter and leave on their words.
import { ThreeCanvas } from "@remotion/three";
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { Vec3 } from "../lib/shots";
import type { ResolvedScene, SceneProp } from "../motion/resolveScene";
import { TrackCamera } from "../motion/TrackCamera";
import { TransitionWrap } from "../motion/Transition";
import { characterMotion } from "../motion/useCharacterMotion";
import { propComponent } from "../props";
import { setDef } from "../sets";
import { Character } from "./Character";
import { BACKGROUND, Lighting } from "./Lighting";
import { useMouth } from "./Shot";

/** Below this presence scale a character or prop isn't drawn. */
const HIDDEN = 0.001;

/** With a voice file, speakers' mouths follow its loudness; without one, motion-kit's word lip-flap. */
export const SceneView: React.FC<{ scene: ResolvedScene; voice?: string }> = ({ scene, voice }) =>
  voice ? <VoicedScene scene={scene} voice={voice} /> : <SceneBody scene={scene} mouth={null} />;

const VoicedScene: React.FC<{ scene: ResolvedScene; voice: string }> = ({ scene, voice }) => {
  const f = useCurrentFrame();
  const mouth = useMouth(voice, scene.from + f, scene.cast.some((c) => c.perf.speaks?.length));
  return <SceneBody scene={scene} mouth={mouth} />;
};

const SceneBody: React.FC<{ scene: ResolvedScene; mouth: number | null }> = ({ scene, mouth }) => {
  const f = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const set = setDef(scene.set);
  const bg = set.sky?.[scene.lighting] ?? BACKGROUND[scene.lighting];
  const motions = scene.cast.map((c) => characterMotion(f, fps, c.perf));

  const propNode = (p: SceneProp) => {
    const s = p.scaleAt(f);
    if (f < p.from - 12 || f > p.to || s < HIDDEN) return null;
    const C = propComponent(p.name);
    return (
      <group key={p.key} scale={s}>
        <group position={p.place.at ?? [0, 0, 0]} rotation={p.place.rot ?? [0, 0, 0]} scale={p.place.scale ?? 1}>
          <C f={f - p.zero} d={Math.min(p.to, scene.duration) - p.from} fps={fps} />
        </group>
      </group>
    );
  };
  const slot = (charId: string, kind: "L" | "R" | "head" | "front") =>
    scene.props
      .filter(({ place }) => place.char === charId &&
        (kind === "head" ? place.head : kind === "front" ? place.front : place.hand === kind))
      .map(propNode);
  const SetC = set.component;

  return (
    <TransitionWrap in={scene.transitionIn} out={scene.transitionOut} frame={f} duration={scene.duration + scene.tail} background={bg}>
        <AbsoluteFill style={{ scale: scene.punchAt(f) }}>
          <ThreeCanvas width={width} height={height} gl={{ antialias: true }}>
            <color attach="background" args={[bg]} />
            <Lighting name={scene.lighting} />
            <TrackCamera track={scene.track} frame={f} />
            <SetC f={f} />
            {scene.cast.map((c, i) => {
              const s = c.scaleAt(f);
              if (s < HIDDEN) return null;
              const m = motions[i];
              const legs = c.legsAt(f);
              const motion = { ...m, pose: { ...m.pose, legL: m.pose.legL + legs.legL, legR: m.pose.legR + legs.legR } };
              const pos: Vec3 = c.posAt(f);
              return (
                <group key={c.id} position={pos} scale={s}>
                  <Character
                    def={c.def}
                    pos={[0, 0, 0]}
                    face={m.face}
                    action="idle"
                    frame={f}
                    duration={scene.duration}
                    mouthOpen={mouth === null ? m.mouth : m.speaking ? mouth : 0}
                    motion={motion}
                    facing={c.facingAt(f)}
                    leftHand={slot(c.id, "L")}
                    rightHand={slot(c.id, "R")}
                    headwear={slot(c.id, "head")}
                    front={slot(c.id, "front")}
                  />
                </group>
              );
            })}
            {scene.props.filter((p) => !p.place.char).map(propNode)}
          </ThreeCanvas>
        </AbsoluteFill>
    </TransitionWrap>
  );
};
