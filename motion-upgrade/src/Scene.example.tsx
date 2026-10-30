/**
 * Scene.example.tsx — one continuous take with two living characters.
 *
 * Patterns this demonstrates:
 *  - ONE camera track per set (cameraTrack) + handheld drift; no cuts.
 *  - Every action keyed to a WORD frame from TTS timings (atWord).
 *  - Listeners react 6–10 frames AFTER the speaker's word (reactAt).
 *  - Both characters idle with different seeds, so they never move in sync.
 */
import React, { useEffect } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { ThreeCanvas } from '@remotion/three';
import { useThree } from '@react-three/fiber';
import type { PerspectiveCamera } from 'three';
import { Stickman } from './Stickman';
import { cameraTrack, handheld, impactShake, atWord, reactAt, type CameraKey, type WordTiming } from './motion-kit';

// Word timings from your TTS (frames @30fps). Normally loaded from project.json.
const words: WordTiming[] = [
  { w: 'Wait,', start: 12, end: 24 },
  { w: "what's", start: 26, end: 34 },
  { w: 'a', start: 35, end: 37 },
  { w: 'mirror', start: 38, end: 50 },
  { w: 'going', start: 51, end: 58 },
  { w: 'to', start: 59, end: 62 },
  { w: 'do?', start: 63, end: 78 },
  { w: 'Well,', start: 92, end: 104 },
  { w: 'the', start: 105, end: 108 },
  { w: 'racetrack', start: 109, end: 128 },
];

const CameraRig: React.FC<{ keys: CameraKey[]; shakeAt?: number }> = ({ keys, shakeAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  useEffect(() => {
    const c = cameraTrack(frame, fps, keys);
    const h = handheld(frame, fps, 7, 1);
    const s = shakeAt !== undefined ? impactShake(frame, fps, shakeAt, 1) : [0, 0, 0];
    camera.position.set(c.pos[0] + h.pos[0] + s[0], c.pos[1] + h.pos[1] + s[1], c.pos[2] + h.pos[2] + s[2]);
    camera.lookAt(c.lookAt[0], c.lookAt[1], c.lookAt[2]);
    camera.rotation.x += h.rot[0];
    camera.rotation.y += h.rot[1];
    camera.rotation.z += h.rot[2];
    camera.fov = c.fov;
    camera.updateProjectionMatrix();
  }, [frame, fps, keys, camera, shakeAt]);
  return null;
};

export const ExampleScene: React.FC = () => {
  const { width, height } = useVideoConfig();
  const wWait = atWord(words, 'wait');
  const wMirror = atWord(words, 'mirror');
  const wWell = atWord(words, 'well');
  const wTrack = atWord(words, 'racetrack');

  // Framings the camera must be SETTLED on at these word frames.
  const camKeys: CameraKey[] = [
    { frame: 0, pos: [0.2, 1.05, 2.6], lookAt: [0, 0.9, 0], fov: 34 }, // two-shot
    { frame: wMirror, pos: [-0.35, 1.0, 1.7], lookAt: [-0.3, 0.95, 0], fov: 32 }, // push to skeptic
    { frame: wTrack, pos: [0.55, 1.0, 1.6], lookAt: [0.35, 0.95, 0], fov: 30 }, // arc to hero
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: '#9fd3f0' }}>
      <ThreeCanvas width={width} height={height} camera={{ fov: 34, position: [0, 1, 2.6] }}>
        <CameraRig keys={camKeys} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[2, 4, 3]} intensity={1.6} />

        {/* Skeptic: speaks the line, points on "mirror", looks at hero */}
        <Stickman
          seed={11}
          position={[-0.35, 0, 0]}
          facing={0.35}
          torsoColor="#b08a55"
          performance={{
            speaks: words.slice(0, 7),
            stress: [wMirror],
            gaze: [{ frame: 0, yaw: 0.1 }, { frame: wWait - 4, yaw: 0.55 }],
            gestures: [{ arm: 'R', pose: 'point', hitFrame: wMirror, hold: 24 }],
            energy: 1.3,
          }}
        />

        {/* Hero: smug, listens, reacts AFTER the skeptic, then shrugs on "Well" */}
        <Stickman
          seed={42}
          position={[0.35, 0, 0]}
          facing={-0.3}
          performance={{
            gaze: [
              { frame: 0, yaw: 0 },
              { frame: reactAt(wWait), yaw: -0.5 }, // turns to the skeptic
              { frame: wWell + 10, yaw: 0.05, pitch: -0.05 }, // looks back to camera
            ],
            gestures: [{ arm: 'both', pose: 'shrug', hitFrame: wWell, hold: 20 }],
            smile: [{ frame: 0, value: 0.4 }, { frame: wWell, value: 0.9 }],
            energy: 0.6,
          }}
        />

        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[20, 20]} />
          <meshToonMaterial color="#8a5a3b" />
        </mesh>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
