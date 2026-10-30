#!/usr/bin/env python3
"""
motion_qa.py — score a rendered short for "natural motion" before you publish.

Usage:
  python3 motion_qa.py render.mp4 [--crop W:H:X:Y] [--target-sec 60] [--json]

Needs ffmpeg + numpy. Measures, on a downscaled grey copy:
  cuts/min            hard cuts (spike in frame difference vs its neighbours)
  avg shot length     seconds between cuts
  motion energy       mean absolute frame difference (excluding cuts)
  still %             frames with ~no motion (frozen picture)
  longest still       longest frozen run, seconds
  abrupt onsets/min   motion jumping from ~0 to moving within 2 frames
                      (linear tweens / un-eased starts / snaps)
  vo gaps             silences > 0.25 s below -45 dB (bed or VO dropped out)
  runtime             vs target

Thresholds come from the two reference videos (Mirror / Storm Oil) and are
deliberately a little looser than they measured.
"""
import argparse, json, re, subprocess, sys
import numpy as np

W, H = 108, 192

THRESHOLDS = {
    "cuts_per_min":        ("<=", 5.0),   # refs: 0 and 3.7
    "avg_shot_sec":        (">=", 8.0),   # refs: 64 and 12.9
    "motion_energy":       (">=", 4.0),   # refs: 9.0 and 7.8 (this render style dependent)
    "still_pct":           ("<=", 2.0),   # refs: 0.9 and 0.1
    "longest_still_sec":   ("<=", 0.4),   # refs: 0.2 and 0.0
    "abrupt_onsets_per_min": ("<=", 3.0), # refs: 1.9 and 1.9
    "vo_gaps":             ("<=", 0),     # refs: 0 and 0
    "runtime_over_pct":    ("<=", 8.0),
}


def frames_gray(path, crop=None):
    vf = (f"crop={crop}," if crop else "") + f"scale={W}:{H},format=gray"
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", vf, "-f", "rawvideo", "-"],
                       capture_output=True, check=True)
    a = np.frombuffer(p.stdout, np.uint8)
    return a[: len(a) // (W * H) * W * H].reshape(-1, H, W).astype(np.float32)


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                          "stream=r_frame_rate:format=duration", "-of", "json", path],
                         capture_output=True, text=True, check=True).stdout
    j = json.loads(out)
    num, den = j["streams"][0]["r_frame_rate"].split("/")
    return float(num) / float(den), float(j["format"]["duration"])


def vo_gaps(path):
    p = subprocess.run(["ffmpeg", "-v", "info", "-i", path, "-af", "silencedetect=n=-45dB:d=0.25",
                        "-f", "null", "-"], capture_output=True, text=True)
    if "Stream #" in p.stderr and "Audio" not in p.stderr:
        return None
    return len(re.findall(r"silence_end", p.stderr))


def analyse(path, crop=None, target=None):
    fps, dur = probe(path)
    a = frames_gray(path, crop)
    d = np.abs(np.diff(a, axis=0)).mean(axis=(1, 2))
    n = len(d)
    cuts = [i for i in range(2, n - 2)
            if d[i] > 12 and d[i] > 4 * max(0.25, np.median(d[[i - 2, i - 1, i + 1, i + 2]]))]
    cutset = set(cuts) | {c + 1 for c in cuts}
    mask = np.array([i not in cutset for i in range(n)])
    dd = d[mask]
    still = dd < 0.35
    run = best = 0
    for s in still:
        run = run + 1 if s else 0
        best = max(best, run)
    onsets = sum(1 for i in range(2, n) if d[i - 2] < 0.4 and d[i] > 1.5 and i not in cutset and i - 1 not in cutset)
    minutes = n / fps / 60
    bounds = [0] + cuts + [n]
    shots = np.diff(bounds) / fps
    gaps = vo_gaps(path)
    r = {
        "file": path, "duration_sec": round(dur, 2), "fps": fps,
        "cuts": len(cuts), "cuts_per_min": round(len(cuts) / minutes, 2),
        "avg_shot_sec": round(float(shots.mean()), 2),
        "motion_energy": round(float(dd.mean()), 2),
        "still_pct": round(float(still.mean() * 100), 2),
        "longest_still_sec": round(best / fps, 2),
        "abrupt_onsets_per_min": round(onsets / minutes, 2),
        "vo_gaps": gaps,
    }
    if target:
        r["runtime_over_pct"] = round(max(0.0, (dur - target) / target * 100), 1)
    verdict = {}
    for k, (op, lim) in THRESHOLDS.items():
        if k not in r or r[k] is None:
            continue
        ok = r[k] <= lim if op == "<=" else r[k] >= lim
        verdict[k] = {"value": r[k], "limit": f"{op} {lim}", "pass": ok}
    r["verdict"] = verdict
    r["pass"] = all(v["pass"] for v in verdict.values())
    return r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--crop", help="ffmpeg crop W:H:X:Y (e.g. one half of a side-by-side)")
    ap.add_argument("--target-sec", type=float)
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    r = analyse(a.video, a.crop, a.target_sec)
    if a.json:
        print(json.dumps(r, indent=2))
        return
    print(f"\n{r['file']}  ({r['duration_sec']} s @ {r['fps']:.0f} fps)")
    for k, v in r["verdict"].items():
        print(f"  {'PASS' if v['pass'] else 'FAIL'}  {k:<24} {v['value']!s:<8} (want {v['limit']})")
    print(f"  => {'PASS' if r['pass'] else 'FAIL'}\n")
    sys.exit(0 if r["pass"] else 1)


if __name__ == "__main__":
    main()
