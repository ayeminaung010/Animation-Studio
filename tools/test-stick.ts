// Checks for the 2D stickman renderer (src/stick): run with npm test.
import assert from "node:assert/strict";
import { checkLayout, headBox, talkerAt, WATERMARK_BOX, type StickLayout } from "../src/stick/geometry";
import { pose, POSES } from "../src/stick/poses";
import { stickProp } from "../src/stick/props";

for (const n of Object.keys(POSES)) assert.deepEqual(POSES[n as keyof typeof POSES](17, 30), POSES[n as keyof typeof POSES](17, 30), `${n} is deterministic`);
assert.notDeepEqual(POSES.idle(0, 30), POSES.idle(20, 30), "idle breathes");
assert.throws(() => pose("moonwalk"), /src\/stick\/poses\.ts/);

assert.throws(() => stickProp("toaster-9000"), /src\/stick\/props\.tsx/);
assert(WATERMARK_BOX.x1 < 0.85 * 1080 && WATERMARK_BOX.y1 < 0.2 * 1920, "watermark out of the button zone");
assert(WATERMARK_BOX.x0 >= 0.07 * 1080, "watermark inside the left safe margin");
// Only the latest started word's speaker talks; nobody before the first word.
const said = [{ text: "Hi", start: 0, end: 5, speaker: "agent" }, { text: "Yo", start: 6, end: 9, speaker: "grandpa" }];
assert.equal(talkerAt(said, 7), "grandpa");
assert.equal(talkerAt(said, 3), "agent");
assert.equal(talkerAt(said, -1), undefined);
// Layout checks: a clean split passes; a face on the caption line, in the button zone or a prop in the right 15% fail.
const ok: StickLayout = { panel: "split", grandpa: { x: 420, y: 760, scale: 1.2 }, agent: { x: 560, y: 1660, scale: 1.2 }, props: [{ name: "router", x: 760, y: 700 }] };
assert.deepEqual(checkLayout("ok", ok), []);
assert.match(checkLayout("cap", { ...ok, grandpa: { x: 420, y: 1250, scale: 1.2 } }).join(), /under captions/);
assert.match(checkLayout("low", { ...ok, agent: { x: 560, y: 2000, scale: 1.2 } }).join(), /button zone/);
assert.match(checkLayout("prop", { ...ok, props: [{ name: "router", x: 1000, y: 700 }] }).join(), /right 15%/);
assert(headBox(420, 760, 1.2).y1 < 960);
// Props are checked by their drawn box, not their anchor: a wide prop near the edge, or a timed prop low in the frame, fails.
assert.match(checkLayout("wide", { ...ok, props: [{ name: "fridge", x: 820, y: 900, state: "unplugged" }] }).join(), /right 15%/);
assert.match(checkLayout("low", { ...ok, props: [{ name: "coffee-machine", x: 600, y: 1830, startAt: { word: "x" } }] }).join(), /bottom 20%/);
assert.deepEqual(checkLayout("set", { ...ok, props: [{ name: "desk", x: 330, y: 1830 }] }), []); // set dressing may sit low

console.log("stick: ok");
