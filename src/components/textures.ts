// Canvas-drawn textures (receipts, signs, calendars, wallpaper). Built once per key.
import { random } from "remotion";
import * as THREE from "three";

const cache = new Map<string, THREE.CanvasTexture>();

export const canvasTexture = (
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
) => {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  cache.set(key, tex);
  return tex;
};

export const FONT = `"Fredoka", "Baloo 2", "Arial Rounded MT Bold", "DejaVu Sans", sans-serif`;
export const MONO = `"DejaVu Sans Mono", "Courier New", monospace`;

const zigzag = (ctx: CanvasRenderingContext2D, w: number, y: number, tooth: number, down: boolean) => {
  const n = Math.round(w / tooth);
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * w;
    ctx.lineTo(x, y + (i % 2 === 0 ? 0 : down ? tooth * 0.6 : -tooth * 0.6));
  }
};

export interface ReceiptLine {
  text: string;
  size: number;
  bold?: boolean;
  color?: string;
  gap?: number;
}

/** A paper receipt with torn zig-zag edges. Lines are drawn top to bottom, centred. */
export const receiptTexture = (key: string, lines: ReceiptLine[], w = 512, h = 900) =>
  canvasTexture(`receipt:${key}`, w, h, (ctx) => {
    const tooth = 22;
    ctx.fillStyle = "#FFFDF4";
    ctx.beginPath();
    ctx.moveTo(0, tooth);
    zigzag(ctx, w, tooth, tooth, false);
    ctx.lineTo(w, h - tooth);
    ctx.lineTo(w, h - tooth);
    for (let i = Math.round(w / tooth); i >= 0; i--) {
      const x = (i / Math.round(w / tooth)) * w;
      ctx.lineTo(x, h - tooth + (i % 2 === 0 ? 0 : tooth * 0.6));
    }
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#141414";
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    let y = tooth + 40;
    for (const l of lines) {
      if (l.text === "---") {
        ctx.setLineDash([16, 12]);
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#8A8170";
        ctx.beginPath();
        ctx.moveTo(40, y + 10);
        ctx.lineTo(w - 40, y + 10);
        ctx.stroke();
        ctx.setLineDash([]);
        y += 34;
        continue;
      }
      ctx.fillStyle = l.color ?? "#1A1A1A";
      ctx.font = `${l.bold ? "bold " : ""}${l.size}px ${l.bold ? FONT : MONO}`;
      // Shrink-to-fit so long lines never spill off the paper.
      let size = l.size;
      while (ctx.measureText(l.text).width > w - 60 && size > 12) {
        size -= 2;
        ctx.font = `${l.bold ? "bold " : ""}${size}px ${l.bold ? FONT : MONO}`;
      }
      ctx.fillText(l.text, w / 2, y);
      y += size * 1.15 + (l.gap ?? 10);
    }
  });

/** Flat colour sign with bold rounded text. */
export const signTexture = (text: string, bg: string, fg: string, w = 1024, h = 256) =>
  canvasTexture(`sign:${text}:${bg}:${fg}:${w}x${h}`, w, h, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let size = h * 0.62;
    ctx.font = `bold ${size}px ${FONT}`;
    while (ctx.measureText(text).width > w * 0.9) {
      size -= 4;
      ctx.font = `bold ${size}px ${FONT}`;
    }
    ctx.fillText(text, w / 2, h / 2 + size * 0.04);
  });

export const stripesTexture = (a: string, b: string, n = 10) => {
  const t = canvasTexture(`stripes:${a}:${b}:${n}`, 256, 256, (ctx, w, h) => {
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? a : b;
      ctx.fillRect((i / n) * w, 0, w / n, h);
    }
  });
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
};

export const checkerTexture = (a: string, b: string, n = 8) => {
  const t = canvasTexture(`checker:${a}:${b}:${n}`, 256, 256, (ctx, w, h) => {
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        ctx.fillStyle = (i + j) % 2 ? a : b;
        ctx.fillRect((i / n) * w, (j / n) * h, w / n, h / n);
      }
  });
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
};

/** Worn wooden floorboards running away from the camera: per-plank tone, grain, seams and nail heads. */
export const woodFloorTexture = (planks = 8) => {
  const t = canvasTexture(`wood-floor:${planks}`, 1024, 1024, (ctx, w, h) => {
    const pw = w / planks;
    for (let i = 0; i < planks; i++) {
      const x = i * pw;
      const tone = random(`plank-${i}`);
      ctx.fillStyle = `hsl(26, ${26 + tone * 12}%, ${30 + tone * 10}%)`;
      ctx.fillRect(x, 0, pw, h);
      // Grain: thin wavy darker lines along the plank.
      ctx.strokeStyle = "rgba(60, 32, 14, 0.28)";
      ctx.lineWidth = 2;
      for (let g = 0; g < 7; g++) {
        const gx = x + pw * (0.1 + 0.8 * random(`grain-${i}-${g}`));
        ctx.beginPath();
        for (let y = 0; y <= h; y += 32) ctx.lineTo(gx + Math.sin(y * 0.012 + g * 1.7) * 5, y);
        ctx.stroke();
      }
      // Board ends at a different height per plank, with two nails each side.
      const end = h * random(`end-${i}`);
      ctx.fillStyle = "rgba(40, 20, 8, 0.75)";
      ctx.fillRect(x, end, pw, 4);
      for (const ny of [end - 14, end + 18]) {
        for (const nx of [x + pw * 0.2, x + pw * 0.8]) {
          ctx.beginPath();
          ctx.arc(nx, ny, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.fillRect(x, 0, 5, h); // seam between planks
    }
  });
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
};
