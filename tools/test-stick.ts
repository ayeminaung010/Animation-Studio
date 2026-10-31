// Checks for the 2D stickman renderer (src/stick): run with npm test.
import assert from "node:assert/strict";
import { pose, POSES } from "../src/stick/poses";

for (const n of Object.keys(POSES)) assert.deepEqual(POSES[n as keyof typeof POSES](17, 30), POSES[n as keyof typeof POSES](17, 30), `${n} is deterministic`);
assert.notDeepEqual(POSES.idle(0, 30), POSES.idle(20, 30), "idle breathes");
assert.throws(() => pose("moonwalk"), /src\/stick\/poses\.ts/);

console.log("stick: ok");
