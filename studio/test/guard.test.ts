import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isLocalRequest, resolveServable } from "../server/guard.ts";

test("local host and origin pass", () => {
  assert.equal(isLocalRequest({ host: "127.0.0.1:4317" }, 4317), true);
  assert.equal(
    isLocalRequest({ host: "localhost:4317", origin: "http://localhost:4317" }, 4317),
    true,
  );
});

test("foreign origin or rebinding host is refused", () => {
  assert.equal(
    isLocalRequest({ host: "127.0.0.1:4317", origin: "https://evil.example" }, 4317),
    false,
  );
  assert.equal(isLocalRequest({ host: "evil.example:4317" }, 4317), false);
  assert.equal(isLocalRequest({ host: "127.0.0.1:9999" }, 4317), false);
  assert.equal(isLocalRequest({}, 4317), false);
});

test("servable paths stay inside the roots", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "guard-"));
  const root = path.join(base, "root");
  fs.mkdirSync(root);
  fs.writeFileSync(path.join(root, "a.txt"), "a");
  fs.writeFileSync(path.join(base, "outside.txt"), "x");
  fs.symlinkSync(path.join(base, "outside.txt"), path.join(root, "link-out.txt"));
  try {
    assert.equal(
      resolveServable(path.join(root, "a.txt"), [root]),
      fs.realpathSync(path.join(root, "a.txt")),
    );
    assert.equal(resolveServable(path.join(root, "../outside.txt"), [root]), null);
    assert.equal(resolveServable("/etc/hosts", [root]), null);
    assert.equal(resolveServable(path.join(root, "link-out.txt"), [root]), null);
    assert.equal(resolveServable(path.join(root, "missing.txt"), [root]), null);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});
