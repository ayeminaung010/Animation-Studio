import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { JobStore } from "../server/jobs.ts";
import { LEMO_LIB, REPO } from "../server/paths.ts";
import {
  ALLOWED_TOOLS,
  DENIED_TOOLS,
  agentOptions,
  createRunner,
  type QueryFn,
  type Runner,
} from "../server/runner.ts";
import type { Job, JobEvent } from "../server/types.ts";
import { assistantWithToolAndText, init, resultMaxTurns, resultSuccess } from "./fixtures/sdk-messages.ts";

type Call = { prompt: unknown; options: Options };

function fixture(slug = "rain-cat", engine: "remotion" | "lemo" = "remotion") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-runner-"));
  const store = new JobStore(dir, () => false);
  const job = store.create({ idea: "a cat waits out the rain", engine, seconds: 30, slug });
  const published: Array<{ id: string; index: number; ev: JobEvent }> = [];
  const pub = (id: string, index: number, ev: JobEvent) => published.push({ id, index, ev });
  return { store, job, published, pub };
}

function fakeQuery(messages: SDKMessage[]) {
  const calls: Call[] = [];
  const fn = ((params: Call) => {
    calls.push(params);
    return (async function* () {
      for (const m of messages) yield m;
    })();
  }) as unknown as QueryFn;
  return { fn, calls, last: () => calls[calls.length - 1] };
}

function throwingQuery(messages: SDKMessage[], error: Error) {
  return ((_params: Call) =>
    (async function* () {
      for (const m of messages) yield m;
      throw error;
    })()) as unknown as QueryFn;
}

/** yields init, then waits for the abort signal; `mode` is what the SDK does on abort. */
function hangingQuery(mode: "throw" | "return") {
  return ((params: Call) =>
    (async function* () {
      yield init;
      const signal = params.options.abortController!.signal;
      await new Promise<void>((resolve) => {
        if (signal.aborted) resolve();
        else signal.addEventListener("abort", () => resolve());
      });
      if (mode === "throw") {
        const e = new Error("Claude Code process aborted by user");
        e.name = "AbortError";
        throw e;
      }
    })()) as unknown as QueryFn;
}

async function settled(r: Runner, id: string): Promise<void> {
  while (r.isRunning(id)) await new Promise((resolve) => setTimeout(resolve, 10));
}

const deniedCtx = { signal: new AbortController().signal, toolUseID: "t", requestId: "r" } as any;

test("plan success waits for approval and keeps the session", async () => {
  const { store, job, pub } = fixture();
  const r = createRunner(store, pub, fakeQuery([init, assistantWithToolAndText, resultSuccess]).fn);
  r.start(job.id, "plan", "go");
  assert.equal(r.isRunning(job.id), true);
  await settled(r, job.id);
  const j = store.get(job.id)!;
  assert.equal(j.status, "awaiting_approval");
  assert.equal(j.phase, "plan");
  assert.equal(j.sessionId, "sess-1");
  assert.equal(j.costUsd, 0.42);
  assert.equal(j.error, undefined);
  assert.deepEqual(
    store.readEvents(job.id).map((e) => e.kind),
    ["status", "text", "tool", "result", "status"],
  );
});

test("published events match what is stored, with matching indexes", async () => {
  const { store, job, pub, published } = fixture();
  const r = createRunner(store, pub, fakeQuery([init, assistantWithToolAndText, resultSuccess]).fn);
  r.start(job.id, "plan", "go");
  await settled(r, job.id);
  assert.deepEqual(
    published.map((p) => p.index),
    [0, 1, 2, 3, 4],
  );
  assert.deepEqual(
    published.map((p) => p.ev),
    store.readEvents(job.id),
  );
  const last = published[published.length - 1].ev;
  assert.deepEqual({ kind: last.kind, status: (last as any).status }, { kind: "status", status: "awaiting_approval" });
});

test("start returns at once and marks the job running", () => {
  const { store, job, pub } = fixture();
  store.update(job.id, { status: "awaiting_approval" });
  const r = createRunner(store, pub, hangingQuery("return"));
  r.start(job.id, "produce", "go", "sess-1");
  const j = store.get(job.id)!;
  assert.equal(j.status, "running");
  assert.equal(j.phase, "produce");
  assert.equal(r.stop(job.id), true);
});

test("produce resumes the session and finishes done", async () => {
  const { store, job, pub } = fixture();
  const q = fakeQuery([init, resultSuccess]);
  const r = createRunner(store, pub, q.fn);
  r.start(job.id, "produce", "go", "sess-1");
  await settled(r, job.id);
  assert.equal(q.last().options.resume, "sess-1");
  assert.equal(q.last().prompt, "go");
  assert.equal(store.get(job.id)!.status, "done");
});

test("a plan run does not pass resume", async () => {
  const { store, job, pub } = fixture();
  const q = fakeQuery([init, resultSuccess]);
  const r = createRunner(store, pub, q.fn);
  r.start(job.id, "plan", "go");
  await settled(r, job.id);
  assert.equal("resume" in q.last().options, false);
});

test("cost: a fresh session adds, a resumed session (cumulative total) does not double count", async () => {
  const { store, job, pub } = fixture();
  const r = createRunner(store, pub, fakeQuery([init, resultSuccess]).fn);
  r.start(job.id, "plan", "go");
  await settled(r, job.id);
  assert.equal(store.get(job.id)!.costUsd, 0.42);
  // the resumed query reports the running total of the whole session (0.42 again here)
  r.start(job.id, "produce", "go", "sess-1");
  await settled(r, job.id);
  assert.equal(store.get(job.id)!.costUsd, 0.42);
  // a brand-new session (no resume) starts from zero, so its cost is added
  r.start(job.id, "plan", "again");
  await settled(r, job.id);
  assert.equal(store.get(job.id)!.costUsd, 0.84);
});

test("an agent error result fails the job with its message, with a single result event", async () => {
  const { store, job, pub } = fixture();
  const r = createRunner(store, pub, fakeQuery([init, resultMaxTurns]).fn);
  r.start(job.id, "plan", "go");
  await settled(r, job.id);
  const j = store.get(job.id)!;
  assert.equal(j.status, "failed");
  assert.match(j.error!, /turns/);
  assert.equal(j.costUsd, 3.1);
  const events = store.readEvents(job.id);
  assert.deepEqual(
    events.map((e) => e.kind),
    ["status", "result", "status"],
  );
  assert.equal((events[1] as any).ok, false);
});

test("a success result flagged is_error fails the job", async () => {
  const { store, job, pub } = fixture();
  const flagged = { ...(resultSuccess as any), is_error: true, result: "API Error: overloaded" } as SDKMessage;
  const r = createRunner(store, pub, fakeQuery([init, flagged]).fn);
  r.start(job.id, "plan", "go");
  await settled(r, job.id);
  const j = store.get(job.id)!;
  assert.equal(j.status, "failed");
  assert.equal(j.error, "API Error: overloaded");
});

test("a stream that ends without a result fails the job", async () => {
  const { store, job, pub } = fixture();
  const r = createRunner(store, pub, fakeQuery([init]).fn);
  r.start(job.id, "plan", "go");
  await settled(r, job.id);
  const j = store.get(job.id)!;
  assert.equal(j.status, "failed");
  assert.match(j.error!, /without a result/);
});

test("a thrown error fails the job, emits an error event, and still publishes the final status", async () => {
  const { store, job, pub, published } = fixture();
  const r = createRunner(store, pub, throwingQuery([init], new Error("spawn claude ENOENT")));
  r.start(job.id, "plan", "go");
  await settled(r, job.id);
  const j = store.get(job.id)!;
  assert.equal(j.status, "failed");
  assert.equal(j.error, "spawn claude ENOENT");
  const events = store.readEvents(job.id);
  assert.deepEqual(
    events.map((e) => e.kind),
    ["status", "error", "status"],
  );
  assert.equal((events[1] as any).message, "spawn claude ENOENT");
  assert.deepEqual(published[published.length - 1].ev, events[2]);
  assert.equal((events[2] as any).status, "failed");
});

test("retrying after a failure clears the old error", async () => {
  const { store, job, pub } = fixture();
  createRunner(store, pub, throwingQuery([init], new Error("boom"))).start(job.id, "plan", "go");
  const r = createRunner(store, pub, fakeQuery([init, resultSuccess]).fn);
  // wait for the first (throwing) runner via the store state
  while (store.get(job.id)!.status === "running") await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(store.get(job.id)!.error, "boom");
  r.start(job.id, "plan", "retry", "sess-1");
  await settled(r, job.id);
  assert.equal(store.get(job.id)!.status, "awaiting_approval");
  assert.equal(store.get(job.id)!.error, undefined);
});

test("stop aborts and marks stopped (generator returns)", async () => {
  const { store, job, pub } = fixture();
  const r = createRunner(store, pub, hangingQuery("return"));
  r.start(job.id, "plan", "go");
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(r.isRunning(job.id), true);
  assert.equal(r.stop(job.id), true);
  await settled(r, job.id);
  assert.equal(store.get(job.id)!.status, "stopped");
  assert.equal(store.get(job.id)!.error, undefined);
  const events = store.readEvents(job.id);
  assert.deepEqual(
    events.map((e) => e.kind),
    ["status", "status"],
  );
  assert.equal((events[1] as any).status, "stopped");
});

test("stop ends stopped even when the SDK throws an AbortError", async () => {
  const { store, job, pub } = fixture();
  const r = createRunner(store, pub, hangingQuery("throw"));
  r.start(job.id, "plan", "go");
  await new Promise((resolve) => setTimeout(resolve, 20));
  r.stop(job.id);
  await settled(r, job.id);
  assert.equal(store.get(job.id)!.status, "stopped");
  assert.equal(store.get(job.id)!.error, undefined);
  assert.deepEqual(
    store.readEvents(job.id).map((e) => e.kind),
    ["status", "status"],
  );
});

test("stop on an idle job returns false", () => {
  const { store, pub } = fixture();
  const r = createRunner(store, pub, fakeQuery([]).fn);
  assert.equal(r.stop("nope"), false);
  assert.equal(r.isRunning("nope"), false);
});

test("start refuses an unknown job and a job that is already running", () => {
  const { store, job, pub } = fixture();
  const r = createRunner(store, pub, hangingQuery("return"));
  assert.throws(() => r.start("missing", "plan", "go"), /no such job/);
  r.start(job.id, "plan", "go");
  assert.throws(() => r.start(job.id, "plan", "go"), /already running/);
  r.stop(job.id);
});

test("unapproved tools are denied, not left waiting", async () => {
  const { job } = fixture();
  const res = await agentOptions(job, new AbortController()).canUseTool!("NotebookEdit", {}, deniedCtx);
  assert.equal(res!.behavior, "deny");
  assert.match((res as { message: string }).message, /NotebookEdit is not available in Studio/);
});

test("agent options: cwd, settings, permissions and limits", () => {
  const { job } = fixture();
  const abort = new AbortController();
  const o = agentOptions(job, abort);
  assert.equal(o.cwd, REPO);
  assert.deepEqual(o.settingSources, ["user", "project", "local"]);
  assert.equal(o.permissionMode, "acceptEdits");
  assert.equal(o.maxTurns, 300);
  assert.equal(o.abortController, abort);
  assert.deepEqual(o.allowedTools, ALLOWED_TOOLS);
  assert.deepEqual(o.disallowedTools, DENIED_TOOLS);
  const sp = o.systemPrompt as { type: string; preset: string; append: string };
  assert.deepEqual({ type: sp.type, preset: sp.preset }, { type: "preset", preset: "claude_code" });
  assert.ok(sp.append.length > 0);
  assert.deepEqual(o.additionalDirectories, []);
  assert.equal(o.env!.LIB, process.env.LIB);
  assert.equal(o.env!.PATH, process.env.PATH);
});

test("the tool lists keep the safety rules", () => {
  assert.ok(DENIED_TOOLS.includes("AskUserQuestion"));
  for (const c of ["git push", "git commit", "git reset", "git rebase", "git checkout", "sudo", "npm run clean"]) {
    assert.ok(DENIED_TOOLS.includes(`Bash(${c} *)`), c);
  }
  assert.ok(!ALLOWED_TOOLS.includes("AskUserQuestion"));
});

test("lemo jobs get the library directory and LIB", () => {
  const { job: lemoJob } = fixture("rain-film", "lemo");
  const o = agentOptions(lemoJob as Job, new AbortController());
  assert.deepEqual(o.additionalDirectories, [LEMO_LIB]);
  assert.equal(o.env!.LIB, LEMO_LIB);
  assert.ok(o.disallowedTools!.includes("Bash(git push *)"));
});
