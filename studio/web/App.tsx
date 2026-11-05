import { useCallback, useEffect, useState } from "react";
import { api, ENGINE_LABEL, formatCost } from "./api.ts";
import type { Job } from "./api.ts";
import { JobView, StatusBadge } from "./JobView.tsx";
import { NewJob } from "./NewJob.tsx";

const POLL_MS = 4000;

type Route = { kind: "new" } | { kind: "job"; id: string };

function parseHash(): Route {
  const m = /^#\/job\/(.+)$/.exec(window.location.hash);
  return m ? { kind: "job", id: decodeURIComponent(m[1]) } : { kind: "new" };
}


export function App() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [listError, setListError] = useState("");
  const [route, setRoute] = useState<Route>(parseHash);

  const refresh = useCallback(async () => {
    try {
      const list = await api.listJobs();
      setJobs([...list].sort((a, b) => b.createdAt - a.createdAt));
      setListError("");
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Could not load jobs.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (r: Route) => {
    window.location.hash = r.kind === "job" ? `#/job/${encodeURIComponent(r.id)}` : "#/new";
  };

  const running = jobs?.find((j) => j.status === "running");

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Episodes">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true" />
          <div>
            <h1 className="brand__name">Studio</h1>
            <p className="brand__sub">@InkwellLife</p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn--primary btn--block"
          aria-current={route.kind === "new" ? "page" : undefined}
          onClick={() => go({ kind: "new" })}
        >
          + New episode
        </button>
        {running && (
          <p className="note">
            One job at a time: <strong>{running.slug}</strong> is running.
          </p>
        )}
        {listError && (
          <p className="inline-error" role="alert">
            {listError}
          </p>
        )}
        <nav aria-label="Jobs">
          <ul className="joblist">
            {jobs === null && !listError && <li className="joblist__empty">Loading…</li>}
            {jobs?.length === 0 && <li className="joblist__empty">No episodes yet.</li>}
            {jobs?.map((j) => {
              const active = route.kind === "job" && route.id === j.id;
              return (
                <li key={j.id}>
                  <button
                    type="button"
                    className={`jobitem${active ? " jobitem--active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => go({ kind: "job", id: j.id })}
                  >
                    <span className="jobitem__top">
                      <span className="jobitem__slug">{j.slug}</span>
                      <StatusBadge status={j.status} />
                    </span>
                    <span className="jobitem__meta">
                      {ENGINE_LABEL[j.engine]}
                      {j.style ? ` · ${j.style}` : ""} · {j.phase} · {formatCost(j.costUsd)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <main className="main">
        {route.kind === "new" ? (
          <NewJob
            onCreated={(job) => {
              void refresh();
              go({ kind: "job", id: job.id });
            }}
          />
        ) : (
          <JobView
            key={route.id}
            id={route.id}
            summary={jobs?.find((j) => j.id === route.id)}
            onChanged={() => void refresh()}
          />
        )}
      </main>
    </div>
  );
}
