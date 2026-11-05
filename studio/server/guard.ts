import fs from "node:fs";
import path from "node:path";
import { DATA, REPO } from "./paths.ts";

export function isLocalRequest(
  headers: { host?: string; origin?: string },
  port: number,
): boolean {
  const allowedHosts = [`127.0.0.1:${port}`, `localhost:${port}`];
  if (!headers.host || !allowedHosts.includes(headers.host)) return false;
  if (headers.origin !== undefined) {
    const allowedOrigins = allowedHosts.map((h) => `http://${h}`);
    if (!allowedOrigins.includes(headers.origin)) return false;
  }
  return true;
}

function realOrNull(p: string): string | null {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
}

export function resolveServable(p: string, roots: string[]): string | null {
  const real = realOrNull(path.resolve(REPO, p));
  if (real === null) return null;
  for (const root of roots) {
    const r = realOrNull(root);
    if (r !== null && (real === r || real.startsWith(r + path.sep))) return real;
  }
  return null;
}

export const SERVABLE_ROOTS: string[] = [
  path.join(REPO, "out"),
  path.join(REPO, "episodes"),
  DATA,
];
