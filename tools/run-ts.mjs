// Run a small TypeScript tool (no React) by bundling it with esbuild first.
import { buildSync } from "esbuild";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const entry = process.argv[2];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tool-"));
const out = path.join(dir, "tool.mjs");
try {
  buildSync({ entryPoints: [entry], bundle: true, platform: "node", format: "esm", outfile: out, logLevel: "error" });
  process.stdout.write(execFileSync(process.execPath, [out, ...process.argv.slice(3)]));
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
