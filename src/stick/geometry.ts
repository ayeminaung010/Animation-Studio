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

export const WATERMARK = { text: "Inkwell Life", x: 0.07 * W, y: 0.05 * H, px: 36, opacity: 0.45 } as const;
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
  for (const p of l.props ?? []) if (p.x > 0.85 * W) out.push(`${id}: prop ${p.name} in the right 15%`);
  return out;
};
