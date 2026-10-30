// Default camera driven by a TrackSpec (motion v2).
// Set through props, not an effect: ThreeCanvas renders in a useEffect that runs before its children's
// effects, so a camera moved in a child useEffect would show the previous frame's position.
import { PerspectiveCamera } from "@react-three/drei";
import React from "react";
import { useVideoConfig } from "remotion";
import * as THREE from "three";
import { trackAt, type TrackSpec } from "./cameraTrack";

export const TrackCamera: React.FC<{ track: TrackSpec; frame: number }> = ({ track, frame }) => {
  const { fps } = useVideoConfig();
  const { pos, lookAt, fov, rot } = trackAt(frame, fps, track);
  const m = new THREE.Matrix4().lookAt(new THREE.Vector3(...pos), new THREE.Vector3(...lookAt), new THREE.Vector3(0, 1, 0));
  const e = new THREE.Euler().setFromRotationMatrix(m);
  return (
    <PerspectiveCamera makeDefault position={pos} rotation={[e.x + rot[0], e.y + rot[1], e.z + rot[2]]}
      fov={fov} near={0.05} far={200} />
  );
};
