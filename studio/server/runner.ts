import { query as sdkQuery } from "@anthropic-ai/claude-agent-sdk";
import type { Options } from "@anthropic-ai/claude-agent-sdk";
import { finalizeLemo } from "./engines.ts";
import { toJobEvents } from "./events.ts";
import type { JobStore } from "./jobs.ts";
import { LEMO_LIB, REPO } from "./paths.ts";
import { STUDIO_APPEND } from "./prompts.ts";
import type { Job, JobEvent, JobStatus, Phase } from "./types.ts";

export type QueryFn = typeof sdkQuery;

export const ALLOWED_TOOLS: string[] = [
  "Bash",
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
  "Skill",
  "TodoWrite",
  "WebFetch",
  "WebSearch",
];

export const DENIED_TOOLS: string[] = [
  "AskUserQuestion",
  "Bash(git push *)",
  "Bash(git commit *)",
  "Bash(git reset *)",
  "Bash(git rebase *)",
  "Bash(git checkout *)",
  "Bash(sudo *)",
  "Bash(npm run clean *)",
];

export function agentOptions(job: Job, abort: AbortController): Options {
  const lemo = job.engine === "lemo";
  return {
    cwd: REPO,
    settingSources: ["user", "project", "local"],
    systemPrompt: { type: "preset", preset: "claude_code", append: STUDIO_APPEND },
    permissionMode: "acceptEdits",
    allowedTools: ALLOWED_TOOLS,
    disallowedTools: DENIED_TOOLS,
    maxTurns: 300,
    abortController: abort,
    additionalDirectories: lemo ? [LEMO_LIB] : [],
    // The SDK replaces the child's environment instead of merging, so spread process.env.
    env: { ...process.env, ...(lemo ? { LIB: LEMO_LIB } : {}) },
    // Nobody is there to answer a prompt: anything not pre-approved is refused at once.
    canUseTool: async (name) => ({
      behavior: "deny",
      message: `${name} is not available in Studio; continue without it.`,
    }),
  };
}

export interface Runner {
  start(jobId: string, phase: Phase, prompt: string, resume?: string): void;
  stop(jobId: string): boolean;
  isRunning(jobId: string): boolean;
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message || e.name : String(e);
}

export function createRunner(
  store: JobStore,
  publish: (jobId: string, index: number, ev: JobEvent) => void,
  query: QueryFn = sdkQuery,
): Runner {
  const running = new Map<string, AbortController>();

  function emit(jobId: string, ev: JobEvent): void {
    const index = store.appendEvent(jobId, ev);
    publish(jobId, index, ev);
  }

  async function run(
    jobId: string,
    phase: Phase,
    prompt: string,
    resume: string | undefined,
    abort: AbortController,
  ): Promise<void> {
    let outcome: { status: JobStatus; error?: string } = { status: "failed", error: "agent ended without a result" };
    try {
      const startJob = store.get(jobId)!;
      // total_cost_usd is cumulative for a resumed session (the SDK seeds it from the
      // saved transcript), so on resume it replaces the running total; a fresh session adds.
      const startCost = startJob.costUsd;
      let sawResult = false;

      for await (const msg of query({
        prompt,
        options: { ...agentOptions(startJob, abort), ...(resume ? { resume } : {}) },
      })) {
        if (abort.signal.aborted) break;
        const mapped = toJobEvents(msg, Date.now());
        if (mapped.sessionId && store.get(jobId)?.sessionId !== mapped.sessionId) {
          store.update(jobId, { sessionId: mapped.sessionId });
        }
        for (const ev of mapped.events) emit(jobId, ev);
        if (mapped.result) {
          sawResult = true;
          const total = mapped.result.costUsd;
          store.update(jobId, { costUsd: resume ? Math.max(startCost, total) : startCost + total });
          if (mapped.result.ok) {
            outcome = { status: phase === "plan" ? "awaiting_approval" : "done" };
          } else {
            outcome = { status: "failed", error: mapped.result.message || "the agent reported a failure" };
          }
        }
      }

      if (!sawResult && !abort.signal.aborted) outcome = { status: "failed", error: "agent ended without a result" };

      if (!abort.signal.aborted && outcome.status === "done" && startJob.engine === "lemo") {
        try {
          finalizeLemo(store.get(jobId) ?? startJob);
        } catch (e) {
          const message = `could not copy the film to out/: ${messageOf(e)}`;
          emit(jobId, { t: Date.now(), kind: "error", message });
          outcome = { status: "failed", error: message };
        }
      }
    } catch (e) {
      // Aborting makes the SDK throw an AbortError; a stop is not a failure.
      if (!abort.signal.aborted) {
        const message = messageOf(e);
        try {
          emit(jobId, { t: Date.now(), kind: "error", message });
        } catch {
          // the final status below still has to go out
        }
        outcome = { status: "failed", error: message };
      }
    }

    if (abort.signal.aborted) outcome = { status: "stopped" };

    try {
      store.update(jobId, { status: outcome.status, error: outcome.error });
      emit(jobId, { t: Date.now(), kind: "status", phase, status: outcome.status });
    } finally {
      running.delete(jobId);
    }
  }

  return {
    start(jobId, phase, prompt, resume) {
      if (!store.get(jobId)) throw new Error(`no such job: ${jobId}`);
      if (running.has(jobId)) throw new Error(`job ${jobId} is already running`);
      const abort = new AbortController();
      running.set(jobId, abort);
      try {
        store.update(jobId, { phase, status: "running", phaseStartedAt: Date.now(), error: undefined });
        emit(jobId, { t: Date.now(), kind: "status", phase, status: "running" });
      } catch (e) {
        running.delete(jobId);
        throw e;
      }
      void run(jobId, phase, prompt, resume, abort).catch((e) => {
        // run() handles its own errors; this only guards against an unhandled rejection.
        console.error(`studio runner: job ${jobId} crashed: ${messageOf(e)}`);
        running.delete(jobId);
      });
    },

    stop(jobId) {
      const abort = running.get(jobId);
      if (!abort) return false;
      abort.abort();
      return true;
    },

    isRunning(jobId) {
      return running.has(jobId);
    },
  };
}
