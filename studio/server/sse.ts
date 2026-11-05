import type { JobEvent } from "./types.ts";

type Send = (index: number, ev: JobEvent) => void;

/** Per-job fan-out of live events to the open SSE connections. */
export class Hub {
  private readonly listeners = new Map<string, Set<Send>>();

  subscribe(jobId: string, send: Send): () => void {
    let set = this.listeners.get(jobId);
    if (!set) {
      set = new Set();
      this.listeners.set(jobId, set);
    }
    set.add(send);
    return () => {
      const current = this.listeners.get(jobId);
      if (!current) return;
      current.delete(send);
      if (current.size === 0) this.listeners.delete(jobId);
    };
  }

  // An arrow property, so `createRunner(store, hub.publish)` keeps `this`.
  publish = (jobId: string, index: number, ev: JobEvent): void => {
    const set = this.listeners.get(jobId);
    if (!set) return;
    for (const send of [...set]) {
      try {
        send(index, ev);
      } catch {
        // a dead connection must not stop the others (or the runner)
      }
    }
  };
}
