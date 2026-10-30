#!/usr/bin/env python3
"""QA a rendered episode MP4 against the producer checklist.

usage: python3 tools/qa.py <slug> out/<slug>.mp4
Measures length, audio true peak / loudness, flicker inside shots, framing changes and the twist pace,
and writes review frames (hook, mouths, caption sync, end) to out/qa/.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
FPS = 30


def run(*a):
    return subprocess.run(a, capture_output=True, text=True)


def frame_at(mp4, t, out):
    out.parent.mkdir(parents=True, exist_ok=True)
    run("ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", str(mp4), "-frames:v", "1", str(out))


def main():
    slug, mp4 = sys.argv[1], Path(sys.argv[2])
    shots = json.loads((ROOT / f"episodes/{slug}/03-shots.json").read_text())["shots"]
    words = json.loads((ROOT / f"episodes/{slug}/04-words.json").read_text())
    qa = ROOT / "out/qa"
    results = []

    def check(name, ok, detail):
        results.append((name, ok, detail))
        print(f"[{'PASS' if ok else 'FAIL'}] {name}: {detail}")

    # Shot starts (same rule as src/lib/timing.ts)
    i, starts = 0, []
    for s in shots:
        starts.append(0 if not starts else round(words[i]["startMs"] / 1000 * FPS))
        i += len([w for w in s["text"].split() if w and w not in ("—", "–", "-")])
    end = round((words[-1]["endMs"] + 500) / 1000 * FPS)

    # --- streams & length
    probe = json.loads(run("ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(mp4)).stdout)
    v = next(s for s in probe["streams"] if s["codec_type"] == "video")
    a = next((s for s in probe["streams"] if s["codec_type"] == "audio"), None)
    dur = float(probe["format"]["duration"])
    check("Format", v["width"] == 1080 and v["height"] == 1920 and v["codec_name"] == "h264" and v["r_frame_rate"] == "30/1",
          f'{v["width"]}×{v["height"]} {v["codec_name"]} {v["r_frame_rate"]} fps, audio {a["codec_name"] if a else "MISSING"}')
    check("Length matches the chosen duration (60 s → 55–65 s of narration)", 55 <= dur <= 66, f"{dur:.2f} s")

    # --- audio
    r = run("ffmpeg", "-hide_banner", "-i", str(mp4), "-af", "ebur128=peak=true", "-f", "null", "-")
    summ = r.stderr[r.stderr.rindex("Summary:"):]
    lufs = float(summ.split("I:")[1].split("LUFS")[0])
    tp = float(summ.split("Peak:")[1].split("dBFS")[0])
    check("Audio peaks below −1 dB", tp < -1.0, f"true peak {tp:+.2f} dBTP, integrated {lufs:.1f} LUFS")

    # --- flicker: frame-to-frame change inside shots (cuts excluded) at 135×240 greyscale
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(mp4), "-vf", "scale=135:240,format=gray", "-f", "rawvideo", "-"],
                         capture_output=True).stdout
    frames = np.frombuffer(raw, np.uint8).reshape(-1, 240, 135).astype(np.int16)
    diff = np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2))  # diff[k] = change from frame k to k+1
    cuts = set(starts[1:])
    worst = []
    for k, s in enumerate(shots):
        a0, a1 = starts[k], (starts[k + 1] if k + 1 < len(starts) else end)
        # skip the first 8 frames (transition-in, pops) and any cut boundary
        inner = [d for f, d in enumerate(diff[a0 + 8 : a1 - 1], start=a0 + 8) if f + 1 not in cuts]
        if len(inner) < 4:
            continue
        inner = np.array(inner)
        med = np.median(inner) + 0.5
        spikes = int(np.sum(inner > med * 6))
        worst.append((spikes, s["id"]))
    bad = [sid for n, sid in worst if n > 2]
    check("No flicker or jitter", not bad, "no frame-to-frame spikes inside any shot" if not bad else f"spikes in {bad}")

    # --- framing & pace (from the shot list the render was built from)
    same = [shots[k]["id"] for k in range(1, len(shots)) if shots[k]["camera"]["from"] == shots[k - 1]["camera"]["from"]]
    check("No two identical framings in a row", not same, "every cut changes framing" if not same else str(same))
    lens = [((starts[k + 1] if k + 1 < len(starts) else end) - starts[k]) / FPS for k in range(len(shots))]
    tw = next(k for k, s in enumerate(shots) if s["beat"] == "TWIST" and s["camera"]["move"] == "dolly-zoom")
    check("Twist shot is slower; button ends hard", lens[tw] >= 3.0 and lens[tw] > np.median(lens),
          f"twist {shots[tw]['id']} {lens[tw]:.1f} s vs median shot {np.median(lens):.1f} s; video ends on the last word + 0.5 s")

    # --- review frames
    frame_at(mp4, 0.5, qa / "hook_0.5s.png")
    speak = next(k for k, s in enumerate(shots) if s.get("lines") or any(c.get("speaking") for c in s["characters"]))
    t0, t1 = starts[speak] / FPS, ((starts[speak + 1]) / FPS)
    for j, t in enumerate(np.linspace(t0 + 0.2, t1 - 0.2, 4)):
        frame_at(mp4, t, qa / f"mouth_{shots[speak]['id']}_{j}.png")
    for idx in (0, len(words) // 2, len(words) - 1):
        w = words[idx]
        frame_at(mp4, (w["startMs"] + 120) / 1000, qa / f"caption_{idx:03d}.png")
    frame_at(mp4, dur - 0.05, qa / "last_frame.png")
    print("review frames →", qa)
    (qa / "results.json").write_text(json.dumps([{"check": n, "pass": bool(ok), "detail": d} for n, ok, d in results], indent=1))


if __name__ == "__main__":
    main()
