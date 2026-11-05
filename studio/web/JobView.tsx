import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { api, ENGINE_LABEL, fetchText, fileUrl, formatCost, STATUS_LABEL } from "./api.ts";
import type { Job, JobDetail, JobEvent, JobStatus } from "./api.ts";

export function StatusBadge({ status }: { status: JobStatus }) {
  return <span className={`badge badge--${status}`}>{STATUS_LABEL[status]}</span>;
}

function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

/* ---------- live log ---------- */

function LogLine({ ev }: { ev: JobEvent }) {
  switch (ev.kind) {
    case "text":
      return <p className="log__text">{ev.text}</p>;
    case "tool":
      return (
        <p className="log__tool">
          <span className="log__toolname">{ev.name}</span> · {ev.summary}
        </p>
      );
    case "result":
      return (
        <p className={`log__result${ev.ok ? "" : " log__result--bad"}`}>
          {ev.ok ? "Finished" : "Stopped with an error"} · {formatCost(ev.costUsd)} · {ev.turns} turns
          {ev.message ? ` — ${ev.message}` : ""}
        </p>
      );
    case "status":
      return (
        <p className="log__status">
          {ev.phase} phase · {STATUS_LABEL[ev.status].toLowerCase()}
        </p>
      );
    case "error":
      return <p className="log__error">{ev.message}</p>;
  }
}

function Log({ events, tall, live }: { events: JobEvent[]; tall: boolean; live: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const onScroll = () => {
    const el = boxRef.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [events]);

  return (
    <section aria-label="Agent log">
      <h3 className="section-title">Log {live && <span className="live">live</span>}</h3>
      <div
        ref={boxRef}
        className={`log${tall ? " log--tall" : ""}`}
        onScroll={onScroll}
        tabIndex={0}
        role="log"
        aria-label="Agent log"
      >
        {events.length === 0 && <p className="log__status">Waiting for the agent…</p>}
        {events.map((ev, i) => (
          <LogLine key={i} ev={ev} />
        ))}
      </div>
    </section>
  );
}

/* ---------- stills ---------- */

function Stills({ paths, version }: { paths: string[]; version: number }) {
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (paths.length === 0) return null;
  const src = (p: string) => `${fileUrl(p)}&v=${version}`;
  return (
    <section aria-label="Stills">
      <h3 className="section-title">Stills</h3>
      <ul className="stills">
        {paths.map((p) => (
          <li key={p}>
            <button type="button" className="still" onClick={() => setOpen(p)} title={p}>
              <img src={src(p)} alt={p.split("/").pop() ?? p} loading="lazy" />
            </button>
          </li>
        ))}
      </ul>
      {open && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Enlarged still">
          <button
            type="button"
            className="lightbox__close"
            autoFocus
            onClick={() => setOpen(null)}
            aria-label="Close enlarged still"
          >
            Close ✕
          </button>
          <img src={src(open)} alt={open.split("/").pop() ?? open} onClick={() => setOpen(null)} />
        </div>
      )}
    </section>
  );
}

/* ---------- plan document ---------- */

function PlanDoc({ path, version }: { path: string; version: number }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setError("");
    fetchText(path)
      .then((t) => alive && setText(t))
      .catch((e: unknown) => alive && setError(errMsg(e, "Could not load the plan.")));
    return () => {
      alive = false;
    };
  }, [path, version]);

  return (
    <section aria-label="Plan document">
      <h3 className="section-title">
        Plan <code className="path">{path}</code>
      </h3>
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : (
        <pre className="plan">{text ?? "Loading…"}</pre>
      )}
    </section>
  );
}

/* ---------- job view ---------- */

export function JobView({
  id,
  summary,
  onChanged,
}: {
  id: string;
  summary: Job | undefined;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const eventsRef = useRef<(JobEvent | undefined)[]>([]);
  const frame = useRef(0);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const refetch = useCallback(async () => {
    try {
      setDetail(await api.getJob(id));
      setLoadError("");
    } catch (e) {
      setLoadError(errMsg(e, "Could not load the job."));
    }
  }, [id]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // The server replays every event from index 0 on each (re)connect;
  // events are stored by their SSE id so a reconnect never doubles the log.
  useEffect(() => {
    eventsRef.current = [];
    setEvents([]);
    const es = new EventSource(api.eventsUrl(id));

    const flush = () => {
      frame.current = 0;
      setEvents(eventsRef.current.filter((e): e is JobEvent => e !== undefined));
    };

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (msg: MessageEvent<string>) => {
      let ev: JobEvent;
      try {
        ev = JSON.parse(msg.data) as JobEvent;
      } catch {
        return;
      }
      const idx = Number(msg.lastEventId);
      if (!Number.isInteger(idx) || idx < 0) return;
      if (eventsRef.current[idx] !== undefined) return;
      eventsRef.current[idx] = ev;
      if (!frame.current) frame.current = requestAnimationFrame(flush);
      if (ev.kind === "status" || ev.kind === "result") {
        clearTimeout(refetchTimer.current);
        refetchTimer.current = setTimeout(() => {
          void refetch();
          onChanged();
        }, 250);
      }
    };

    return () => {
      es.close();
      setConnected(false);
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
      clearTimeout(refetchTimer.current);
    };
    // onChanged is a fresh closure on every App render; only the job id should restart the stream.
  }, [id, refetch]);

  const job = detail?.job ?? summary;
  const outputs = detail?.outputs;

  async function act(fn: () => Promise<unknown>, clearNotes = false) {
    setBusy(true);
    setActionError("");
    try {
      await fn();
      if (clearNotes) setNotes("");
      await refetch();
      onChanged();
    } catch (e) {
      setActionError(errMsg(e, "Action failed."));
    } finally {
      setBusy(false);
    }
  }

  if (!job) {
    return (
      <div className="page">
        {loadError ? (
          <p className="inline-error" role="alert">
            {loadError}
          </p>
        ) : (
          <p className="muted">Loading…</p>
        )}
      </div>
    );
  }

  const version = job.phaseStartedAt;
  const showLogTall = job.status === "running";

  return (
    <div className="page jobview">
      <header className="jobhead">
        <div className="jobhead__main">
          <h2 className="jobhead__slug">{job.slug}</h2>
          <p className="jobhead__meta">
            {ENGINE_LABEL[job.engine]}
            {job.style ? ` · ${job.style}` : ""} · {job.seconds}s · <span className="cap">{job.phase}</span> phase
          </p>
        </div>
        <div className="jobhead__side">
          <StatusBadge status={job.status} />
          <span className="cost" title="Total cost so far">
            {formatCost(job.costUsd)}
          </span>
          {job.status === "running" && (
            <button type="button" className="btn btn--danger" disabled={busy} onClick={() => void act(() => api.stop(id))}>
              Stop
            </button>
          )}
        </div>
      </header>

      <details className="idea">
        <summary>Idea</summary>
        <p>{job.idea}</p>
      </details>

      {loadError && (
        <p className="inline-error" role="alert">
          {loadError}
        </p>
      )}

      {(job.status === "failed" || job.status === "stopped") && (
        <section className="panel panel--bad" aria-label="Job stopped">
          <p className="panel__title">{job.status === "failed" ? "The job failed" : "The job was stopped"}</p>
          {job.error && <pre className="errtext">{job.error}</pre>}
          <div className="actions">
            <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void act(() => api.retry(id))}>
              Retry
            </button>
          </div>
        </section>
      )}

      {job.status === "awaiting_approval" && (
        <section className="panel" aria-label="Approval">
          <p className="panel__title">Review the plan, then approve or ask for changes</p>
          {outputs?.planDoc ? (
            <PlanDoc path={outputs.planDoc} version={version} />
          ) : (
            <p className="muted">No plan document found yet.</p>
          )}
          <Stills paths={outputs?.stills ?? []} version={version} />
          <div className="field">
            <label htmlFor="notes">Notes (optional for approval, required for revision)</label>
            <textarea id="notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy}
              onClick={() => void act(() => api.approve(id, notes.trim()), true)}
            >
              Approve &amp; produce
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || notes.trim().length === 0}
              onClick={() => void act(() => api.revise(id, notes.trim()), true)}
            >
              Revise plan
            </button>
          </div>
        </section>
      )}

      {job.status === "done" && (
        <section className="panel" aria-label="Result">
          {outputs?.video ? (
            <video className="video" controls preload="metadata" src={`${fileUrl(outputs.video)}&v=${version}`} />
          ) : (
            <p className="muted">The job finished but no video was found.</p>
          )}
          <p className="links">
            {outputs?.planDoc && (
              <a href={fileUrl(outputs.planDoc)} target="_blank" rel="noreferrer">
                Plan document
              </a>
            )}
            {outputs?.srt && (
              <a href={fileUrl(outputs.srt)} target="_blank" rel="noreferrer">
                Subtitles (.srt)
              </a>
            )}
            {outputs?.video && (
              <a href={fileUrl(outputs.video)} target="_blank" rel="noreferrer">
                {outputs.video}
              </a>
            )}
          </p>
          <Stills paths={outputs?.stills ?? []} version={version} />
        </section>
      )}

      {actionError && (
        <p className="inline-error" role="alert">
          {actionError}
        </p>
      )}

      <Log events={events} tall={showLogTall} live={connected && job.status === "running"} />
    </div>
  );
}
