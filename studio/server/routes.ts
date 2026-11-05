import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { pipeline } from "node:stream";
import { findOutputs, listLemoStyles, slugify } from "./engines.ts";
import { isLocalRequest, resolveServable, SERVABLE_ROOTS } from "./guard.ts";
import { JobError } from "./jobs.ts";
import type { JobStore } from "./jobs.ts";
import { planPrompt, producePrompt, retryPrompt, revisePrompt } from "./prompts.ts";
import type { Runner } from "./runner.ts";
import type { Hub } from "./sse.ts";
import type { Engine, Job, NewJobInput, Phase } from "./types.ts";

export interface Deps {
  store: JobStore;
  runner: Runner;
  hub: Hub;
  port: number;
  suggest: (idea: string) => Promise<{ engine: Engine; style?: string; reason: string }>;
  clean: (job: Job, discard?: boolean) => Promise<void>;
  webDir: string;
}

const MAX_BODY_BYTES = 64 * 1024;
const PING_MS = 15_000;

const COMMON_HEADERS = { "x-content-type-options": "nosniff" };

const STATIC_FILES: Record<string, { file: string; type: string }> = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/app.js": { file: path.join("dist", "app.js"), type: "text/javascript; charset=utf-8" },
  "/style.css": { file: "style.css", type: "text/css; charset=utf-8" },
};

const TEXT = "text/plain; charset=utf-8";
const FILE_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".md": TEXT,
  ".srt": TEXT,
  ".json": TEXT,
  ".txt": TEXT,
  ".ndjson": TEXT,
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    ...COMMON_HEADERS,
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(text),
    "cache-control": "no-store",
  });
  res.end(text);
}

function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { error: message });
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      // Keep draining (so the client can read our 413) but stop buffering.
      if (size > MAX_BODY_BYTES) tooLarge = true;
      else chunks.push(chunk);
    });
    req.on("error", reject);
    req.on("aborted", () => reject(new JobError(400, "request aborted")));
    req.on("end", () => {
      if (tooLarge) return reject(new JobError(413, `request body is larger than ${MAX_BODY_BYTES / 1024} KB`));
      const text = Buffer.concat(chunks).toString("utf8").trim();
      if (text === "") return resolve({});
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return reject(new JobError(400, "request body is not valid JSON"));
      }
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return reject(new JobError(400, "request body must be a JSON object"));
      }
      resolve(parsed);
    });
  });
}

function stringField(body: Record<string, unknown>, name: string, min: number, max: number): string {
  const v = body[name];
  if (typeof v !== "string") throw new JobError(400, `${name} must be a string`);
  const t = v.trim();
  if (t.length < min || t.length > max) throw new JobError(400, `${name} must be ${min}-${max} characters`);
  return t;
}

function parseNewJob(body: Record<string, unknown>): NewJobInput & { slug: string } {
  const idea = stringField(body, "idea", 10, 2000);
  const engine = body.engine;
  if (engine !== "remotion" && engine !== "lemo") throw new JobError(400, 'engine must be "remotion" or "lemo"');
  const seconds = body.seconds;
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 15 || seconds > 90) {
    throw new JobError(400, "seconds must be a number from 15 to 90");
  }
  let style: string | undefined;
  if (engine === "lemo") {
    const s = body.style;
    if (typeof s !== "string" || !listLemoStyles().some((x) => x.slug === s)) {
      throw new JobError(400, "lemo needs a style from /api/styles");
    }
    style = s;
  }
  const rawSlug = body.slug;
  if (rawSlug !== undefined && rawSlug !== null && typeof rawSlug !== "string") {
    throw new JobError(400, "slug must be a string");
  }
  const slug = typeof rawSlug === "string" && rawSlug !== "" ? rawSlug : slugify(idea);
  return { idea, engine, seconds, slug, ...(style !== undefined ? { style } : {}) };
}

function runningConflict(store: JobStore): JobError | undefined {
  const running = store.running();
  if (!running) return undefined;
  return new JobError(409, `another job is running: "${running.slug}" (${running.id}); wait for it or stop it first`);
}

/** Marks the job running before handing over, so a double click cannot start it twice. */
function beginPhase(deps: Deps, job: Job, phase: Phase, prompt: string, resume?: string): Job {
  deps.store.update(job.id, { phase, status: "running", phaseStartedAt: Date.now(), error: undefined });
  deps.runner.start(job.id, phase, prompt, resume);
  return deps.store.get(job.id)!;
}

function optionalNotes(body: Record<string, unknown>): string | undefined {
  const v = body.notes;
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string" || v.length > 4000) throw new JobError(400, "notes must be a string of at most 4000 characters");
  return v;
}

type RangeResult = { start: number; end: number } | "unsatisfiable" | null;

function parseRange(header: string | undefined, size: number): RangeResult {
  if (header === undefined) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return null; // malformed or multi-range: serve the whole file
  if (m[1] === "") {
    const n = Number(m[2]);
    if (n === 0 || size === 0) return "unsatisfiable";
    return { start: Math.max(0, size - n), end: size - 1 };
  }
  const start = Number(m[1]);
  if (start >= size) return "unsatisfiable";
  const end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (end < start) return null;
  return { start, end };
}

function serveFile(req: IncomingMessage, res: ServerResponse, abs: string): void {
  let st: fs.Stats;
  try {
    st = fs.statSync(abs);
  } catch {
    return sendError(res, 403, "forbidden");
  }
  if (!st.isFile()) return sendError(res, 403, "forbidden");

  const known = FILE_TYPES[path.extname(abs).toLowerCase()];
  const headers: Record<string, string | number> = {
    ...COMMON_HEADERS,
    "content-type": known ?? "application/octet-stream",
    "accept-ranges": "bytes",
    "cache-control": "no-store",
  };
  // Never let the browser render files the agent wrote (e.g. .html) on the Studio origin.
  if (!known) headers["content-disposition"] = "attachment";

  const range = parseRange(req.headers.range, st.size);
  if (range === "unsatisfiable") {
    res.writeHead(416, { ...headers, "content-range": `bytes */${st.size}` });
    return void res.end();
  }
  if (range) {
    res.writeHead(206, {
      ...headers,
      "content-range": `bytes ${range.start}-${range.end}/${st.size}`,
      "content-length": range.end - range.start + 1,
    });
  } else {
    res.writeHead(200, { ...headers, "content-length": st.size });
  }
  if (st.size === 0) return void res.end();
  const stream = fs.createReadStream(abs, range ? { start: range.start, end: range.end } : {});
  pipeline(stream, res, () => {
    // client went away or the file vanished: nothing more to do
  });
}

function serveStatic(res: ServerResponse, webDir: string, entry: { file: string; type: string }): void {
  fs.readFile(path.join(webDir, entry.file), (err, data) => {
    if (err) return sendError(res, 404, "not found");
    res.writeHead(200, {
      ...COMMON_HEADERS,
      "content-type": entry.type,
      "content-length": data.length,
      "cache-control": "no-store",
    });
    res.end(data);
  });
}

function serveEvents(req: IncomingMessage, res: ServerResponse, deps: Deps, job: Job): void {
  res.writeHead(200, {
    ...COMMON_HEADERS,
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  res.flushHeaders();

  const frame = (index: number, ev: unknown): string => `id: ${index}\ndata: ${JSON.stringify(ev)}\n\n`;
  let lastSent = -1;
  const resumeFrom = Number(req.headers["last-event-id"]);
  if (Number.isInteger(resumeFrom) && resumeFrom >= 0) lastSent = resumeFrom;

  // Replay and subscribe in the same tick, so no event can slip between them.
  deps.store.readEvents(job.id).forEach((ev, i) => {
    if (i <= lastSent) return;
    res.write(frame(i, ev));
    lastSent = i;
  });
  const unsubscribe = deps.hub.subscribe(job.id, (index, ev) => {
    if (index <= lastSent) return;
    lastSent = index;
    res.write(frame(index, ev));
  });
  const ping = setInterval(() => res.write(": ping\n\n"), PING_MS);
  res.on("close", () => {
    clearInterval(ping);
    unsubscribe();
  });
}

const JOBS = "/api/jobs";
const JOB_RE = /^\/api\/jobs\/([A-Za-z0-9_-]+)$/;
const JOB_ACTION_RE = /^\/api\/jobs\/([A-Za-z0-9_-]+)\/(events|approve|revise|retry|stop|clean|delete)$/;

async function cleanOrThrow(deps: Deps, job: Job, discard: boolean): Promise<void> {
  try {
    await deps.clean(job, discard);
  } catch (e) {
    const stderr = (e as { stderr?: string }).stderr?.trim();
    throw new JobError(500, `clean failed: ${stderr || (e instanceof Error ? e.message : String(e))}`);
  }
}

async function route(req: IncomingMessage, res: ServerResponse, deps: Deps): Promise<void> {
  const raw = req.url ?? "/";
  const q = raw.indexOf("?");
  const pathname = q < 0 ? raw : raw.slice(0, q);
  const query = new URLSearchParams(q < 0 ? "" : raw.slice(q + 1));
  const method = req.method ?? "GET";
  const { store, runner } = deps;

  if (method === "GET") {
    const entry = Object.hasOwn(STATIC_FILES, pathname) ? STATIC_FILES[pathname] : undefined;
    if (entry) return serveStatic(res, deps.webDir, entry);
    if (pathname === JOBS) return sendJson(res, 200, store.list());
    if (pathname === "/api/styles") return sendJson(res, 200, listLemoStyles());
    if (pathname === "/file") {
      const p = query.get("path");
      const abs = p ? resolveServable(p, SERVABLE_ROOTS) : null;
      if (abs === null) return sendError(res, 403, "forbidden");
      return serveFile(req, res, abs);
    }
  }

  if (method === "POST" && pathname === JOBS) {
    const body = (await readBody(req)) as Record<string, unknown>;
    const input = parseNewJob(body);
    const conflict = runningConflict(store);
    if (conflict) throw conflict;
    const job = store.create(input);
    runner.start(job.id, "plan", planPrompt(job));
    return sendJson(res, 201, store.get(job.id) ?? job);
  }

  if (method === "POST" && pathname === "/api/suggest") {
    const body = (await readBody(req)) as Record<string, unknown>;
    const idea = stringField(body, "idea", 10, 2000);
    let suggestion;
    try {
      suggestion = await deps.suggest(idea);
    } catch (e) {
      return sendError(res, 502, e instanceof Error ? e.message : String(e));
    }
    return sendJson(res, 200, suggestion);
  }

  const one = JOB_RE.exec(pathname);
  if (method === "GET" && one) {
    const job = store.get(one[1]!);
    if (!job) return sendError(res, 404, "no such job");
    return sendJson(res, 200, { job, outputs: findOutputs(job) });
  }

  const act = JOB_ACTION_RE.exec(pathname);
  if (act) {
    const [, id, action] = act as unknown as [string, string, string];
    const job = store.get(id);
    if (action === "events" && method === "GET") {
      if (!job) return sendError(res, 404, "no such job");
      return serveEvents(req, res, deps, job);
    }
    if (method === "POST") {
      if (!job) return sendError(res, 404, "no such job");
      const body = (await readBody(req)) as Record<string, unknown>;

      if (action === "stop") {
        if (!runner.stop(job.id)) throw new JobError(409, "job is not running");
        return sendJson(res, 200, { ok: true });
      }

      if (action === "clean") {
        if (job.status !== "done") throw new JobError(409, `job is ${job.status}; only done jobs can be cleaned`);
        if (job.cleanedAt) throw new JobError(409, "this episode was already cleaned");
        // clean.mjs also empties the shared out/stills, which a running job may be writing to.
        const conflict = runningConflict(store);
        if (conflict) throw conflict;
        if (!findOutputs(job).video) throw new JobError(409, "no final video found; render it before cleaning");
        await cleanOrThrow(deps, job, false);
        return sendJson(res, 200, store.update(job.id, { cleanedAt: Date.now() }));
      }

      if (action === "delete") {
        if (job.status !== "stopped") throw new JobError(409, `job is ${job.status}; only stopped jobs can be deleted`);
        const conflict = runningConflict(store);
        if (conflict) throw conflict;
        await cleanOrThrow(deps, job, true);
        store.remove(job.id);
        return sendJson(res, 200, { ok: true });
      }

      if (action === "approve") {
        const notes = optionalNotes(body);
        if (job.status !== "awaiting_approval") throw new JobError(409, `job is ${job.status}, not awaiting approval`);
        const conflict = runningConflict(store);
        if (conflict) throw conflict;
        return sendJson(res, 200, beginPhase(deps, job, "produce", producePrompt(job, notes), job.sessionId));
      }

      if (action === "revise") {
        const notes = stringField(body, "notes", 1, 4000);
        if (job.status !== "awaiting_approval") throw new JobError(409, `job is ${job.status}, not awaiting approval`);
        const conflict = runningConflict(store);
        if (conflict) throw conflict;
        return sendJson(res, 200, beginPhase(deps, job, "plan", revisePrompt(job, notes), job.sessionId));
      }

      if (action === "retry") {
        if (job.status !== "failed" && job.status !== "stopped") {
          throw new JobError(409, `job is ${job.status}; only failed or stopped jobs can be retried`);
        }
        const conflict = runningConflict(store);
        if (conflict) throw conflict;
        const next = job.sessionId
          ? beginPhase(deps, job, job.phase, retryPrompt(job), job.sessionId)
          : beginPhase(deps, job, "plan", planPrompt(job));
        return sendJson(res, 200, next);
      }
    }
  }

  sendError(res, 404, "not found");
}

export function createHandler(deps: Deps): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    // The guard comes first for everything: API, static files, SSE and /file.
    if (!isLocalRequest({ host: req.headers.host, origin: req.headers.origin }, deps.port)) {
      return sendError(res, 403, "forbidden");
    }
    route(req, res, deps).catch((err: unknown) => {
      if (res.headersSent) return void res.destroy();
      if (err instanceof JobError) return sendError(res, err.status, err.message);
      console.error("studio: unhandled error", err);
      sendError(res, 500, "internal error");
    });
  };
}
