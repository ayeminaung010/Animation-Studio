// Warns when a caption would sit over a face (motion v2). Captions don't move; the warning says where
// to re-stage. Projects each on-set head through the scene camera at every word's first frame.
import * as THREE from "three";
import { CAPTION_HOT_SCALE, CAPTION_PX } from "../components/Captions";
import { HEAD_CENTER_Y } from "../components/Character";
import { HEAD_R } from "../components/Face";
import type { WordV11 } from "../lib/scenes";
import { trackAt } from "./cameraTrack";
import type { ResolvedScene } from "./resolveScene";

export interface CaptionHit {
  scene: string;
  cast: string;
  words: number[];
  text: string[];
}

export const captionFaceHits = (
  scene: ResolvedScene, words: WordV11[], fps: number, width: number, height: number, yRatio: number,
): CaptionHit[] => {
  // Caption band: its tallest (emphasis) size, inside the 7–85% width safe area.
  const half = (CAPTION_PX * CAPTION_HOT_SCALE) / 2 / height;
  const band = { top: yRatio - half, bottom: yRatio + half, left: 0.07, right: 0.85 };
  const cam = new THREE.PerspectiveCamera(40, width / height, 0.05, 200);
  const hits = new Map<string, CaptionHit>();
  words.forEach((w, i) => {
    const f = w.start - scene.from;
    if (f < 0 || f >= scene.duration) return;
    const t = trackAt(f, fps, scene.track);
    cam.position.set(...t.pos);
    cam.fov = t.fov;
    cam.updateProjectionMatrix();
    cam.lookAt(...t.lookAt);
    cam.updateMatrixWorld();
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    for (const c of scene.cast) {
      if (c.scaleAt(f) < 0.5) continue;
      const p = c.posAt(f);
      const head = new THREE.Vector3(p[0], p[1] + HEAD_CENTER_Y, p[2]);
      const ndc = head.clone().project(cam);
      if (ndc.z > 1 || ndc.z < -1) continue; // behind the camera
      const top = head.clone().addScaledVector(up, HEAD_R).project(cam);
      const r = Math.abs(top.y - ndc.y) / 2; // as a fraction of height
      const x = (ndc.x + 1) / 2;
      const y = (1 - ndc.y) / 2;
      const rx = (r * height) / width;
      if (y + r > band.top && y - r < band.bottom && x + rx > band.left && x - rx < band.right) {
        const key = `${scene.id}/${c.id}`;
        const h = hits.get(key) ?? { scene: scene.id, cast: c.id, words: [], text: [] };
        h.words.push(i);
        h.text.push(w.w);
        hits.set(key, h);
      }
    }
  });
  return [...hits.values()];
};
