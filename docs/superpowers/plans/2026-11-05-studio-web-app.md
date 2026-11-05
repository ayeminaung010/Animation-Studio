# Studio Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local web page that turns a story idea into a finished @InkwellLife Short through a Claude Code agent, on either the 3D Twist Shorts engine (this repo) or the lemo-opuscar 2D engine.

**Architecture:** A small Node server (`node:http`, TypeScript run directly by Node's type stripping) owns jobs, persists their events to `studio-data/`, and runs one Claude Agent SDK session per job in two phases (`plan`, then `produce` after the user approves). The browser page (React, bundled by esbuild) talks to it over JSON + Server-Sent Events. A `lemo-kit` folder gives lemo films the channel layer (watermark, CTA card, caption safe area, mastering).

**Tech Stack:** Node ≥ 22.18 (v26 on the user's Mac), `@anthropic-ai/claude-agent-sdk`, React 19 (installed), esbuild (installed), `node:test` + `node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-11-05-studio-web-app-design.md`

## Global Constraints

- Server listens on `127.0.0.1`, port `Number(process.env.STUDIO_PORT ?? 4317)`; never `0.0.0.0`.
- Every request whose `Host` is not `127.0.0.1:<port>` or `localhost:<port>`, or that carries an `Origin` other than `http://127.0.0.1:<port>` / `http://localhost:<port>`, gets `403`.
- Only new dependency: `@anthropic-ai/claude-agent-sdk` (added to `dependencies`). No Express, no Vite, no test framework.
- `studio/package.json` is `{ "type": "module", "private": true }`; server/test files are `.ts`, import each other with explicit `.ts` extensions, and use only erasable TypeScript (no `enum`, no `namespace`, no parameter properties).
- Job data lives in `studio-data/` at the repo root (add `/studio-data/` to `.gitignore`). Lemo films: `studio-data/films/<slug>/`.
- Slugs match `/^[a-z0-9]+(-[a-z0-9]+)*$/`, length 3–40.
- One job may be `running` at a time.
- Watermark text is exactly `@InkwellLife`; the closing line is exactly `Like and subscribe for more.`
- Output video: 1080×1920. Final file for every engine: `out/<slug>.mp4`.
- The agent never commits, pushes, resets or rebases git, never runs `sudo`, never runs `npm run clean`.
- `npm run check` (root) must stay at zero errors; add `tsc -p studio` to it.
- Each task's commit stages only its own files (never `git add -A`: the tree has unrelated uncommitted work) and ends the message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- A request from another site (Origin `https://evil.example`) or a rebinding Host (`evil.example:4317`) → `403` and nothing runs. Test in Task 1 (guard) and Task 6 (routes).
- `/file?path=../../.ssh/id_rsa` or an absolute path outside the allowed roots, or a symlink pointing out → `403`. Test in Task 1.
- Starting a second job while one is running → `409` with a message naming the running job. Test in Task 6.
- The server restarts while a job runs → on startup that job becomes `failed` with error `server restarted`, and `POST /retry` resumes its session. Test in Task 2 (recover) and Task 6 (retry route).
- The agent asks for a tool that is not pre-approved → it gets a deny message immediately and the job keeps going (no hang). Test in Task 5.

---

## File Structure

```
studio/
  package.json            {"type":"module","private":true}
  tsconfig.json           type-check only (noEmit, allowImportingTsExtensions, erasableSyntaxOnly, strict)
  server/
    types.ts              Engine, Phase, JobStatus, Job, JobEvent, Outputs, NewJobInput
    paths.ts              REPO, DATA, FILMS, LEMO_LIB, jobDir(id)
    guard.ts              isLocalRequest(), resolveServable()
    jobs.ts               JobStore: create/get/list/update/appendEvent/readEvents/recoverOnStartup
    events.ts             toJobEvents(msg) — SDK message → JobEvent[] (pure)
    engines.ts            planDocPath(), findOutputs(), listLemoStyles(), slugify()
    prompts.ts            STUDIO_APPEND, planPrompt(), producePrompt(), revisePrompt(), retryPrompt()
    runner.ts             agentOptions(), runPhase(), stopJob() — the only file that calls the SDK
    suggest.ts            suggestEngine()
    sse.ts                Hub: subscribe/publish per job
    routes.ts             createHandler(deps) — every HTTP route
    index.ts              wires real deps, recovers jobs, listens
  web/
    index.html, main.tsx, App.tsx, NewJob.tsx, JobView.tsx, api.ts, style.css
  build-web.mjs           esbuild → studio/web/dist/app.js
  lemo-kit/
    channel.js            watermarkBox, ctaBox, captionBox, drawWatermark, drawCta, glass
    master.sh             grain + −14 LUFS + true peak < −1 dBTP
    README.md             how a lemo film uses the kit (the agent reads this)
  test/
    guard.test.ts, jobs.test.ts, events.test.ts, engines.test.ts, prompts.test.ts,
    runner.test.ts, routes.test.ts, suggest.test.ts, lemo-kit.test.ts
    fixtures/sdk-messages.ts   hand-written SDK messages for tests
```

Root changes: `package.json` (dependency + scripts), `.gitignore`, `README.md` (one "Studio" section).

---

### Task 1: Scaffold, shared types, and the request guard

**Files:**
- Create: `studio/package.json`, `studio/tsconfig.json`, `studio/server/types.ts`, `studio/server/paths.ts`, `studio/server/guard.ts`
- Test: `studio/test/guard.test.ts`
- Modify: `package.json` (dependency, scripts), `.gitignore`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  export type Engine = "remotion" | "lemo";
  export type Phase = "plan" | "produce";
  export type JobStatus = "running" | "awaiting_approval" | "done" | "failed" | "stopped";
  export interface NewJobInput { idea: string; engine: Engine; style?: string; seconds: number; slug?: string }
  export interface Job { id: string; slug: string; engine: Engine; style?: string; idea: string; seconds: number;
    phase: Phase; status: JobStatus; sessionId?: string; costUsd: number; error?: string;
    createdAt: number; phaseStartedAt: number }
  export type JobEvent =
    | { t: number; kind: "text"; text: string }
    | { t: number; kind: "tool"; name: string; summary: string }
    | { t: number; kind: "status"; phase: Phase; status: JobStatus }
    | { t: number; kind: "result"; ok: boolean; costUsd: number; turns: number; message: string }
    | { t: number; kind: "error"; message: string };
  export interface Outputs { planDoc?: string; stills: string[]; video?: string; srt?: string }  // repo-relative paths
  ```
- Produces (`paths.ts`): `REPO: string` (repo root from `import.meta.dirname`), `DATA = process.env.STUDIO_DATA ?? REPO/studio-data` (read at import time, so tests set `STUDIO_DATA` before a dynamic `import()`), `FILMS = DATA/films`, `LEMO_LIB = process.env.LEMO_LIB ?? ~/lemo-opuscar`, `jobDir(id: string): string`.
- Produces (`guard.ts`):
  - `isLocalRequest(headers: { host?: string; origin?: string }, port: number): boolean`
  - `resolveServable(p: string, roots: string[]): string | null` — resolves `p` against `REPO`, follows symlinks with `fs.realpathSync`, returns the real absolute path only if it is inside one of `roots` (also realpath'd) and exists; else `null`.
  - `SERVABLE_ROOTS: string[]` = `[REPO/out, REPO/episodes, DATA]`.

- [ ] **Step 1: Scaffold.** Create `studio/package.json` (`{"type":"module","private":true}`) and `studio/tsconfig.json` (`strict`, `noEmit`, `module: "nodenext"`, `allowImportingTsExtensions`, `erasableSyntaxOnly`, `jsx: "react-jsx"`, `lib: ["ES2023","DOM"]`, `include: ["server","web","test"]`). Run `npm install @anthropic-ai/claude-agent-sdk`. In root `package.json` add scripts `"studio": "node studio/build-web.mjs && node studio/server/index.ts"`, `"test:studio": "node --test studio/test/"`, append ` && npm run test:studio` to `test`, append ` && tsc -p studio` to `check`. Add `/studio-data/` to `.gitignore`.

- [ ] **Step 2: Write the failing test** `studio/test/guard.test.ts`:
  ```ts
  test("local host and origin pass", () => {
    assert.equal(isLocalRequest({ host: "127.0.0.1:4317" }, 4317), true);
    assert.equal(isLocalRequest({ host: "localhost:4317", origin: "http://localhost:4317" }, 4317), true);
  });
  test("foreign origin or rebinding host is refused", () => {
    assert.equal(isLocalRequest({ host: "127.0.0.1:4317", origin: "https://evil.example" }, 4317), false);
    assert.equal(isLocalRequest({ host: "evil.example:4317" }, 4317), false);
    assert.equal(isLocalRequest({ host: "127.0.0.1:9999" }, 4317), false);
    assert.equal(isLocalRequest({}, 4317), false);
  });
  test("servable paths stay inside the roots", () => {
    // tmp root with a.txt, and a symlink inside it pointing to os.tmpdir()/outside.txt
    assert.equal(resolveServable(path.join(root, "a.txt"), [root]), fs.realpathSync(path.join(root, "a.txt")));
    assert.equal(resolveServable(path.join(root, "../outside.txt"), [root]), null);
    assert.equal(resolveServable("/etc/hosts", [root]), null);
    assert.equal(resolveServable(path.join(root, "link-out.txt"), [root]), null);
    assert.equal(resolveServable(path.join(root, "missing.txt"), [root]), null);
  });
  ```

- [ ] **Step 3: Run it to verify it fails.** `node --test studio/test/guard.test.ts` → FAIL (module not found).

- [ ] **Step 4: Implement** `types.ts`, `paths.ts`, `guard.ts` per the Interfaces block. A root check is `real === r || real.startsWith(r + path.sep)`.

- [ ] **Step 5: Verify.** `node --test studio/test/guard.test.ts` → PASS; `npx tsc -p studio` → no errors.

- [ ] **Step 6: Commit.** `git add studio/package.json studio/tsconfig.json studio/server studio/test package.json package-lock.json .gitignore && git commit -m "studio: scaffold, shared types, local-only request guard"`

---

### Task 2: Job store with persistence and restart recovery

**Files:**
- Create: `studio/server/jobs.ts`
- Test: `studio/test/jobs.test.ts`

**Interfaces:**
- Consumes: `Job`, `JobEvent`, `NewJobInput` (Task 1), `slugify`/slug rule (Task 4 defines `slugify`; this task validates only).
- Produces:
  ```ts
  export class JobStore {
    constructor(dataDir: string, isSlugTaken: (slug: string) => boolean);
    create(input: NewJobInput & { slug: string }): Job;          // throws JobError(400|409)
    get(id: string): Job | undefined;
    list(): Job[];                                               // newest first
    update(id: string, patch: Partial<Job>): Job;                // writes job.json
    appendEvent(id: string, ev: JobEvent): number;               // returns index; appends a line to events.ndjson
    readEvents(id: string): JobEvent[];
    running(): Job | undefined;
    recoverOnStartup(): string[];                                // ids moved running → failed
  }
  export class JobError extends Error { status: number }
  export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  ```
  Files: `<dataDir>/jobs/<id>/job.json`, `<dataDir>/jobs/<id>/events.ndjson`. `id` = `${Date.now().toString(36)}-${slug}`. On construction, load every `job.json` under `<dataDir>/jobs/`.

- [ ] **Step 1: Write the failing test** `studio/test/jobs.test.ts` (each test uses a fresh `fs.mkdtempSync` dir):
  ```ts
  test("create persists and reloads", () => {
    const a = new JobStore(dir, () => false);
    const j = a.create({ idea: "x", engine: "lemo", style: "watercolor", seconds: 30, slug: "rain-cat" });
    assert.equal(j.status, "running"); assert.equal(j.phase, "plan"); assert.equal(j.costUsd, 0);
    assert.deepEqual(new JobStore(dir, () => false).get(j.id), j);
  });
  test("bad or taken slug is refused", () => {
    const s = new JobStore(dir, (slug) => slug === "taken");
    assert.throws(() => s.create({ ...base, slug: "Bad Slug" }), (e: JobError) => e.status === 400);
    assert.throws(() => s.create({ ...base, slug: "ab" }), (e: JobError) => e.status === 400);
    assert.throws(() => s.create({ ...base, slug: "taken" }), (e: JobError) => e.status === 409);
    s.create({ ...base, slug: "once" });
    assert.throws(() => s.create({ ...base, slug: "once" }), (e: JobError) => e.status === 409);
  });
  test("events append in order and survive reload", () => {
    const s = new JobStore(dir, () => false); const j = s.create({ ...base, slug: "ev-test" });
    assert.equal(s.appendEvent(j.id, { t: 1, kind: "text", text: "a" }), 0);
    assert.equal(s.appendEvent(j.id, { t: 2, kind: "text", text: "b\nc" }), 1);
    assert.deepEqual(new JobStore(dir, () => false).readEvents(j.id).map((e) => (e as any).text), ["a", "b\nc"]);
  });
  test("restart turns running jobs into failed", () => {
    const s = new JobStore(dir, () => false); const j = s.create({ ...base, slug: "crash-me" });
    const r = new JobStore(dir, () => false);
    assert.deepEqual(r.recoverOnStartup(), [j.id]);
    assert.equal(r.get(j.id)!.status, "failed"); assert.equal(r.get(j.id)!.error, "server restarted");
    assert.equal(r.running(), undefined);
  });
  ```

- [ ] **Step 2: Run to verify it fails.** `node --test studio/test/jobs.test.ts` → FAIL.

- [ ] **Step 3: Implement** `jobs.ts`. `create` checks `SLUG_RE`, length 3–40 (400), then `isSlugTaken(slug)` or any stored job with that slug (409). It does not check `running()`; the route does (Task 6). `recoverOnStartup` also appends a `{kind:"error", message:"server restarted"}` event.

- [ ] **Step 4: Verify.** `node --test studio/test/jobs.test.ts` → PASS.

- [ ] **Step 5: Commit.** `git add studio/server/jobs.ts studio/test/jobs.test.ts && git commit -m "studio: job store with persisted events and restart recovery"`

---

### Task 3: SDK message → job events

**Files:**
- Create: `studio/server/events.ts`, `studio/test/fixtures/sdk-messages.ts`
- Test: `studio/test/events.test.ts`

**Interfaces:**
- Consumes: `JobEvent` (Task 1); SDK types `SDKMessage` from `@anthropic-ai/claude-agent-sdk`.
- Produces:
  ```ts
  export interface Mapped { events: JobEvent[]; sessionId?: string; result?: { ok: boolean; costUsd: number; turns: number; message: string } }
  export function toJobEvents(msg: SDKMessage, now: number): Mapped;
  export function toolSummary(name: string, input: Record<string, unknown>): string;
  ```
  Rules: `system`/`init` → `sessionId` only, no events. `assistant` → one `text` event per non-empty `text` block (trimmed) and one `tool` event per `tool_use` block. `result` with `subtype: "success"` → `result {ok: !is_error, costUsd: total_cost_usd, turns: num_turns, message: result}` plus a `result` event; any other result subtype → `ok:false`, `message: errors.join("\n") || subtype`. Every other message type → nothing.
  `toolSummary`: `Bash` → `input.command` (first line, max 120 chars); `Read`/`Write`/`Edit` → `input.file_path` relative to `REPO` when inside it; `Skill` → `input.skill` or `input.command`; anything else → the tool name.

- [ ] **Step 1: Write fixtures.** In `fixtures/sdk-messages.ts` export `init`, `assistantWithToolAndText`, `resultSuccess`, `resultMaxTurns` as objects typed `as unknown as SDKMessage`, shaped per the SDK reference (`type`, `subtype`, `session_id`, `message.content[]`, `total_cost_usd`, `num_turns`, `result`, `errors`).

- [ ] **Step 2: Write the failing test** `studio/test/events.test.ts`:
  ```ts
  test("init yields the session id only", () => {
    assert.deepEqual(toJobEvents(init, 5), { events: [], sessionId: "sess-1" });
  });
  test("assistant text and tool calls become events", () => {
    const m = toJobEvents(assistantWithToolAndText, 5);
    assert.deepEqual(m.events, [
      { t: 5, kind: "text", text: "Writing the treatment." },
      { t: 5, kind: "tool", name: "Bash", summary: "npm run stills -- rain-cat" },
    ]);
  });
  test("success and failure results", () => {
    assert.deepEqual(toJobEvents(resultSuccess, 9).result, { ok: true, costUsd: 0.42, turns: 12, message: "Plan ready." });
    assert.equal(toJobEvents(resultMaxTurns, 9).result!.ok, false);
    assert.match(toJobEvents(resultMaxTurns, 9).result!.message, /max_turns|turns/);
  });
  test("tool summaries are short and repo-relative", () => {
    assert.equal(toolSummary("Read", { file_path: path.join(REPO, "src/Root.tsx") }), "src/Root.tsx");
    assert.equal(toolSummary("Bash", { command: "a".repeat(300) }).length, 120);
    assert.equal(toolSummary("Glob", {}), "Glob");
  });
  ```

- [ ] **Step 3: Run to verify it fails.** `node --test studio/test/events.test.ts` → FAIL.

- [ ] **Step 4: Implement** `events.ts`.

- [ ] **Step 5: Verify.** `node --test studio/test/events.test.ts` → PASS; `npx tsc -p studio` clean.

- [ ] **Step 6: Commit.** `git add studio/server/events.ts studio/test/events.test.ts studio/test/fixtures && git commit -m "studio: map agent messages to job events"`

---

### Task 4: Engines (paths, outputs, styles) and prompts

**Files:**
- Create: `studio/server/engines.ts`, `studio/server/prompts.ts`
- Test: `studio/test/engines.test.ts`, `studio/test/prompts.test.ts`

**Interfaces:**
- Consumes: `Job`, `Outputs`, `Engine` (Task 1); `REPO`, `FILMS`, `LEMO_LIB` (Task 1).
- Produces (`engines.ts`):
  ```ts
  export function slugify(idea: string): string;              // lowercase, a–z0–9 words joined by "-", first 5 words, max 40, min "episode"
  export function isSlugTaken(slug: string): boolean;         // episodes/<slug> or studio-data/films/<slug> exists
  export function projectDir(job: Job): string;               // remotion: REPO/episodes/<slug>; lemo: FILMS/<slug>
  export function planDocPath(job: Job): string;              // remotion: episodes/<slug>/PLAN.md; lemo: <projectDir>/TREATMENT.md
  export function findOutputs(job: Job): Outputs;             // repo-relative; only files that exist
  export function finalizeLemo(job: Job): void;               // copies <projectDir>/<slug>.mp4 → out/<slug>.mp4 if present
  export interface LemoStyle { slug: string; name: string; category: string; line: string; uses: string[] }
  export function listLemoStyles(lib?: string): LemoStyle[];  // reads <lib>/styles/*/style.json (fields slug,en,category_en,line,uses); [] if lib missing; sorted by category then name
  ```
  `findOutputs` — remotion: `planDoc` = PLAN.md if exists; `stills` = `out/stills/*.png` with `mtimeMs >= job.createdAt`, sorted by name; `video` = `out/<slug>.mp4`; `srt` none. Lemo: `planDoc` = TREATMENT.md; `stills` = `<projectDir>/stills/*.jpg` sorted; `video` = `<projectDir>/<slug>.mp4`; `srt` = `<projectDir>/<slug>.srt`.
- Produces (`prompts.ts`):
  ```ts
  export const STUDIO_APPEND: string;                         // appended to the claude_code system prompt
  export function planPrompt(job: Job): string;
  export function producePrompt(job: Job, notes?: string): string;
  export function revisePrompt(job: Job, notes: string): string;
  export function retryPrompt(job: Job): string;
  ```
  Required content (tests check these strings):
  - `STUDIO_APPEND`: says the agent runs headless inside the Studio web app, nobody can answer questions, so never ask; choose sensible defaults and state them in the final message; never commit, push or reset git and never run `npm run clean`; end each phase with a short report (what was made, where, anything uncertain).
  - `planPrompt` remotion: contains `niche/TOON-3D.md`, `AUTOPILOT`, the JSON `{"topic": <idea>, "duration": <seconds>, "aspect": "9:16"}`, `episodes/<slug>/project.json`, `episodes/<slug>/PLAN.md` (title, logline, full narration ending with `Like and subscribe for more.`, scene list), and "Do not record voice or render. Stop after PLAN.md."
  - `planPrompt` lemo: contains `lemo-opuscar`, the style slug, `~<seconds> s`, `1080x1920`, `English`, `studio-data/films/<slug>`, `studio/lemo-kit/README.md`, "no storyboard stop", and "Stop after TREATMENT.md and three style frames in stills/."
  - `producePrompt` remotion: the user approved and asks for the render; steps in order: `npm run voice -- <slug>`, `python3 tools/tighten_vo.py <slug>`, `node tools/run-ts.mjs tools/check-project.ts <slug> --words`, register the composition in `src/Root.tsx` like `paintbrush-submarine`, `npm run check`, `npm run stills -- <slug>`, `npm run mix:check -- <slug>`, `npm run render -- <slug>`, `npm run qa -- <slug>`; fix failures and re-run the failed step.
  - `producePrompt` lemo: produce through delivery per the library's DIRECTOR.md §11, master with `studio/lemo-kit/master.sh`, final `<slug>.mp4` in the project folder.
  - Both: when `notes` is given, include it under `User notes:`.
  - `revisePrompt`: contains the notes and "Update the plan and the stills, then stop again before production."
  - `retryPrompt`: "The previous run was interrupted. Check what already exists and continue the <phase> phase from there."

- [ ] **Step 1: Write the failing tests.** `engines.test.ts`:
  ```ts
  test("slugify", () => {
    assert.equal(slugify("The Bus that Never Came!! (part 2)"), "the-bus-that-never-came");
    assert.equal(slugify("???"), "episode");
  });
  test("lemo styles load from a library folder", () => {
    // tmp lib with styles/a/style.json {slug:"a",en:"A",category_en:"Cat",line:"l",uses:["x"]} and styles/README.md
    assert.deepEqual(listLemoStyles(lib), [{ slug: "a", name: "A", category: "Cat", line: "l", uses: ["x"] }]);
    assert.deepEqual(listLemoStyles("/nope"), []);
  });
  test("lemo outputs are found in the film folder", () => {
    // job lemo slug "t-film"; process.env.STUDIO_DATA = tmp set before `await import("../server/engines.ts")`; tmp/films/t-film/stills/1.jpg, tmp/films/t-film/t-film.mp4
    const o = findOutputs(job);
    assert.equal(o.stills.length, 1); assert.match(o.video!, /t-film\.mp4$/); assert.equal(o.srt, undefined);
  });
  ```
  `prompts.test.ts`: for each engine, assert the required strings above with `assert.match`; assert `producePrompt(job, "make it shorter")` contains `User notes:\nmake it shorter`; assert `STUDIO_APPEND` matches `/never ask/i` and `/npm run clean/`.

- [ ] **Step 2: Run to verify they fail.** `node --test studio/test/engines.test.ts studio/test/prompts.test.ts` → FAIL.

- [ ] **Step 3: Implement** `engines.ts` and `prompts.ts`.

- [ ] **Step 4: Verify.** Both tests PASS; also `node -e "import('./studio/server/engines.ts').then(m=>console.log(m.listLemoStyles().length))"` prints `66` on the user's Mac.

- [ ] **Step 5: Commit.** `git add studio/server/engines.ts studio/server/prompts.ts studio/test/engines.test.ts studio/test/prompts.test.ts && git commit -m "studio: engine paths, outputs, lemo styles and agent prompts"`

---

### Task 5: The runner (the only code that calls the Agent SDK)

**Files:**
- Create: `studio/server/runner.ts`
- Test: `studio/test/runner.test.ts`

**Interfaces:**
- Consumes: `JobStore` (Task 2), `toJobEvents` (Task 3), prompts + `finalizeLemo` + `projectDir` (Task 4), `LEMO_LIB`, `REPO` (Task 1).
- Produces:
  ```ts
  export type QueryFn = typeof import("@anthropic-ai/claude-agent-sdk").query;
  export const ALLOWED_TOOLS: string[];   // ["Bash","Read","Write","Edit","Glob","Grep","Skill","TodoWrite","WebFetch","WebSearch"]
  export const DENIED_TOOLS: string[];    // ["AskUserQuestion","Bash(git push *)","Bash(git commit *)","Bash(git reset *)","Bash(git rebase *)","Bash(git checkout *)","Bash(sudo *)","Bash(npm run clean *)"]
  export function agentOptions(job: Job, abort: AbortController): Options;   // Options from the SDK
  export interface Runner {
    start(jobId: string, phase: Phase, prompt: string, resume?: string): void;   // fire-and-forget; returns at once
    stop(jobId: string): boolean;                                                // aborts if running
    isRunning(jobId: string): boolean;
  }
  export function createRunner(store: JobStore, publish: (jobId: string, index: number, ev: JobEvent) => void, query?: QueryFn): Runner;
  ```
  `agentOptions`: `cwd: REPO`; `settingSources: ["user","project","local"]`; `systemPrompt: { type: "preset", preset: "claude_code", append: STUDIO_APPEND }`; `permissionMode: "acceptEdits"`; `allowedTools: ALLOWED_TOOLS`; `disallowedTools: DENIED_TOOLS`; `maxTurns: 300`; `abortController: abort`; `additionalDirectories: [LEMO_LIB]` for lemo jobs, `[]` otherwise; `env: { ...process.env, ...(lemo ? { LIB: LEMO_LIB } : {}) }` (the SDK replaces the env, so spread `process.env`); `canUseTool: async (name) => ({ behavior: "deny", message: \`${name} is not available in Studio; continue without it.\` })`.
  `start` flow: `store.update(id, {phase, status:"running", phaseStartedAt: now, error: undefined})`, publish a `status` event, iterate `query({prompt, options: {...agentOptions(job, abort), ...(resume ? {resume} : {})}})`; for each message map with `toJobEvents`, save `sessionId` when present, append+publish each event; on `result`: add `costUsd` to the job total; success → status `awaiting_approval` after `plan`, `done` after `produce` (and `finalizeLemo(job)` for lemo); failure → `failed` with `error = message`. Aborted (`abort.signal.aborted`) → `stopped`. A thrown error → `failed`, error event with the message. Always publish the final `status` event.

- [ ] **Step 1: Write the failing test** `studio/test/runner.test.ts` with a fake `query` (an async generator over fixture messages from Task 3; records the options it was called with):
  ```ts
  test("plan success waits for approval and keeps the session", async () => {
    const r = createRunner(store, pub, fakeQuery([init, assistantWithToolAndText, resultSuccess]));
    r.start(job.id, "plan", "go"); await settled(r, job.id);
    const j = store.get(job.id)!;
    assert.equal(j.status, "awaiting_approval"); assert.equal(j.sessionId, "sess-1"); assert.equal(j.costUsd, 0.42);
    assert.deepEqual(store.readEvents(job.id).map((e) => e.kind), ["status", "text", "tool", "result", "status"]);
  });
  test("produce resumes the session and finishes done", async () => {
    r.start(job.id, "produce", "go", "sess-1"); await settled(r, job.id);
    assert.equal(lastCall().options.resume, "sess-1"); assert.equal(store.get(job.id)!.status, "done");
  });
  test("an agent error result fails the job with its message", async () => { /* resultMaxTurns → status failed, error matches /turns/ */ });
  test("stop aborts and marks stopped", async () => { /* fake query yields init then awaits the abort signal; r.stop() → status stopped */ });
  test("unapproved tools are denied, not left waiting", async () => {
    const res = await agentOptions(job, new AbortController()).canUseTool!("NotebookEdit", {}, { signal: new AbortController().signal, toolUseID: "t", requestId: "r" } as any);
    assert.equal(res!.behavior, "deny");
  });
  test("lemo jobs get the library directory and LIB", () => {
    const o = agentOptions(lemoJob, new AbortController());
    assert.deepEqual(o.additionalDirectories, [LEMO_LIB]); assert.equal(o.env!.LIB, LEMO_LIB);
    assert.ok(o.disallowedTools!.includes("Bash(git push *)"));
  });
  ```
  `settled(r, id)` polls `r.isRunning(id)` every 10 ms until false.

- [ ] **Step 2: Run to verify it fails.** `node --test studio/test/runner.test.ts` → FAIL.

- [ ] **Step 3: Implement** `runner.ts`. Keep one `AbortController` per running job in a `Map`.

- [ ] **Step 4: Verify.** `node --test studio/test/runner.test.ts` → PASS; `npx tsc -p studio` clean (it type-checks `Options` and `canUseTool` against the installed SDK; fix field names to whatever the compiler reports).

- [ ] **Step 5: Commit.** `git add studio/server/runner.ts studio/test/runner.test.ts && git commit -m "studio: agent runner with resume, stop, and no-hang permissions"`

---

### Task 6: HTTP routes, live events, and the server entry

**Files:**
- Create: `studio/server/sse.ts`, `studio/server/routes.ts`, `studio/server/index.ts`
- Test: `studio/test/routes.test.ts`

**Interfaces:**
- Consumes: everything above; `suggestEngine` (Task 7) via deps.
- Produces:
  ```ts
  // sse.ts
  export class Hub { subscribe(jobId: string, send: (index: number, ev: JobEvent) => void): () => void; publish(jobId: string, index: number, ev: JobEvent): void }
  // routes.ts
  export interface Deps { store: JobStore; runner: Runner; hub: Hub; port: number;
    suggest: (idea: string) => Promise<{ engine: Engine; style?: string; reason: string }>; webDir: string }
  export function createHandler(deps: Deps): (req: IncomingMessage, res: ServerResponse) => void;
  ```
  Routes (all JSON unless noted; every request first passes `isLocalRequest`, else `403 {"error":"forbidden"}`):

  | Method & path | Does | Errors |
  |---|---|---|
  | `GET /` and `GET /app.js`, `GET /style.css` | static from `webDir` (`index.html`, `dist/app.js`, `style.css`) | 404 |
  | `GET /api/jobs` | `store.list()` | |
  | `POST /api/jobs` `{idea, engine, style?, seconds, slug?}` | slug = `slug ?? slugify(idea)`; create; `runner.start(id,"plan",planPrompt(job))`; `201 job` | 400 bad body (idea 10–2000 chars, engine valid, lemo needs a style from `listLemoStyles()`, seconds 15–90); 409 when `store.running()` (message names its slug) or slug taken |
  | `GET /api/jobs/:id` | `{ job, outputs: findOutputs(job) }` | 404 |
  | `GET /api/jobs/:id/events` | SSE: replay `readEvents` as `id: <i>\ndata: <json>\n\n`, then live via `hub.subscribe`; unsubscribe on close | 404 |
  | `POST /api/jobs/:id/approve` `{notes?}` | only when `awaiting_approval`; `runner.start(id,"produce",producePrompt(job,notes),job.sessionId)` | 409 wrong status or another job running |
  | `POST /api/jobs/:id/revise` `{notes}` | only when `awaiting_approval`, notes 1–4000 chars; `runner.start(id,"plan",revisePrompt(job,notes),job.sessionId)` | 400 / 409 |
  | `POST /api/jobs/:id/retry` | only when `failed` or `stopped`; same phase, `retryPrompt(job)`, resume `job.sessionId` (none → fresh `planPrompt`) | 409 |
  | `POST /api/jobs/:id/stop` | `runner.stop(id)` | 409 not running |
  | `GET /api/styles` | `listLemoStyles()` | |
  | `POST /api/suggest` `{idea}` | `deps.suggest(idea)` | 400; 502 `{error}` when it throws |
  | `GET /file?path=<repo-relative>` | `resolveServable(path, SERVABLE_ROOTS)` → stream with content type by extension (`.mp4 video/mp4` with `Range` support, `.png/.jpg`, `.md/.srt/.json text/plain; charset=utf-8`) | 403 when null |

  Bodies over 64 KB → 413. `index.ts`: builds the real `JobStore(DATA, isSlugTaken)`, calls `recoverOnStartup()`, creates `Hub`, `createRunner(store, hub.publish)`, `suggestEngine`, listens on `127.0.0.1:port`, logs `Studio on http://127.0.0.1:<port>`.

- [ ] **Step 1: Write the failing test** `studio/test/routes.test.ts`: start `http.createServer(createHandler(deps))` on port 0 with a temp store, a fake runner (records `start` calls, `isRunning` from a set), a fake suggest, and `webDir` a temp folder with `index.html`. Use `fetch` with explicit `Host` header via `http.request` helper `call(method, path, body?, headers?)`.
  ```ts
  test("foreign origin is refused before anything runs", async () => {
    const r = await call("POST", "/api/jobs", goodBody, { origin: "https://evil.example" });
    assert.equal(r.status, 403); assert.equal(fakeRunner.starts.length, 0);
  });
  test("create starts the plan phase", async () => {
    const r = await call("POST", "/api/jobs", goodBody);
    assert.equal(r.status, 201); assert.deepEqual(fakeRunner.starts[0].slice(1, 2), ["plan"]);
  });
  test("second job while one runs is refused", async () => {
    store.update(firstId, { status: "running" });
    const r = await call("POST", "/api/jobs", { ...goodBody, idea: "another idea entirely here" });
    assert.equal(r.status, 409); assert.match(r.json.error, /running/);
  });
  test("approve resumes the session; wrong status is 409", async () => {
    store.update(firstId, { status: "awaiting_approval", sessionId: "s1" });
    assert.equal((await call("POST", `/api/jobs/${firstId}/approve`, {})).status, 200);
    const [, phase, , resume] = fakeRunner.starts.at(-1)!;
    assert.equal(phase, "produce"); assert.equal(resume, "s1");
    assert.equal((await call("POST", `/api/jobs/${firstId}/approve`, {})).status, 409);
  });
  test("retry after a restart resumes the same phase", async () => { /* status failed, sessionId s1 → 200, start(id, phase, retryPrompt, "s1") */ });
  test("file route refuses traversal", async () => {
    assert.equal((await call("GET", "/file?path=../../etc/hosts")).status, 403);
  });
  test("events replay then stream", async () => { /* append 2 events, open SSE, read 2 `data:` lines, hub.publish a third, read it */ });
  test("lemo job needs a known style; seconds bounded", async () => {
    assert.equal((await call("POST", "/api/jobs", { ...goodBody, engine: "lemo", style: "nope" })).status, 400);
    assert.equal((await call("POST", "/api/jobs", { ...goodBody, seconds: 600 })).status, 400);
  });
  ```

- [ ] **Step 2: Run to verify it fails.** `node --test studio/test/routes.test.ts` → FAIL.

- [ ] **Step 3: Implement** `sse.ts`, `routes.ts`, `index.ts`. Match `:id` with one regex per route; no router library. SSE headers: `content-type: text/event-stream`, `cache-control: no-cache`, `connection: keep-alive`; send `: ping\n\n` every 15 s.

- [ ] **Step 4: Verify.** `node --test studio/test/` → all PASS. Then `node studio/server/index.ts` and in another shell `curl -s -H 'Host: 127.0.0.1:4317' http://127.0.0.1:4317/api/styles | head -c 200` → JSON array; `curl -s -o /dev/null -w '%{http_code}' -H 'Origin: https://evil.example' http://127.0.0.1:4317/api/jobs` → `403`. Stop the server.

- [ ] **Step 5: Commit.** `git commit -m "studio: http routes, SSE event stream, server entry"`

---

### Task 7: Engine suggestion

**Files:**
- Create: `studio/server/suggest.ts`
- Test: `studio/test/suggest.test.ts`

**Interfaces:**
- Consumes: `QueryFn` (Task 5), `listLemoStyles` (Task 4).
- Produces: `export function makeSuggest(query?: QueryFn): (idea: string) => Promise<{ engine: Engine; style?: string; reason: string }>`
  One `query` call: `maxTurns: 1`, `settingSources: []`, `cwd: REPO`, `allowedTools: []`, `canUseTool` → deny, `systemPrompt` a plain string: the two engines in one line each (3D Twist Shorts: character twist stories in stylized toon 3D; Lemo 2D: illustrated, print, paper, ink, data and map styles), the style list as `slug — name: line` lines, and "Reply with only JSON: {\"engine\":\"remotion\"|\"lemo\",\"style\":\"<slug or omit>\",\"reason\":\"<one sentence>\"}". Parse the `result` text: take the first `{…}` block, `JSON.parse`, validate engine ∈ {remotion, lemo} and (for lemo) style ∈ the list; otherwise throw `Error("suggestion was not usable")`.

- [ ] **Step 1: Write the failing test**: fake query returning a success result whose `result` is `` 'Sure: {"engine":"lemo","style":"ink-wash","reason":"A fable suits ink."}' `` → resolves to that object (with the tmp style list containing `ink-wash`); a result `{"engine":"lemo","style":"made-up"}` → rejects `/not usable/`; a result `"no json"` → rejects.

- [ ] **Step 2: Run to verify it fails.** `node --test studio/test/suggest.test.ts` → FAIL.

- [ ] **Step 3: Implement** `suggest.ts`; wire `makeSuggest()` into `index.ts` deps.

- [ ] **Step 4: Verify.** Test PASS.

- [ ] **Step 5: Commit.** `git commit -m "studio: engine and style suggestion"`

---

### Task 8: Lemo channel kit

**Files:**
- Create: `studio/lemo-kit/channel.js`, `studio/lemo-kit/master.sh`, `studio/lemo-kit/README.md`
- Test: `studio/test/lemo-kit.test.ts`
- Source to lift from: `out/early-bus-src/film.js` (functions `glass` line 113, `watermark` line 122, `ctaCard` line 127, `subtitle` line 59) and `out/early-bus-src/tools/master.sh`.

**Interfaces:**
- Produces (`channel.js`, plain ES module, no imports, canvas 2D only):
  ```js
  export const SAFE = { x0: 0.07, x1: 0.85, bottom: 0.80 };                 // fractions of W/H
  export function watermarkBox(W, H)  // {x0,y0,x1,y1}: x0 = round(0.07W), y0 = round(0.045H), height 56, width from text "@InkwellLife" (600 30px Jost-like, use 260 when measuring is unavailable)
  export function captionBox(W, H)    // centred at x = (0.07+0.85)/2·W, top 0.677H, height 88, max width 0.63W
  export function ctaBox(W, H)        // centred like captions, width 560, height 96, bottom 16 px above captionBox top
  export function glass(ctx, x, y, w, h, alpha)
  export function drawWatermark(ctx, W, H)          // glass pill + "@InkwellLife" in rgba(43,36,32,0.72)
  export function drawCta(ctx, W, H, t, tLike)      // pops in at tLike (0.3 s back-ease), glass card, thumb glyph drawn with paths (no emoji font), "Like", tomato "SUBSCRIBE" pill
  ```
  `master.sh <project-dir> <name>`: same steps as `out/early-bus-src/tools/master.sh` (library `mux.sh` for grain, then audio re-mastered from `out/mix.wav` with `loudnorm=I=-14:TP=-2.2` two-pass into `<name>.mp4`), prints the measured `I:` and `Peak:` lines, and exits 1 if the measured peak is above `-1.0`.
  `README.md` (the agent reads it during lemo jobs): import `channel.js` by absolute URL is not possible from `/@film/`, so **copy** `channel.js` into the film folder; call `drawWatermark` last in every frame (above captions); captions inside `captionBox`; `drawCta` when the closing line "Like and subscribe for more." starts (from `voices/words.json`); key action out of the bottom 20 % and right 15 %; render with `--size 1080x1920`; finish with `sh <repo>/studio/lemo-kit/master.sh <film-dir> <slug>`; then readcheck, whisper the final mix, and the library's DIRECTOR.md §11 delivery list.

- [ ] **Step 1: Write the failing test** `studio/test/lemo-kit.test.ts` (import `../lemo-kit/channel.js`):
  ```ts
  test("watermark sits top-left inside the safe area", () => {
    const b = watermarkBox(1080, 1920);
    assert.equal(b.x0, 76); assert.equal(b.y0, 86); assert.ok(b.x1 < 0.85 * 1080); assert.ok(b.y1 < 0.2 * 1920);
  });
  test("captions and CTA stay out of the button zones and do not overlap", () => {
    const c = captionBox(1080, 1920), k = ctaBox(1080, 1920);
    for (const b of [c, k]) { assert.ok(b.x0 >= 0.07 * 1080 && b.x1 <= 0.85 * 1080); assert.ok(b.y1 < 0.8 * 1920); }
    assert.ok(k.y1 <= c.y0 - 16);
  });
  test("master.sh refuses a missing project", () => {
    const r = spawnSync("sh", ["studio/lemo-kit/master.sh", "/nonexistent", "x"]); assert.notEqual(r.status, 0);
  });
  ```

- [ ] **Step 2: Run to verify it fails.** `node --test studio/test/lemo-kit.test.ts` → FAIL.

- [ ] **Step 3: Implement** the three files, lifting the drawing code from `out/early-bus-src/film.js` and replacing its `drawHand` thumb with a path-drawn thumb.

- [ ] **Step 4: Verify.** Test PASS. Visual check: copy `channel.js` into `out/early-bus-src/`, swap that film's `watermark(ctx)`/`ctaCard(ctx,t)` calls for `drawWatermark(ctx,1080,1920)`/`drawCta(ctx,1080,1920,t,18.0)`, run `cd ~/lemo-opuscar && node core/render/still.mjs "<repo>/out/early-bus-src" 2 19.5 --size 1080x1920`, and confirm both stills show the pill top-left and the CTA card above the caption.

- [ ] **Step 5: Commit.** `git commit -m "studio: lemo channel kit (watermark, CTA, captions, master)"`

---

### Task 9: The web page

**Files:**
- Create: `studio/web/index.html`, `studio/web/main.tsx`, `studio/web/App.tsx`, `studio/web/NewJob.tsx`, `studio/web/JobView.tsx`, `studio/web/api.ts`, `studio/web/style.css`, `studio/build-web.mjs`
- Modify: `.gitignore` (`/studio/web/dist/`), `README.md` (Studio section)

**Interfaces:**
- Consumes: the HTTP API in Task 6 (shapes from `types.ts`, imported type-only).
- Produces: `studio/web/dist/app.js` via `node studio/build-web.mjs` (esbuild `bundle`, `format: "esm"`, `jsx: "automatic"`, `minify`, entry `studio/web/main.tsx`).

Screens (one page, left column = job list, right = selected job or the new-job form):
- **New episode:** idea textarea; engine radio — "3D Twist Short", "Lemo 2D", plus a **Suggest** button that calls `/api/suggest` and fills engine/style with the reason shown under it; style `<select>` grouped by category (shown only for Lemo, each option `name — line`); length (seconds) number input, default 60 for 3D and 35 for Lemo; slug field pre-filled from the idea (`slugify` rule mirrored client-side) and editable; **Start**. Server errors show inline (e.g. the 409 text).
- **Job view:** header with slug, engine/style, phase + status badge, total cost (`$0.00`), **Stop** while running. Live log from `EventSource(/api/jobs/:id/events)` — text events as paragraphs, tool events as one muted line (`Bash · npm run stills -- slug`), result events as a summary line; auto-scroll unless the user scrolled up. After each `status`/`result` event, refetch `/api/jobs/:id` for outputs.
  - `awaiting_approval`: plan document (fetched from `/file?path=`, shown as preformatted text), stills grid (click to enlarge), notes textarea, **Approve & produce** and **Revise plan** buttons.
  - `done`: `<video controls>` from `/file?path=<video>`, stills grid, links to the plan doc and `.srt`.
  - `failed`/`stopped`: the error text and **Retry**.

- [ ] **Step 1: Build check first.** Write `build-web.mjs` and a minimal `main.tsx` rendering `<App/>` with the job list; run `node studio/build-web.mjs` → writes `studio/web/dist/app.js` without errors.
- [ ] **Step 2: Implement** the screens above.
- [ ] **Step 3: Type-check.** `npx tsc -p studio` → no errors; `npm run check` → no errors.
- [ ] **Step 4: Smoke test without spending tokens.** Start `npm run studio`; with the Playwright MCP tools open `http://127.0.0.1:4317`, confirm the form renders, the Lemo style list has 66 entries, and submitting with a 5-character idea shows the 400 message inline. Seed a fake finished job by writing `studio-data/jobs/<id>/job.json` (status `done`, engine `lemo`, slug `early-bus`) and copying `out/early-bus.mp4` to `studio-data/films/early-bus/early-bus.mp4`; reload and confirm the video plays and stills show. Delete the seeded job folder afterwards.
- [ ] **Step 5: Docs.** Add a "Studio" section to `README.md`: `npm run studio`, open `http://127.0.0.1:4317`, needs a working `claude` login, lemo jobs need `~/lemo-opuscar` set up (`setup.sh deps voice music`), one job at a time, where files go.
- [ ] **Step 6: Commit.** `git commit -m "studio: web page for new episodes, live log, approval and results"`

---

### Task 10: First real run (the user runs it; it spends agent credits)

**Files:** none (verification only)

- [ ] **Step 1:** User runs `npm run studio`, starts a **Lemo 2D** job (style `midcentury-toon`, 25 s, a one-paragraph idea). Expected: log streams within ~10 s; the job reaches `awaiting_approval` with `TREATMENT.md` and three stills visible.
- [ ] **Step 2:** **Revise plan** with one note; expected: back to `running`, then `awaiting_approval` with the note reflected in the treatment.
- [ ] **Step 3:** **Approve & produce**; expected: `done`, video plays in the page, `out/<slug>.mp4` exists, the watermark and CTA are visible, and the agent's final report lists loudness and true peak (≤ −1 dBTP).
- [ ] **Step 4:** Start a **3D Twist Short** job (60 s). Expected: `awaiting_approval` with `episodes/<slug>/PLAN.md`; approve; expected: `done` with `out/<slug>.mp4` and QA results in the final report. Stop the server mid-run once and restart it to confirm the job shows `failed — server restarted` and **Retry** continues it.
- [ ] **Step 5:** Run `npm run check` and `npm test` → all pass.
