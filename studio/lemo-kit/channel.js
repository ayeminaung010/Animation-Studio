// @InkwellLife channel layer for lemo films: watermark pill, "Like / SUBSCRIBE" card, caption safe area.
// Plain ES module, no imports, canvas 2D only. COPY this file into the film folder (the film page is served
// from /@film/, so it cannot import it from anywhere else) and import it as './channel.js'.
// Boxes are in pixels of a W×H frame (1080×1920 for Shorts) and are derived from fractions of W / H.

export const SAFE = { x0: 0.07, x1: 0.85, bottom: 0.80 };   // fractions of W / H: keep text and key action inside

const WATERMARK_TEXT = '@InkwellLife';
const WATERMARK_FONT = '600 30px Jost, system-ui, sans-serif';
const WATERMARK_PAD = 22;                // horizontal padding of the pill, each side
const WATERMARK_H = 56;
const INK = '#2B2420';
const TOMATO = '#D9573B';
const MUSTARD = '#E8B43A';

const centreX = W => Math.round(((SAFE.x0 + SAFE.x1) / 2) * W);

function spaced(ctx, px) { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; }

// Top-left pill. Pass ctx to size it from the real text width; without ctx the text is taken as 260 px wide.
export function watermarkBox(W, H, ctx) {
  let tw = 260 - 2 * WATERMARK_PAD;
  if (ctx) {
    ctx.save(); ctx.font = WATERMARK_FONT; spaced(ctx, 1); tw = ctx.measureText(WATERMARK_TEXT).width; ctx.restore();
  }
  const x0 = Math.round(W * SAFE.x0), y0 = Math.round(H * 0.045);
  return { x0, y0, x1: Math.round(x0 + tw + 2 * WATERMARK_PAD), y1: y0 + WATERMARK_H };
}

// Largest area a caption may occupy: centred in the safe area, 88 px tall, at 67.7 % of the height.
export function captionBox(W, H) {
  const cx = centreX(W), w = 0.63 * W, y0 = Math.round(0.677 * H);
  return { x0: Math.round(cx - w / 2), y0, x1: Math.round(cx + w / 2), y1: y0 + 88 };
}

// "Like / SUBSCRIBE" card: same centre line as captions, 16 px above the caption box.
export function ctaBox(W, H) {
  const cx = centreX(W), w = 560, h = 96, y1 = captionBox(W, H).y0 - 16;
  return { x0: Math.round(cx - w / 2), y0: y1 - h, x1: Math.round(cx + w / 2), y1 };
}

function pillPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Frosted glass: a blurred copy of what is already on the canvas under a pale veil, hairline white edge.
// Draw it AFTER the picture and BEFORE its own text.
export function glass(ctx, x, y, w, h, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha;
  pillPath(ctx, x, y, w, h, h / 2);
  ctx.save(); ctx.clip();
  ctx.filter = 'blur(10px)';
  ctx.drawImage(ctx.canvas, x - 24, y - 24, w + 48, h + 48, x - 24, y - 24, w + 48, h + 48);
  ctx.filter = 'none';
  ctx.fillStyle = 'rgba(255,252,244,0.42)'; ctx.fillRect(x, y, w, h);
  ctx.restore();
  pillPath(ctx, x, y, w, h, h / 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}

// Call LAST in every frame (above the captions).
export function drawWatermark(ctx, W, H) {
  const b = watermarkBox(W, H, ctx);
  glass(ctx, b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0, 0.9);
  ctx.save();
  ctx.font = WATERMARK_FONT; spaced(ctx, 1);
  ctx.fillStyle = 'rgba(43,36,32,0.72)'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(WATERMARK_TEXT, b.x0 + WATERMARK_PAD, b.y0 + 38);
  ctx.restore();
}

// Thumbs-up glyph on a 24×24 grid, built from paths (no emoji font): cuff + hand with the thumb up.
function thumbGlyph(ctx) {
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(8, 10.5);
  ctx.lineTo(11.4, 3.4);
  ctx.quadraticCurveTo(12.1, 1.6, 13.8, 2.2);
  ctx.quadraticCurveTo(15.3, 2.8, 15, 4.4);
  ctx.lineTo(14, 8.5);
  ctx.lineTo(19.8, 8.5);
  ctx.quadraticCurveTo(22.2, 8.5, 21.9, 10.8);
  ctx.lineTo(20.9, 18.8);
  ctx.quadraticCurveTo(20.6, 21, 18.4, 21);
  ctx.lineTo(10, 21);
  ctx.quadraticCurveTo(8, 21, 8, 19);
  ctx.closePath();
  ctx.fill();
  // finger creases
  ctx.strokeStyle = 'rgba(255,252,244,0.55)'; ctx.lineWidth = 0.7; ctx.lineCap = 'round';
  for (const y of [12.6, 15.2, 17.8]) { ctx.beginPath(); ctx.moveTo(12, y); ctx.lineTo(19.4, y); ctx.stroke(); }
  // cuff
  ctx.fillStyle = MUSTARD;
  ctx.beginPath();
  ctx.moveTo(1.2, 9.6); ctx.lineTo(5.6, 9.6); ctx.lineTo(5.6, 21.6); ctx.lineTo(1.2, 21.6);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.lineJoin = 'round'; ctx.stroke();
}

const clamp01 = v => Math.max(0, Math.min(1, v));
const backEase = (t, s = 1.9) => { t = clamp01(t) - 1; return 1 + t * t * ((s + 1) * t + s); };

// Closing card. t = current time (s), tLike = start of the closing line "Like and subscribe for more."
// (from voices/words.json). Nothing before tLike; pops in over 0.3 s; the thumb nods once right after.
export function drawCta(ctx, W, H, t, tLike) {
  if (!(t >= tLike)) return;
  const k = backEase((t - tLike) / 0.3);
  if (k <= 0) return;
  const b = ctaBox(W, H), w = b.x1 - b.x0, h = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy);
  glass(ctx, b.x0, b.y0, w, h, 0.95);

  const nod = 0.25 * Math.sin(clamp01((t - tLike - 0.3) / 0.4) * Math.PI);
  ctx.save();
  ctx.translate(b.x0 + 64, b.y0 + 48); ctx.rotate(-nod); ctx.scale(1.7, 1.7); ctx.translate(-12, -12);
  thumbGlyph(ctx);
  ctx.restore();

  ctx.font = '600 40px Jost, system-ui, sans-serif'; spaced(ctx, 0);
  ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('Like', b.x0 + 108, b.y0 + 62);

  pillPath(ctx, b.x0 + 236, b.y0 + 18, 296, 60, 30);
  ctx.fillStyle = TOMATO; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  ctx.font = '28px Slab, "Jost", system-ui, sans-serif'; spaced(ctx, 2);
  ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center';
  ctx.fillText('SUBSCRIBE', b.x0 + 384, b.y0 + 60);
  ctx.restore();
}
