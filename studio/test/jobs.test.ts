import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { JobStore, JobError, SLUG_RE } from "../server/jobs.ts";
import type { NewJobInput } from "../server/types.ts";

const base: NewJobInput = { idea: "a cat waits out the rain", engine: "lemo", style: "watercolor", seconds: 30 };

function freshDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "studio-jobs-"));
}

test("create persists and reloads", () => {
  const dir = freshDir();
  const a = new JobStore(dir, () => false);
  const j = a.create({ idea: "x", engine: "lemo", style: "watercolor", seconds: 30, slug: "rain-cat" });
  assert.equal(j.status, "running");
  assert.equal(j.phase, "plan");
  assert.equal(j.costUsd, 0);
  assert.match(j.id, /^[0-9a-z]+-rain-cat$/);
  assert.deepEqual(new JobStore(dir, () => false).get(j.id), j);
});

test("bad or taken slug is refused", () => {
  const dir = freshDir();
  const s = new JobStore(dir, (slug) => slug === "taken");
  assert.throws(() => s.create({ ...base, slug: "Bad Slug" }), (e: JobError) => e.status === 400);
  assert.throws(() => s.create({ ...base, slug: "ab" }), (e: JobError) => e.status === 400);
  assert.throws(() => s.create({ ...base, slug: "a".repeat(41) }), (e: JobError) => e.status === 400);
  assert.throws(() => s.create({ ...base, slug: "taken" }), (e: JobError) => e.status === 409);
  s.create({ ...base, slug: "once" });
  assert.throws(() => s.create({ ...base, slug: "once" }), (e: JobError) => e.status === 409);
});

test("SLUG_RE accepts hyphenated lowercase slugs only", () => {
  assert.equal(SLUG_RE.test("rain-cat-2"), true);
  assert.equal(SLUG_RE.test("-rain"), false);
  assert.equal(SLUG_RE.test("rain--cat"), false);
  assert.equal(SLUG_RE.test("Rain"), false);
});

test("events append in order and survive reload", () => {
  const dir = freshDir();
  const s = new JobStore(dir, () => false);
  const j = s.create({ ...base, slug: "ev-test" });
  assert.equal(s.appendEvent(j.id, { t: 1, kind: "text", text: "a" }), 0);
  assert.equal(s.appendEvent(j.id, { t: 2, kind: "text", text: "b\nc" }), 1);
  const reloaded = new JobStore(dir, () => false);
  assert.deepEqual(
    reloaded.readEvents(j.id).map((e) => (e as { text: string }).text),
    ["a", "b\nc"],
  );
  assert.equal(reloaded.appendEvent(j.id, { t: 3, kind: "text", text: "d" }), 2);
});

test("update patches, persists and list is newest first", () => {
  const dir = freshDir();
  const s = new JobStore(dir, () => false);
  const a = s.create({ ...base, slug: "first-job" });
  s.update(a.id, { status: "done" });
  const b = s.create({ ...base, slug: "second-job" });
  s.update(b.id, { status: "awaiting_approval", sessionId: "sess-1", costUsd: 0.5 });
  assert.equal(s.get(b.id)!.sessionId, "sess-1");
  assert.equal(new JobStore(dir, () => false).get(b.id)!.costUsd, 0.5);
  assert.equal(s.running(), undefined);
  assert.equal(s.list().length, 2);
  assert.ok(s.list()[0]!.createdAt >= s.list()[1]!.createdAt);
  assert.throws(() => s.update("nope", {}), (e: JobError) => e.status === 404);
});

test("restart turns running jobs into failed", () => {
  const dir = freshDir();
  const s = new JobStore(dir, () => false);
  const j = s.create({ ...base, slug: "crash-me" });
  const r = new JobStore(dir, () => false);
  assert.equal(r.running()?.id, j.id);
  assert.deepEqual(r.recoverOnStartup(), [j.id]);
  assert.equal(r.get(j.id)!.status, "failed");
  assert.equal(r.get(j.id)!.error, "server restarted");
  assert.equal(r.running(), undefined);
  const last = r.readEvents(j.id).at(-1);
  assert.equal(last?.kind, "error");
  assert.equal((last as { message: string }).message, "server restarted");
  assert.deepEqual(r.recoverOnStartup(), []);
});
