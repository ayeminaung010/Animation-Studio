// Stickman body dimensions (px at scale 1) and the boxes the layout checks use.
// The anchor (x, y) of a stickman is the hip; y grows down like SVG.
export const BODY = { torso: 170, neck: 10, headR: 70, upperArm: 78, foreArm: 72, thigh: 88, shin: 86 } as const;

/** Head centre, before lean and lift. */
export const headCenter = (x: number, y: number, scale: number) => ({ x, y: y - (BODY.torso + BODY.neck + BODY.headR) * scale });

/** Box around head + hair/headset, with room for a jump. */
export const headBox = (x: number, y: number, scale: number) => {
  const c = headCenter(x, y, scale);
  const r = (BODY.headR + 14) * scale;
  return { x0: c.x - r, y0: c.y - r - 50 * scale, x1: c.x + r, y1: c.y + r };
};

export const W = 1080;
export const H = 1920;

/** Split-screen: Grandpa's room above this line, the Agent's office below. Captions sit on it. */
export const SPLIT_Y = 960;
export const CAPTION_Y = SPLIT_Y / H;
/** Half-height of the caption band: emphasis words are CAPTION_PX 128 × 1.3 ≈ 166 px tall (Captions.tsx). */
export const CAPTION_HALF = 100;

export const WATERMARK = { text: "@InkwellLife", x: 0.07 * W, y: 0.05 * H, px: 36, opacity: 0.45 } as const;
/** Generous box around the watermark text (Fredoka 36 px ≈ 0.62 em per glyph). */
export const WATERMARK_BOX = {
  x0: WATERMARK.x,
  y0: WATERMARK.y - WATERMARK.px,
  x1: WATERMARK.x + WATERMARK.text.length * WATERMARK.px * 0.62,
  y1: WATERMARK.y + 10,
};

export type PanelName = "split" | "grandpa" | "agent";
export interface Placed {
  x: number;
  y: number;
  scale: number;
  flip?: boolean;
}
export interface PropPlacement {
  name: string;
  x: number;
  /** Bottom centre of the prop. */
  y: number;
  scale?: number;
  state?: string;
  /** Pops in on a spoken word (same form as the cue sheet). */
  startAt?: number | { word: string; offset?: number };
}
/** Staging for one shot in 1080×1920 px. A character missing here is off-panel (no body, no mouth). */
export interface StickLayout {
  panel: PanelName;
  grandpa?: Placed;
  agent?: Placed;
  props?: PropPlacement[];
}

/** Who is talking at frame f: the speaker of the latest word that has started. */
export const talkerAt = (words: { start: number; speaker?: string }[], f: number) => words.filter((w) => w.start <= f).pop()?.speaker;

/** Drawn size of each prop at scale 1 around its bottom-centre anchor (src/stick/props.tsx): half-width, height. */
export const PROP_SIZE: Record<string, { hw: number; h: number }> = {
  router: { hw: 110, h: 170 }, computer: { hw: 170, h: 290 }, desk: { hw: 230, h: 190 }, armchair: { hw: 190, h: 330 },
  fridge: { hw: 190, h: 460 }, oven: { hw: 150, h: 280 }, "cereal-box": { hw: 80, h: 240 }, "coffee-machine": { hw: 140, h: 220 },
  window: { hw: 150, h: 260 }, lamp: { hw: 70, h: 400 }, mug: { hw: 60, h: 70 },
};
/** Every room slowly pushes in to this scale (StickShot), so boxes are checked at the end of the shot. */
export const MAX_ZOOM = 1.04;

/** Problems with one shot's staging: faces under the caption band or in the YouTube button zone, props in the right 15%. */
export const checkLayout = (id: string, l: StickLayout): string[] => {
  const out: string[] = [];
  const top = SPLIT_Y - CAPTION_HALF;
  const bottom = SPLIT_Y + CAPTION_HALF;
  for (const who of ["grandpa", "agent"] as const) {
    const p = l[who];
    if (!p) continue;
    const b = headBox(p.x, p.y, p.scale);
    if (!(b.y1 < top || b.y0 > bottom)) out.push(`${id}: ${who}'s face under captions`);
    if (b.y1 > 0.8 * H || b.x1 > 0.85 * W || b.x0 < 0) out.push(`${id}: ${who}'s face in the button zone`);
  }
  for (const p of l.props ?? []) {
    const size = PROP_SIZE[p.name];
    if (!size) {
      out.push(`${id}: prop ${p.name} has no PROP_SIZE in src/stick/geometry.ts`);
      continue;
    }
    const s = (p.scale ?? 1) * MAX_ZOOM;
    if (p.x + size.hw * s > 0.85 * W) out.push(`${id}: prop ${p.name} in the right 15%`);
    // Set dressing may sit low; a prop that pops in on a word is a story beat and must stay visible.
    if (p.startAt !== undefined && p.y - size.h * s * 0.5 > 0.8 * H) out.push(`${id}: prop ${p.name} in the bottom 20%`);
  }
  return out;
};
