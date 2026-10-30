// Before/after demo: same scene, same words. Left = how v1 renders moved
// (frozen bodies, linear tweens, snaps). Right = motion-kit layers.
import * as THREE from 'three';
import {
  idle, breathe, blink, gazeChain, gesture, mouth, talkNods, followThrough,
  cameraTrack, handheld, lerp, type WordTiming, type CameraKey, type GazeKey,
} from '../src/motion-kit';

const FPS = 30;
const W = 1080, H = 960;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H);
renderer.setScissorTest(true);
document.body.appendChild(renderer.domElement);

const INK = 0x16161f;
const toon = (c: number) => new THREE.MeshToonMaterial({ color: c });
const ink = new THREE.MeshBasicMaterial({ color: INK });

function outline(mesh: THREE.Mesh, s = 1.06) {
  const o = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
  o.scale.setScalar(s);
  mesh.add(o);
  return mesh;
}

interface Rig {
  root: THREE.Group; hips: THREE.Group; torso: THREE.Group; head: THREE.Group; hat: THREE.Group;
  armL: THREE.Group; armR: THREE.Group; eyes: THREE.Mesh[]; mouth: THREE.Mesh;
}

function makeRig(torsoColor: number, hatColor: number, topHat: boolean): Rig {
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.42; root.add(hips);
  for (const x of [-0.05, 0.05]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.42, 8), ink);
    leg.position.set(x, -0.21, 0); hips.add(leg);
  }
  const torso = new THREE.Group(); torso.position.y = 0.16; hips.add(torso);
  torso.add(outline(new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.12, 6, 16), toon(torsoColor)), 1.05));
  const mkArm = (x: number) => {
    const g = new THREE.Group(); g.position.set(x, 0.1, 0);
    const a = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 8), ink); a.position.y = -0.16; g.add(a);
    const hnd = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 12), toon(0xf4efe6)); hnd.position.y = -0.33; g.add(outline(hnd, 1.15));
    torso.add(g); return g;
  };
  const armR = mkArm(0.1), armL = mkArm(-0.1);
  const head = new THREE.Group(); head.position.y = 0.36; torso.add(head);
  head.add(outline(new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 32), toon(0xffffff)), 1.03));
  const eyes = [-0.065, 0.065].map((x) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), ink); e.position.set(x, 0.03, 0.19); head.add(e); return e;
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 12), ink); m.position.set(0, -0.075, 0.185); head.add(m);
  const hat = new THREE.Group(); hat.position.y = 0.17; head.add(hat);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(topHat ? 0.2 : 0.25, topHat ? 0.2 : 0.25, 0.016, 32), toon(hatColor));
  hat.add(outline(brim, 1.04));
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, topHat ? 0.2 : 0.08, 32), toon(hatColor));
  crown.position.y = topHat ? 0.1 : 0.045; hat.add(outline(crown, 1.05));
  return { root, hips, torso, head, hat, armL, armR, eyes, mouth: m };
}

function makeScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd3f0);
  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(2, 4, 3); scene.add(d);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), toon(0x8a5a3b)); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  for (let i = -6; i <= 6; i++) { // deck planks for parallax
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.002, 30), ink); p.position.set(i * 0.25, 0.001, 0); scene.add(p);
  }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(6, 0.06, 0.06), toon(0x5b3a26)); rail.position.set(0, 0.75, -0.9); scene.add(rail);
  for (let i = -6; i <= 6; i++) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.75, 0.05), toon(0x5b3a26)); post.position.set(i * 0.45, 0.375, -0.9); scene.add(post);
  }
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(40, 10), toon(0x2fa3a8)); sea.position.set(0, 0.3, -6); scene.add(sea);
  const skeptic = makeRig(0x2d3550, 0x1d2233, false);
  const hero = makeRig(0x56d1b7, 0x141414, true);
  skeptic.root.position.set(-0.36, 0, 0); hero.root.position.set(0.36, 0, 0);
  scene.add(skeptic.root, hero.root);
  return { scene, skeptic, hero };
}

// Shared script: skeptic speaks, hero reacts, then shrugs.
const words: WordTiming[] = [
  { w: 'Wait,', start: 12, end: 26 }, { w: "what's", start: 28, end: 36 }, { w: 'a', start: 37, end: 39 },
  { w: 'mirror', start: 40, end: 54 }, { w: 'going', start: 55, end: 62 }, { w: 'to', start: 63, end: 66 },
  { w: 'do?', start: 67, end: 84 },
];
const W_WAIT = 12, W_MIRROR = 40, W_WELL = 108;
const camKeys: CameraKey[] = [
  { frame: 0, pos: [0.1, 1.0, 3.3], lookAt: [0, 0.8, 0], fov: 38 },
  { frame: W_MIRROR, pos: [-0.55, 1.0, 2.35], lookAt: [-0.3, 0.85, 0], fov: 36 },
  { frame: W_WELL + 6, pos: [0.7, 1.0, 2.3], lookAt: [0.34, 0.85, 0], fov: 35 },
  { frame: 175, pos: [0.35, 1.05, 2.7], lookAt: [0.15, 0.82, 0], fov: 37 },
];

const before = makeScene();
const after = makeScene();
const camB = new THREE.PerspectiveCamera(36, (W / 2) / H, 0.05, 100);
const camA = new THREE.PerspectiveCamera(36, (W / 2) / H, 0.05, 100);

const step = (f: number, a: number, b: number) => Math.min(1, Math.max(0, (f - a) / (b - a)));

function poseBefore(f: number) {
  const { skeptic, hero } = before;
  skeptic.root.rotation.y = 0.35; hero.root.rotation.y = -0.3;
  // linear arm tween, held rigid, linear drop
  const up = step(f, W_MIRROR - 3, W_MIRROR + 3) - step(f, W_MIRROR + 30, W_MIRROR + 36);
  skeptic.armR.rotation.z = lerp(0.12, 1.45, up); skeptic.armL.rotation.z = -0.12; hero.armL.rotation.z = -0.12;
  // mouth on/off square wave
  const speaking = words.some((w) => f >= w.start && f <= w.end);
  hero.mouth.scale.y = 0.3;
  skeptic.mouth.scale.y = speaking && Math.floor(f / 4) % 2 === 0 ? 1.4 : 0.3;
  // hero head SNAPS
  hero.head.rotation.y = f >= W_WAIT ? -0.35 : 0;
  if (f >= W_WELL) hero.head.rotation.y = 0;
  const sh = step(f, W_WELL - 2, W_WELL + 2) - step(f, W_WELL + 20, W_WELL + 24);
  hero.armR.rotation.z = lerp(0.12, 0.75, sh); hero.armL.rotation.z = -lerp(0.12, 0.75, sh);
  // camera: hard cuts between framings, each with a constant-speed linear zoom
  const k = f < W_MIRROR ? 0 : f < W_WELL ? 1 : 2;
  const seg = [0, W_MIRROR, W_WELL, 180];
  const t = (f - seg[k]) / (seg[k + 1] - seg[k]);
  const c = camKeys[k];
  camB.position.set(c.pos[0], c.pos[1], c.pos[2] - t * 0.35);
  camB.lookAt(c.lookAt[0], c.lookAt[1], c.lookAt[2]);
  camB.fov = c.fov; camB.updateProjectionMatrix();
}

function applyLiving(r: Rig, f: number, seed: number, opts: {
  facing: number; gaze: GazeKey[]; speaks?: WordTiming[]; stress?: number[]; energy: number;
  gest?: { arm: 'L' | 'R' | 'both'; z: number; x: number; hit: number; hold: number }[];
}) {
  const id = idle(f, FPS, seed, opts.energy);
  const br = breathe(f, FPS, seed);
  const gz = gazeChain(f, FPS, opts.gaze);
  const lid = blink(f, FPS, seed, gz.blinkAt);
  r.root.rotation.y = opts.facing + gz.bodyYaw;
  r.hips.position.set(id.hipX, 0.42 + id.hipY, 0);
  r.hips.rotation.z = id.lean;
  r.torso.scale.set(br.chestScaleX, br.chestScaleY, br.chestScaleX);
  let wR = 0, wL = 0, zR = 0, zL = 0, xR = 0, xL = 0, lift = 0;
  for (const g of opts.gest ?? []) {
    const w = gesture(f, FPS, { hitFrame: g.hit, hold: g.hold });
    if (g.arm !== 'L') { wR = w; zR = g.z; xR = g.x; }
    if (g.arm !== 'R') { wL = w; zL = g.z; xL = g.x; }
    if (g.arm === 'both') lift += Math.max(0, w) * 0.035;
  }
  r.armR.rotation.set(lerp(0, xR, wR), 0, lerp(0.12, zR || 0.12, wR) + id.armR);
  r.armL.rotation.set(lerp(0, xL, wL), 0, -(lerp(0.12, zL || 0.12, wL) + id.armL));
  r.armR.position.y = r.armL.position.y = 0.1 + br.shoulderY + lift;
  const nod = opts.stress ? talkNods(f, FPS, opts.stress) : 0;
  r.head.rotation.set(id.headPitch + gz.headPitch + nod, id.headYaw + gz.headYaw, id.headTilt);
  for (const e of r.eyes) { e.scale.y = Math.max(0.08, 1 - lid); }
  r.eyes.forEach((e, i) => { // keep eyes ON the sphere surface while they look around
    const th = (i === 0 ? -0.33 : 0.33) + gz.eyesYaw * 0.55, ph = 0.15 - gz.eyesPitch * 0.4;
    e.position.set(0.19 * Math.sin(th) * Math.cos(ph), 0.19 * Math.sin(ph), 0.19 * Math.cos(th) * Math.cos(ph));
  });
  r.mouth.scale.y = 0.3 + (opts.speaks ? mouth(f, opts.speaks, seed) : 0) * 1.5;
  const tiltAt = (k: number) => idle(k, FPS, seed, opts.energy).headTilt;
  const pitchAt = (k: number) => idle(k, FPS, seed, opts.energy).headPitch + gazeChain(k, FPS, opts.gaze).headPitch + (opts.stress ? talkNods(k, FPS, opts.stress) : 0);
  r.hat.rotation.z = (followThrough(f, FPS, tiltAt) - id.headTilt) * 1.8;
  r.hat.rotation.x = (followThrough(f, FPS, pitchAt) - r.head.rotation.x) * 1.8;
}

function poseAfter(f: number) {
  applyLiving(after.skeptic, f, 11, {
    facing: 0.35, energy: 1.4, speaks: words, stress: [W_MIRROR, 67],
    gaze: [{ frame: 0, yaw: 0.1 }, { frame: W_WAIT - 4, yaw: 0.5 }],
    gest: [{ arm: 'R', z: 1.45, x: -0.35, hit: W_MIRROR, hold: 26 }],
  });
  applyLiving(after.hero, f, 42, {
    facing: -0.3, energy: 0.7,
    gaze: [{ frame: 0, yaw: 0 }, { frame: W_WAIT + 7, yaw: -0.55 }, { frame: W_WELL + 8, yaw: 0.05, pitch: -0.04 }],
    gest: [{ arm: 'both', z: 0.75, x: 0.5, hit: W_WELL, hold: 20 }],
  });
  const c = cameraTrack(f, FPS, camKeys);
  const h = handheld(f, FPS, 7, 2);
  camA.position.set(c.pos[0] + h.pos[0], c.pos[1] + h.pos[1], c.pos[2]);
  camA.lookAt(c.lookAt[0], c.lookAt[1], c.lookAt[2]);
  camA.rotation.x += h.rot[0]; camA.rotation.y += h.rot[1]; camA.rotation.z += h.rot[2];
  camA.fov = c.fov; camA.updateProjectionMatrix();
}

(window as any).renderFrame = (f: number) => {
  poseBefore(f); poseAfter(f);
  renderer.setViewport(0, 0, W / 2, H); renderer.setScissor(0, 0, W / 2, H); renderer.render(before.scene, camB);
  renderer.setViewport(W / 2, 0, W / 2, H); renderer.setScissor(W / 2, 0, W / 2, H); renderer.render(after.scene, camA);
  return true;
};
(window as any).ready = true;
