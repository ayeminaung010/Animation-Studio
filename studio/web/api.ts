import type { Engine, Job, JobStatus, NewJobInput, Outputs } from "../server/types.ts";

export type { Engine, Job, JobEvent, JobStatus, NewJobInput, Outputs, Phase } from "../server/types.ts";

export interface LemoStyle {
  slug: string;
  name: string;
  category: string;
  line: string;
  uses: string[];
}

export interface Suggestion {
  engine: Engine;
  style?: string;
  reason: string;
}

export interface JobDetail {
  job: Job;
  outputs: Outputs;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError(0, "Cannot reach the Studio server.");
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : `Request failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

export const api = {
  listJobs: () => request<Job[]>("GET", "/api/jobs"),
  getJob: (id: string) => request<JobDetail>("GET", `/api/jobs/${encodeURIComponent(id)}`),
  createJob: (input: NewJobInput) => request<Job>("POST", "/api/jobs", input),
  approve: (id: string, notes: string) =>
    request<unknown>("POST", `/api/jobs/${encodeURIComponent(id)}/approve`, notes ? { notes } : {}),
  revise: (id: string, notes: string) =>
    request<unknown>("POST", `/api/jobs/${encodeURIComponent(id)}/revise`, { notes }),
  retry: (id: string) => request<unknown>("POST", `/api/jobs/${encodeURIComponent(id)}/retry`),
  stop: (id: string) => request<unknown>("POST", `/api/jobs/${encodeURIComponent(id)}/stop`),
  clean: (id: string) => request<Job>("POST", `/api/jobs/${encodeURIComponent(id)}/clean`),
  deleteJob: (id: string) => request<unknown>("POST", `/api/jobs/${encodeURIComponent(id)}/delete`),
  styles: () => request<LemoStyle[]>("GET", "/api/styles"),
  suggest: (idea: string) => request<Suggestion>("POST", "/api/suggest", { idea }),
  eventsUrl: (id: string) => `/api/jobs/${encodeURIComponent(id)}/events`,
};

export function fileUrl(repoPath: string): string {
  return `/file?path=${encodeURIComponent(repoPath)}`;
}

export async function fetchText(repoPath: string): Promise<string> {
  const res = await fetch(fileUrl(repoPath));
  if (!res.ok) throw new ApiError(res.status, `Could not load ${repoPath} (${res.status})`);
  return res.text();
}

/** Mirrors `slugify` in server/engines.ts (kept separate: that file imports node: modules). */
export function slugify(idea: string): string {
  const words = idea
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, 5);
  let slug = words.join("-").slice(0, 40).replace(/-+$/, "");
  if (slug.length === 0) return "episode";
  if (slug.length < 3) slug = `episode-${slug}`;
  return slug;
}

export const ENGINE_LABEL: Record<Engine, string> = {
  remotion: "3D Twist Short",
  lemo: "Lemo 2D",
};

export const STATUS_LABEL: Record<JobStatus, string> = {
  running: "Running",
  awaiting_approval: "Needs approval",
  done: "Done",
  failed: "Failed",
  stopped: "Stopped",
};

export function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`;
}
