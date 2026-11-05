export type Engine = "remotion" | "lemo";
export type Phase = "plan" | "produce";
export type JobStatus = "running" | "awaiting_approval" | "done" | "failed" | "stopped";

export interface NewJobInput {
  idea: string;
  engine: Engine;
  style?: string;
  seconds: number;
  slug?: string;
}

export interface Job {
  id: string;
  slug: string;
  engine: Engine;
  style?: string;
  idea: string;
  seconds: number;
  phase: Phase;
  status: JobStatus;
  sessionId?: string;
  costUsd: number;
  error?: string;
  createdAt: number;
  phaseStartedAt: number;
}

export type JobEvent =
  | { t: number; kind: "text"; text: string }
  | { t: number; kind: "tool"; name: string; summary: string }
  | { t: number; kind: "status"; phase: Phase; status: JobStatus }
  | { t: number; kind: "result"; ok: boolean; costUsd: number; turns: number; message: string }
  | { t: number; kind: "error"; message: string };

/** Repo-relative paths. */
export interface Outputs {
  planDoc?: string;
  stills: string[];
  video?: string;
  srt?: string;
}
