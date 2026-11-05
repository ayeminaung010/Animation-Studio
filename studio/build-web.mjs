import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [path.join(here, "web", "main.tsx")],
  outfile: path.join(here, "web", "dist", "app.js"),
  bundle: true,
  format: "esm",
  jsx: "automatic",
  minify: true,
  target: "es2022",
  logLevel: "info",
});
