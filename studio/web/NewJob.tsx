import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { api, ENGINE_LABEL, slugify } from "./api.ts";
import type { Engine, Job, LemoStyle } from "./api.ts";

const DEFAULT_SECONDS: Record<Engine, number> = { remotion: 60, lemo: 35 };

export function NewJob({ onCreated }: { onCreated: (job: Job) => void }) {
  const [idea, setIdea] = useState("");
  const [engine, setEngine] = useState<Engine>("remotion");
  const [style, setStyle] = useState("");
  const [seconds, setSeconds] = useState<string>(String(DEFAULT_SECONDS.remotion));
  const [secondsTouched, setSecondsTouched] = useState(false);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const [styles, setStyles] = useState<LemoStyle[]>([]);
  const [stylesError, setStylesError] = useState("");

  const [suggesting, setSuggesting] = useState(false);
  const [reason, setReason] = useState("");
  const [suggestError, setSuggestError] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    api
      .styles()
      .then((s) => alive && setStyles(s))
      .catch((e: unknown) => alive && setStylesError(e instanceof Error ? e.message : "Could not load styles."));
    return () => {
      alive = false;
    };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, LemoStyle[]>();
    for (const s of styles) {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [styles]);

  const effectiveSlug = slugTouched ? slug : idea.trim() ? slugify(idea) : "";

  function pickEngine(next: Engine) {
    setEngine(next);
    if (!secondsTouched) setSeconds(String(DEFAULT_SECONDS[next]));
  }

  async function suggest() {
    setSuggestError("");
    setReason("");
    setSuggesting(true);
    try {
      const s = await api.suggest(idea);
      pickEngine(s.engine);
      if (s.engine === "lemo" && s.style) setStyle(s.style);
      setReason(s.reason);
    } catch (e) {
      setSuggestError(e instanceof Error ? e.message : "Suggestion failed.");
    } finally {
      setSuggesting(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const job = await api.createJob({
        idea: idea.trim(),
        engine,
        ...(engine === "lemo" ? { style } : {}),
        seconds: Number(seconds),
        ...(effectiveSlug ? { slug: effectiveSlug } : {}),
      });
      onCreated(job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the job.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="page newjob" onSubmit={(e) => void submit(e)} noValidate>
      <header className="pagehead">
        <h2>New episode</h2>
        <p className="muted">
          An agent writes the plan first and stops for your approval before it produces anything.
        </p>
      </header>

      <div className="field">
        <label htmlFor="idea">Story idea</label>
        <textarea
          id="idea"
          rows={6}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="A security guard at a closed museum notices one painting has changed every night…"
        />
        <span className="hint">10–2000 characters. Premise, twist, tone — whatever you have.</span>
      </div>

      <fieldset className="field">
        <legend>Engine</legend>
        <div className="radios">
          {(["remotion", "lemo"] as const).map((en) => (
            <label key={en} className={`radio${engine === en ? " radio--on" : ""}`}>
              <input
                type="radio"
                name="engine"
                value={en}
                checked={engine === en}
                onChange={() => pickEngine(en)}
              />
              <span>{ENGINE_LABEL[en]}</span>
            </label>
          ))}
          <button
            type="button"
            className="btn"
            onClick={() => void suggest()}
            disabled={suggesting || idea.trim().length < 10}
          >
            {suggesting ? "Thinking…" : "Suggest"}
          </button>
        </div>
        <div aria-live="polite">
          {reason && (
            <p className="suggestion">
              <strong>Suggested:</strong> {reason}
            </p>
          )}
          {suggestError && (
            <p className="inline-error" role="alert">
              {suggestError}
            </p>
          )}
        </div>
      </fieldset>

      {engine === "lemo" && (
        <div className="field">
          <label htmlFor="style">Lemo style</label>
          <select id="style" value={style} onChange={(e) => setStyle(e.target.value)}>
            <option value="">Choose a style…</option>
            {grouped.map(([category, list]) => (
              <optgroup key={category} label={category}>
                {list.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.name} — {s.line}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {stylesError && (
            <span className="inline-error" role="alert">
              {stylesError}
            </span>
          )}
          {!stylesError && styles.length === 0 && (
            <span className="hint">No styles found. Is ~/lemo-opuscar set up?</span>
          )}
        </div>
      )}

      <div className="row">
        <div className="field field--short">
          <label htmlFor="seconds">Length (seconds)</label>
          <input
            id="seconds"
            type="number"
            inputMode="numeric"
            min={15}
            max={90}
            value={seconds}
            onChange={(e) => {
              setSeconds(e.target.value);
              setSecondsTouched(true);
            }}
          />
          <span className="hint">15–90</span>
        </div>
        <div className="field field--grow">
          <label htmlFor="slug">Slug</label>
          <input
            id="slug"
            type="text"
            className="mono"
            spellCheck={false}
            autoCapitalize="off"
            value={effectiveSlug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            placeholder="made-from-the-idea"
          />
          <span className="hint">
            Folder and file name: <code>out/{effectiveSlug || "<slug>"}.mp4</code>
          </span>
        </div>
      </div>

      <div className="actions">
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? "Starting…" : "Start"}
        </button>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
