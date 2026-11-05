import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import type { Job, JobEvent, Phase } from "../server/types.ts";

// Paths read STUDIO_DATA / LEMO_LIB at import time, so set them first.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "studio-routes-"));
const dataDir = path.join(tmp, "data");
const webDir = path.join(tmp, "web");
const libDir = path.join(tmp, "lib");
fs.mkdirSync(path.join(webDir, "dist"), { recursive: true });
fs.writeFileSync(path.join(webDir, "index.html"), "<!doctype html><title>studio</title>");
fs.writeFileSync(path.join(webDir, "dist", "app.js"), "console.log('app');");
fs.writeFileSync(path.join(webDir, "style.css"), "body{}");
fs.mkdirSync(path.join(libDir, "styles", "blueprint"), { recursive: true });
fs.writeFileSync(
  path.join(libDir, "styles", "blueprint", "style.json"),
  JSON.stringify({ slug: "blueprint", en: "Blueprint", category_en: "Tech", line: "lines", uses: ["x"] }),
);
process.env.STUDIO_DATA = dataDir;
process.env.LEMO_LIB = libDir;

const { JobStore } = await import("../server/jobs.ts");
const { Hub } = await import("../server/sse.ts");
const { createHandler } = await import("../server/routes.ts");

type Start = [string, Phase, string, string | undefined];
const fakeRunner = {
  starts: [] as Start[],
  running: new Set<string>(),
  stops: [] as string[],
  start(jobId: string, phase: Phase, prompt: string, resume?: string): void {
    this.starts.push([jobId, phase, prompt, resume]);
  },
  stop(jobId: string): boolean {
    this.stops.push(jobId);
    return this.running.has(jobId);
  },
  isRunning(jobId: string): boolean {
    return this.running.has(jobId);
  },
};

const store = new JobStore(dataDir, () => false);
const hub = new Hub();
let suggestImpl: (idea: string) => Promise<{ engine: "remotion" | "lemo"; style?: string; reason: string }> =
  async () => ({ engine: "lemo", style: "blueprint", reason: "fits" });

const cleaned: string[] = [];

let handler: (req: http.IncomingMessage, res: http.ServerResponse) => void = () => {};
const server = http.createServer((req, res) => handler(req, res));
let port = 0;

interface Reply {
  status: number;
  headers: http.IncomingHttpHeaders;
  text: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: any;
}

function call(
  method: string,
  p: string,
  body?: unknown,
  headers: Record<string, string> = {},
  rawBody?: string,
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const payload = rawBody ?? (body === undefined ? undefined : JSON.stringify(body));
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method,
        path: p,
        headers: {
          host: `127.0.0.1:${port}`,
          ...(payload !== undefined ? { "content-type": "application/json", "content-length": String(Buffer.byteLength(payload)) } : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json: unknown;
          try {
            json = JSON.parse(text);
          } catch {
            json = undefined;
          }
          resolve({ status: res.statusCode ?? 0, headers: res.headers, text, json });
        });
      },
    );
    req.on("error", reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

const goodBody = { idea: "a bus that never arrives at the stop", engine: "remotion", seconds: 60 };
let firstId = "";

before(async () => {
  // The handler needs the real port (Host check), which is only known after listen(0).
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;
  handler = createHandler({
    store,
    runner: fakeRunner,
    hub,
    port,
    suggest: (idea) => suggestImpl(idea),
    clean: async (job, discard) => void cleaned.push(`${job.slug}${discard ? ":discard" : ""}`),
    webDir,
  });
});

after(() => {
  server.closeAllConnections();
  server.close();
});

test("foreign origin is refused before anything runs", async () => {
  const r = await call("POST", "/api/jobs", goodBody, { origin: "https://evil.example" });
  assert.equal(r.status, 403);
  assert.deepEqual(r.json, { error: "forbidden" });
  assert.equal(fakeRunner.starts.length, 0);
  assert.equal(store.list().length, 0);
});

test("a rebinding Host is refused on every kind of route", async () => {
  const evil = { host: `evil.example:${port}` };
  for (const p of ["/", "/app.js", "/api/jobs", "/api/styles", "/file?path=out", "/api/jobs/x/events"]) {
    const r = await call("GET", p, undefined, evil);
    assert.equal(r.status, 403, p);
  }
  assert.equal((await call("POST", "/api/jobs", goodBody, evil)).status, 403);
  assert.equal(fakeRunner.starts.length, 0);
});

test("a foreign origin is also refused on static and SSE routes", async () => {
  const evil = { origin: "https://evil.example" };
  assert.equal((await call("GET", "/", undefined, evil)).status, 403);
  assert.equal((await call("GET", "/api/jobs/anything/events", undefined, evil)).status, 403);
  assert.equal((await call("GET", "/file?path=out", undefined, evil)).status, 403);
});

test("create starts the plan phase", async () => {
  const r = await call("POST", "/api/jobs", goodBody);
  assert.equal(r.status, 201);
  assert.deepEqual(fakeRunner.starts[0]!.slice(1, 2), ["plan"]);
  assert.equal(fakeRunner.starts[0]![0], r.json.id);
  assert.equal(r.json.slug, "a-bus-that-never-arrives");
  assert.equal(r.json.status, "running");
  firstId = r.json.id;
});

test("second job while one runs is refused and names the running job", async () => {
  store.update(firstId, { status: "running" });
  const before = fakeRunner.starts.length;
  const r = await call("POST", "/api/jobs", { ...goodBody, idea: "another idea entirely here" });
  assert.equal(r.status, 409);
  assert.match(r.json.error, /running/);
  assert.ok(r.json.error.includes("a-bus-that-never-arrives"));
  assert.equal(fakeRunner.starts.length, before);
});

test("the job list and one job (with outputs) are readable", async () => {
  const list = await call("GET", "/api/jobs");
  assert.equal(list.status, 200);
  assert.equal(list.json.length, 1);
  const one = await call("GET", `/api/jobs/${firstId}`);
  assert.equal(one.status, 200);
  assert.equal(one.json.job.id, firstId);
  assert.ok(Array.isArray(one.json.outputs.stills));
});

test("unknown job is 404 on every job route", async () => {
  assert.equal((await call("GET", "/api/jobs/nope-1")).status, 404);
  assert.equal((await call("GET", "/api/jobs/nope-1/events")).status, 404);
  for (const action of ["approve", "revise", "retry", "stop"]) {
    const r = await call("POST", `/api/jobs/nope-1/${action}`, { notes: "x" });
    assert.equal(r.status, 404, action);
    assert.equal(typeof r.json.error, "string");
  }
});

test("approve resumes the session; wrong status is 409", async () => {
  store.update(firstId, { status: "awaiting_approval", sessionId: "s1" });
  assert.equal((await call("POST", `/api/jobs/${firstId}/approve`, {})).status, 200);
  const [, phase, prompt, resume] = fakeRunner.starts.at(-1)!;
  assert.equal(phase, "produce");
  assert.equal(resume, "s1");
  assert.match(prompt, /PRODUCE/);
  assert.equal((await call("POST", `/api/jobs/${firstId}/approve`, {})).status, 409);
});

test("approve passes the user's notes into the prompt", async () => {
  store.update(firstId, { status: "awaiting_approval", sessionId: "s1" });
  const r = await call("POST", `/api/jobs/${firstId}/approve`, { notes: "make it shorter" });
  assert.equal(r.status, 200);
  assert.match(fakeRunner.starts.at(-1)![2], /User notes:\nmake it shorter/);
});

test("approve is refused (409) while another job is running", async () => {
  const other = store.create({ idea: "second story idea here", engine: "remotion", seconds: 30, slug: "second-story" });
  store.update(firstId, { status: "awaiting_approval", sessionId: "s1" });
  store.update(other.id, { status: "running" });
  const before = fakeRunner.starts.length;
  const r = await call("POST", `/api/jobs/${firstId}/approve`, {});
  assert.equal(r.status, 409);
  assert.match(r.json.error, /running/);
  assert.ok(r.json.error.includes("second-story"));
  assert.equal(fakeRunner.starts.length, before);
  store.update(other.id, { status: "done" });
});

test("revise needs notes and re-plans in the same session", async () => {
  store.update(firstId, { status: "awaiting_approval", sessionId: "s1", phase: "plan" });
  assert.equal((await call("POST", `/api/jobs/${firstId}/revise`, {})).status, 400);
  assert.equal((await call("POST", `/api/jobs/${firstId}/revise`, { notes: "x".repeat(4001) })).status, 400);
  const r = await call("POST", `/api/jobs/${firstId}/revise`, { notes: "make the ending darker" });
  assert.equal(r.status, 200);
  const [, phase, prompt, resume] = fakeRunner.starts.at(-1)!;
  assert.equal(phase, "plan");
  assert.equal(resume, "s1");
  assert.match(prompt, /make the ending darker/);
  assert.equal((await call("POST", `/api/jobs/${firstId}/revise`, { notes: "again" })).status, 409);
});

test("retry after a restart resumes the same phase", async () => {
  store.update(firstId, { status: "failed", sessionId: "s1", phase: "produce", error: "server restarted" });
  const r = await call("POST", `/api/jobs/${firstId}/retry`, {});
  assert.equal(r.status, 200);
  const [id, phase, prompt, resume] = fakeRunner.starts.at(-1)!;
  assert.equal(id, firstId);
  assert.equal(phase, "produce");
  assert.equal(resume, "s1");
  assert.match(prompt, /interrupted/);
  assert.equal((await call("POST", `/api/jobs/${firstId}/retry`, {})).status, 409);
  store.update(firstId, { status: "done" });
});

test("retry without a session starts the plan again from scratch", async () => {
  const j = store.create({ idea: "a ghost who pays rent", engine: "remotion", seconds: 40, slug: "ghost-rent" });
  store.update(j.id, { status: "stopped" });
  const r = await call("POST", `/api/jobs/${j.id}/retry`, {});
  assert.equal(r.status, 200);
  const [, phase, prompt, resume] = fakeRunner.starts.at(-1)!;
  assert.equal(phase, "plan");
  assert.equal(resume, undefined);
  assert.match(prompt, /PLAN phase/);
  store.update(j.id, { status: "done" });
});

test("stop: 200 while running, 409 when not running", async () => {
  store.update(firstId, { status: "running" });
  fakeRunner.running.add(firstId);
  assert.equal((await call("POST", `/api/jobs/${firstId}/stop`)).status, 200);
  fakeRunner.running.delete(firstId);
  const r = await call("POST", `/api/jobs/${firstId}/stop`);
  assert.equal(r.status, 409);
  assert.equal(typeof r.json.error, "string");
  store.update(firstId, { status: "stopped" });
});

test("lemo job needs a known style; seconds bounded", async () => {
  assert.equal((await call("POST", "/api/jobs", { ...goodBody, engine: "lemo", style: "nope" })).status, 400);
  assert.equal((await call("POST", "/api/jobs", { ...goodBody, engine: "lemo" })).status, 400);
  assert.equal((await call("POST", "/api/jobs", { ...goodBody, seconds: 600 })).status, 400);
  assert.equal((await call("POST", "/api/jobs", { ...goodBody, seconds: 5 })).status, 400);
  const ok = await call("POST", "/api/jobs", { ...goodBody, idea: "lemo story about a lighthouse", engine: "lemo", style: "blueprint", seconds: 35 });
  assert.equal(ok.status, 201);
  assert.equal(ok.json.engine, "lemo");
  assert.equal(ok.json.style, "blueprint");
  store.update(ok.json.id, { status: "done" });
});

test("bad create bodies are 400 with an error message", async () => {
  const bad: unknown[] = [
    { ...goodBody, idea: "short" },
    { ...goodBody, idea: "y".repeat(2001) },
    { ...goodBody, idea: 12 },
    { ...goodBody, engine: "unity" },
    { ...goodBody, seconds: "60" },
    { ...goodBody, slug: "Bad Slug!" },
    { ...goodBody, slug: 42 },
    [],
    "text",
  ];
  for (const b of bad) {
    const r = await call("POST", "/api/jobs", b);
    assert.equal(r.status, 400, JSON.stringify(b)?.slice(0, 40));
    assert.equal(typeof r.json.error, "string");
  }
  const r = await call("POST", "/api/jobs", undefined, {}, "{not json");
  assert.equal(r.status, 400);
});

test("a taken slug is 409", async () => {
  const r = await call("POST", "/api/jobs", { ...goodBody, slug: "second-story" });
  assert.equal(r.status, 409);
  assert.match(r.json.error, /second-story/);
});

test("an oversized body is 413", async () => {
  const r = await call("POST", "/api/jobs", undefined, {}, JSON.stringify({ ...goodBody, idea: "z".repeat(70 * 1024) }));
  assert.equal(r.status, 413);
  assert.equal(typeof r.json.error, "string");
});

test("styles come from the library", async () => {
  const r = await call("GET", "/api/styles");
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, [{ slug: "blueprint", name: "Blueprint", category: "Tech", line: "lines", uses: ["x"] }]);
});

test("suggest: 200, 400 on bad body, 502 when it throws", async () => {
  const ok = await call("POST", "/api/suggest", { idea: "a lighthouse keeper's secret" });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.json, { engine: "lemo", style: "blueprint", reason: "fits" });
  assert.equal((await call("POST", "/api/suggest", {})).status, 400);
  assert.equal((await call("POST", "/api/suggest", { idea: "tiny" })).status, 400);
  suggestImpl = async () => {
    throw new Error("model unavailable");
  };
  const bad = await call("POST", "/api/suggest", { idea: "a lighthouse keeper's secret" });
  assert.equal(bad.status, 502);
  assert.deepEqual(bad.json, { error: "model unavailable" });
});

test("static: / serves index.html, /app.js serves dist/app.js, /style.css, unknown is 404", async () => {
  const index = await call("GET", "/");
  assert.equal(index.status, 200);
  assert.match(index.headers["content-type"]!, /^text\/html/);
  assert.match(index.text, /<title>studio<\/title>/);
  const js = await call("GET", "/app.js");
  assert.equal(js.status, 200);
  assert.match(js.headers["content-type"]!, /javascript/);
  assert.equal(js.text, "console.log('app');");
  const css = await call("GET", "/style.css");
  assert.equal(css.status, 200);
  assert.match(css.headers["content-type"]!, /^text\/css/);
  assert.equal((await call("GET", "/nope")).status, 404);
  assert.equal((await call("GET", "/../package.json")).status, 404);
});

test("static: a missing built bundle is 404, not a crash", async () => {
  fs.renameSync(path.join(webDir, "dist", "app.js"), path.join(webDir, "dist", "app.js.bak"));
  try {
    assert.equal((await call("GET", "/app.js")).status, 404);
  } finally {
    fs.renameSync(path.join(webDir, "dist", "app.js.bak"), path.join(webDir, "dist", "app.js"));
  }
});

test("file route refuses traversal, absolute paths outside the roots, and a missing path", async () => {
  assert.equal((await call("GET", "/file?path=../../etc/hosts")).status, 403);
  assert.equal((await call("GET", "/file?path=%2Fetc%2Fhosts")).status, 403);
  assert.equal((await call("GET", "/file?path=..%2F..%2F.ssh%2Fid_rsa")).status, 403);
  assert.equal((await call("GET", "/file")).status, 403);
  assert.equal((await call("GET", "/file?path=package.json")).status, 403);
});

test("file route refuses a symlink that points out of the roots", async () => {
  fs.mkdirSync(path.join(dataDir, "links"), { recursive: true });
  const secret = path.join(tmp, "secret.txt");
  fs.writeFileSync(secret, "top secret");
  const link = path.join(dataDir, "links", "leak.md");
  fs.symlinkSync(secret, link);
  assert.equal((await call("GET", `/file?path=${encodeURIComponent(link)}`)).status, 403);
});

test("file route serves allowed files with the right type; directories are refused", async () => {
  const dir = path.join(dataDir, "files");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "PLAN.md"), "# plan");
  fs.writeFileSync(path.join(dir, "x.png"), Buffer.from([0x89, 0x50]));
  fs.writeFileSync(path.join(dir, "page.html"), "<script>alert(1)</script>");
  const md = await call("GET", `/file?path=${encodeURIComponent(path.join(dir, "PLAN.md"))}`);
  assert.equal(md.status, 200);
  assert.equal(md.headers["content-type"], "text/plain; charset=utf-8");
  assert.equal(md.text, "# plan");
  assert.equal(md.headers["x-content-type-options"], "nosniff");
  const png = await call("GET", `/file?path=${encodeURIComponent(path.join(dir, "x.png"))}`);
  assert.equal(png.headers["content-type"], "image/png");
  const html = await call("GET", `/file?path=${encodeURIComponent(path.join(dir, "page.html"))}`);
  assert.equal(html.status, 200);
  assert.doesNotMatch(html.headers["content-type"]!, /html/);
  assert.equal((await call("GET", `/file?path=${encodeURIComponent(dir)}`)).status, 403);
});

test("mp4 Range request returns 206 with the slice", async () => {
  const dir = path.join(dataDir, "films", "range-film");
  fs.mkdirSync(dir, { recursive: true });
  const bytes = Buffer.from("0123456789abcdefghij");
  fs.writeFileSync(path.join(dir, "range-film.mp4"), bytes);
  const url = `/file?path=${encodeURIComponent(path.join(dir, "range-film.mp4"))}`;

  const full = await call("GET", url);
  assert.equal(full.status, 200);
  assert.equal(full.headers["content-type"], "video/mp4");
  assert.equal(full.headers["accept-ranges"], "bytes");
  assert.equal(full.headers["content-length"], "20");

  const part = await call("GET", url, undefined, { range: "bytes=5-9" });
  assert.equal(part.status, 206);
  assert.equal(part.text, "56789");
  assert.equal(part.headers["content-range"], "bytes 5-9/20");
  assert.equal(part.headers["content-length"], "5");

  const open = await call("GET", url, undefined, { range: "bytes=15-" });
  assert.equal(open.status, 206);
  assert.equal(open.text, "fghij");

  const suffix = await call("GET", url, undefined, { range: "bytes=-3" });
  assert.equal(suffix.status, 206);
  assert.equal(suffix.text, "hij");

  const bad = await call("GET", url, undefined, { range: "bytes=50-60" });
  assert.equal(bad.status, 416);
  assert.equal(bad.headers["content-range"], "bytes */20");
});

function openSse(p: string, headers: Record<string, string> = {}): Promise<{
  res: http.IncomingMessage;
  req: http.ClientRequest;
  next: () => Promise<string>;
}> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, path: p, method: "GET", headers: { host: `127.0.0.1:${port}`, ...headers } },
      (res) => {
        let buf = "";
        const queue: string[] = [];
        let waiter: ((s: string) => void) | undefined;
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => {
          buf += chunk;
          let i: number;
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const block = buf.slice(0, i);
            buf = buf.slice(i + 2);
            if (block.startsWith(":")) continue; // comment / ping
            if (waiter) {
              const w = waiter;
              waiter = undefined;
              w(block);
            } else queue.push(block);
          }
        });
        const next = () =>
          new Promise<string>((res2, rej2) => {
            const q = queue.shift();
            if (q !== undefined) return res2(q);
            const timer = setTimeout(() => rej2(new Error("timed out waiting for an SSE event")), 3000);
            waiter = (s) => {
              clearTimeout(timer);
              res2(s);
            };
          });
        resolve({ res, req, next });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

test("events replay then stream", async () => {
  const j = store.create({ idea: "an event stream story", engine: "remotion", seconds: 30, slug: "event-story" });
  const e0: JobEvent = { t: 1, kind: "text", text: "one" };
  const e1: JobEvent = { t: 2, kind: "text", text: "two" };
  store.appendEvent(j.id, e0);
  store.appendEvent(j.id, e1);

  const sse = await openSse(`/api/jobs/${j.id}/events`);
  try {
    assert.equal(sse.res.statusCode, 200);
    assert.match(sse.res.headers["content-type"]!, /^text\/event-stream/);
    assert.equal(sse.res.headers["cache-control"], "no-cache");
    assert.equal(await sse.next(), `id: 0\ndata: ${JSON.stringify(e0)}`);
    assert.equal(await sse.next(), `id: 1\ndata: ${JSON.stringify(e1)}`);

    const e2: JobEvent = { t: 3, kind: "text", text: "three" };
    const index = store.appendEvent(j.id, e2);
    hub.publish(j.id, index, e2);
    assert.equal(await sse.next(), `id: 2\ndata: ${JSON.stringify(e2)}`);

    // events of other jobs do not leak into this stream
    hub.publish("other-job", 0, { t: 4, kind: "text", text: "nope" });
    const e3: JobEvent = { t: 5, kind: "text", text: "four" };
    hub.publish(j.id, store.appendEvent(j.id, e3), e3);
    assert.equal(await sse.next(), `id: 3\ndata: ${JSON.stringify(e3)}`);
  } finally {
    sse.req.destroy();
  }
});

test("events: Last-Event-ID resumes after the given index; closing unsubscribes", async () => {
  const j = store.list().find((x) => x.slug === "event-story")!;
  const sse = await openSse(`/api/jobs/${j.id}/events`, { "last-event-id": "2" });
  try {
    assert.match(await sse.next(), /^id: 3\n/);
  } finally {
    sse.req.destroy();
  }
  // give the server a moment to notice the close, then publishing must not throw
  await new Promise((r) => setTimeout(r, 50));
  hub.publish(j.id, 4, { t: 6, kind: "text", text: "after close" });
});

test("Hub: subscribe, publish, unsubscribe", () => {
  const h = new Hub();
  const got: number[] = [];
  const off = h.subscribe("a", (i) => got.push(i));
  const ev: JobEvent = { t: 0, kind: "text", text: "x" };
  h.publish("a", 0, ev);
  h.publish("b", 1, ev);
  off();
  h.publish("a", 2, ev);
  assert.deepEqual(got, [0]);
  // publish is safe to hand around unbound, and one failing listener does not stop the others
  const { publish } = h;
  const seen: number[] = [];
  h.subscribe("c", () => {
    throw new Error("boom");
  });
  h.subscribe("c", (i) => seen.push(i));
  publish("c", 7, ev);
  assert.deepEqual(seen, [7]);
});

test("a Job from the store keeps its shape through the API", async () => {
  const r = await call("GET", `/api/jobs/${firstId}`);
  const job: Job = r.json.job;
  assert.equal(job.slug, "a-bus-that-never-arrives");
  assert.equal(job.engine, "remotion");
});

test("clean: only done jobs with a video, never while another job runs, once", async () => {
  for (const r of store.list()) if (r.status === "running") store.update(r.id, { status: "done" });
  const j = store.create({ idea: "a film to clean up", engine: "lemo", style: "blueprint", seconds: 30, slug: "clean-film" });
  assert.equal((await call("POST", `/api/jobs/${j.id}/clean`)).status, 409); // running
  store.update(j.id, { status: "done" });
  assert.match((await call("POST", `/api/jobs/${j.id}/clean`)).json.error, /no final video/);
  const dir = path.join(dataDir, "films", "clean-film");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "clean-film.mp4"), "x");
  const other = store.create({ idea: "busy job meanwhile", engine: "remotion", seconds: 30, slug: "busy-job" });
  assert.equal((await call("POST", `/api/jobs/${j.id}/clean`)).status, 409); // other job running
  store.update(other.id, { status: "done" });
  const ok = await call("POST", `/api/jobs/${j.id}/clean`);
  assert.equal(ok.status, 200);
  assert.equal(typeof ok.json.cleanedAt, "number");
  assert.deepEqual(cleaned, ["clean-film"]);
  assert.equal((await call("POST", `/api/jobs/${j.id}/clean`)).status, 409);
});

test("delete: only stopped jobs; discards their files and removes the job", async () => {
  for (const r of store.list()) if (r.status === "running") store.update(r.id, { status: "done" });
  const j = store.create({ idea: "an abandoned idea here", engine: "remotion", seconds: 30, slug: "abandoned" });
  assert.equal((await call("POST", `/api/jobs/${j.id}/delete`)).status, 409); // running
  store.update(j.id, { status: "stopped" });
  assert.equal((await call("POST", `/api/jobs/${j.id}/delete`)).status, 200);
  assert.equal(cleaned.at(-1), "abandoned:discard");
  assert.equal((await call("GET", `/api/jobs/${j.id}`)).status, 404);
  assert.ok(!fs.existsSync(path.join(dataDir, "jobs", j.id)));
});
