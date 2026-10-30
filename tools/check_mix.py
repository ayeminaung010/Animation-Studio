#!/usr/bin/env python3
"""Rebuild the episode mix offline from the same stems and cue sheet the composition uses,
then report true-ish peak, loudness and how clear the voice is over the bed.

usage: node tools/run-ts.mjs tools/dump-cues.ts > out/cues.json
       python3 tools/check_mix.py out/cues.json [--master DB] [--write out/sim.wav]
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parent.parent
SR = 48000


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(ROOT / path), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def db(x):
    return 20 * np.log10(max(x, 1e-12))


def main():
    args = sys.argv[1:]
    d = json.loads(Path(args[0]).read_text())
    master = float(args[args.index("--master") + 1]) if "--master" in args else d["masterDb"]
    fps, n = d["fps"], int(d["frames"] / d["fps"] * SR)
    g = lambda x: 10 ** (x / 20)

    voice = np.zeros(n)
    v = load(d["voice"])[:n]
    voice[: len(v)] = v * g(master)
    bed = np.zeros(n)
    m = load(d["music"])[:n]
    bed[: len(m)] += m * g(master + d["musicDb"])
    for c in d["cues"]:
        x = load(f"public/audio/sfx/{c['name']}.wav")
        if c.get("durationInFrames"):
            x = x[: int(c["durationInFrames"] / fps * SR)]
        i = int(c["from"] / fps * SR)
        k = min(len(x), n - i)
        if k > 0:
            bed[i : i + k] += x[:k] * g(master + c["db"])

    mix = voice + bed
    # 4× oversampled peak ≈ true peak
    from scipy.signal import resample_poly
    tp = np.max(np.abs(resample_poly(mix, 4, 1)))
    print(f"master {master:+.1f} dB   sample peak {db(np.max(np.abs(mix))):+.2f} dBFS   true peak ≈ {db(tp):+.2f} dBTP")

    # Voice clarity: in every 400 ms window where the voice is talking, voice RMS minus bed RMS.
    w = int(0.4 * SR)
    gaps = []
    for s in range(0, n - w, w):
        vr, br = np.sqrt(np.mean(voice[s : s + w] ** 2)), np.sqrt(np.mean(bed[s : s + w] ** 2))
        if vr > g(-30):  # only windows with real speech in them, not pauses between words
            gaps.append((db(vr) - db(br), s / SR))
    gaps.sort()
    print(f"voice over bed: median {np.median([x for x, _ in gaps]):.1f} dB, worst {gaps[0][0]:.1f} dB at {gaps[0][1]:.1f}s")
    print("tightest windows:", ", ".join(f"{t:.1f}s ({x:.1f} dB)" for x, t in gaps[:5]))

    hot = np.where(np.abs(mix) > g(-1))[0]
    if len(hot):
        times = sorted({round(i / SR, 1) for i in hot})
        print("over −1 dBFS at:", ", ".join(f"{t}s" for t in times[:20]))
    if "--write" in args:
        out = ROOT / args[args.index("--write") + 1]
        wavfile.write(out, SR, (np.clip(mix, -1, 1) * 32767).astype(np.int16))
        r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(out), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
        tail = r.stderr[r.stderr.rindex("Summary") :]
        print("integrated:", [l.strip() for l in tail.splitlines() if l.strip().startswith("I:")][0])


if __name__ == "__main__":
    main()
