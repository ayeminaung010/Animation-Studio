import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SAFE, watermarkBox, captionBox, ctaBox } from "../lemo-kit/channel.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const masterSh = path.join(here, "..", "lemo-kit", "master.sh");

test("watermark sits top-left inside the safe area", () => {
  const b = watermarkBox(1080, 1920);
  assert.equal(b.x0, 76);
  assert.equal(b.y0, 86);
  assert.ok(b.x1 < 0.85 * 1080);
  assert.ok(b.y1 < 0.2 * 1920);
});

test("captions and CTA stay out of the button zones and do not overlap", () => {
  const c = captionBox(1080, 1920);
  const k = ctaBox(1080, 1920);
  for (const b of [c, k]) {
    assert.ok(b.x0 >= SAFE.x0 * 1080);
    assert.ok(b.x1 <= SAFE.x1 * 1080);
    assert.ok(b.y1 < SAFE.bottom * 1920);
  }
  assert.ok(k.y1 <= c.y0 - 16);
});

test("master.sh refuses a missing project", () => {
  const r = spawnSync("sh", [masterSh, "/nonexistent", "x"]);
  assert.notEqual(r.status, 0);
});
