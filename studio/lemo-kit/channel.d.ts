export const SAFE: { x0: number; x1: number; bottom: number };
export interface Box { x0: number; y0: number; x1: number; y1: number }
export function watermarkBox(W: number, H: number, ctx?: CanvasRenderingContext2D): Box;
export function captionBox(W: number, H: number): Box;
export function ctaBox(W: number, H: number): Box;
export function glass(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, alpha?: number): void;
export function drawWatermark(ctx: CanvasRenderingContext2D, W: number, H: number): void;
export function drawCta(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, tLike: number): void;
