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
