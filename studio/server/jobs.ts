import fs from "node:fs";
import path from "node:path";
import type { Job, JobEvent, NewJobInput } from "./types.ts";

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export class JobError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "JobError";
    this.status = status;
  }
}

export class JobStore {
  private readonly jobsDir: string;
  private readonly isSlugTaken: (slug: string) => boolean;
  private readonly jobs = new Map<string, Job>();
  private readonly eventCounts = new Map<string, number>();

  constructor(dataDir: string, isSlugTaken: (slug: string) => boolean) {
    this.jobsDir = path.join(dataDir, "jobs");
    this.isSlugTaken = isSlugTaken;
    fs.mkdirSync(this.jobsDir, { recursive: true });
    const loaded: Job[] = [];
    for (const entry of fs.readdirSync(this.jobsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const file = path.join(this.jobsDir, entry.name, "job.json");
      if (!fs.existsSync(file)) continue;
      try {
        loaded.push(JSON.parse(fs.readFileSync(file, "utf8")) as Job);
      } catch {
        // A corrupt job.json must not take the whole studio down; skip it.
      }
    }
    loaded.sort((a, b) => a.createdAt - b.createdAt);
    for (const job of loaded) this.jobs.set(job.id, job);
  }

  create(input: NewJobInput & { slug: string }): Job {
    const { slug } = input;
    if (typeof slug !== "string" || slug.length < 3 || slug.length > 40 || !SLUG_RE.test(slug)) {
      throw new JobError(400, `invalid slug "${String(slug)}": use 3-40 lowercase letters, digits and single hyphens`);
    }
    if (this.isSlugTaken(slug) || [...this.jobs.values()].some((j) => j.slug === slug)) {
      throw new JobError(409, `slug "${slug}" is already taken`);
    }
    const now = Date.now();
    const job: Job = {
      id: `${now.toString(36)}-${slug}`,
      slug,
      engine: input.engine,
      ...(input.style !== undefined ? { style: input.style } : {}),
      idea: input.idea,
      seconds: input.seconds,
      phase: "plan",
      status: "running",
      costUsd: 0,
      createdAt: now,
      phaseStartedAt: now,
    };
    this.jobs.set(job.id, job);
    this.eventCounts.set(job.id, 0);
    this.write(job);
    return job;
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  list(): Job[] {
    return [...this.jobs.values()].reverse().sort((a, b) => b.createdAt - a.createdAt);
  }

  update(id: string, patch: Partial<Job>): Job {
    const current = this.jobs.get(id);
    if (!current) throw new JobError(404, `no such job: ${id}`);
    const next: Job = { ...current, ...patch, id: current.id };
    this.jobs.set(id, next);
    this.write(next);
    return next;
  }

  appendEvent(id: string, ev: JobEvent): number {
    if (!this.jobs.has(id)) throw new JobError(404, `no such job: ${id}`);
    const index = this.countEvents(id);
    fs.mkdirSync(this.dirOf(id), { recursive: true });
    fs.appendFileSync(this.eventsFile(id), JSON.stringify(ev) + "\n");
    this.eventCounts.set(id, index + 1);
    return index;
  }

  readEvents(id: string): JobEvent[] {
    const file = this.eventsFile(id);
    if (!fs.existsSync(file)) return [];
    return fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => JSON.parse(line) as JobEvent);
  }

  running(): Job | undefined {
    return this.list().find((j) => j.status === "running");
  }

  recoverOnStartup(): string[] {
    const recovered: string[] = [];
    for (const job of this.list()) {
      if (job.status !== "running") continue;
      this.update(job.id, { status: "failed", error: "server restarted" });
      this.appendEvent(job.id, { t: Date.now(), kind: "error", message: "server restarted" });
      recovered.push(job.id);
    }
    return recovered;
  }

  private countEvents(id: string): number {
    let n = this.eventCounts.get(id);
    if (n === undefined) {
      n = this.readEvents(id).length;
      this.eventCounts.set(id, n);
    }
    return n;
  }

  private dirOf(id: string): string {
    return path.join(this.jobsDir, id);
  }

  private eventsFile(id: string): string {
    return path.join(this.dirOf(id), "events.ndjson");
  }

  private write(job: Job): void {
    fs.mkdirSync(this.dirOf(job.id), { recursive: true });
    const file = path.join(this.dirOf(job.id), "job.json");
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(job, null, 2));
    fs.renameSync(tmp, file);
  }
}
