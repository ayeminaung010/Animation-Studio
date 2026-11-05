import os from "node:os";
import path from "node:path";

export const REPO: string = path.resolve(import.meta.dirname, "..", "..");
export const DATA: string = process.env.STUDIO_DATA ?? path.join(REPO, "studio-data");
export const FILMS: string = path.join(DATA, "films");
export const LEMO_LIB: string = process.env.LEMO_LIB ?? path.join(os.homedir(), "lemo-opuscar");

export function jobDir(id: string): string {
  return path.join(DATA, "jobs", id);
}
