#!/usr/bin/env python3
"""Join per-line TTS clips (dialogue episodes) into one voice track + 04-words.json.

usage: python3 tools/join_lines.py <slug>
Reads episodes/<slug>/voice-clips/NN-*.wav, one clip per line in shot order (a shot's `lines`,
or its whole `text` when it has none). Trims each clip's silence, joins them with short gaps
(+ the shot's tts_pause_after_ms after its last line), writes episodes/<slug>/voice-joined.wav
and 04-words.json, then: ffmpeg loudnorm → public/episodes/<slug>/voice.mp3.
"""
import json, re, sys, wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
LINE_GAP, SHOT_GAP = 0.25, 0.35  # seconds of silence between lines / between shots

slug = sys.argv[1]
ep = ROOT / f"episodes/{slug}"
shots = json.loads((ep / "03-shots.json").read_text())["shots"]
segs = [(s, l["text"], k == len(s.get("lines") or [0]) - 1) for s in shots
        for k, l in enumerate(s.get("lines") or [{"text": s["text"]}])]
clips = sorted((ep / "voice-clips").glob("*.wav"))
if len(clips) != len(segs):
    sys.exit(f"{len(clips)} clips but the shot list has {len(segs)} lines")


def load(p):
    w = wave.open(str(p))
    x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64)
    return x.reshape(-1, w.getnchannels()).mean(axis=1), w.getframerate()


def tokens(text):
    out = []
    for w in text.split():
        if w in ("—", "–", "-"): out[-1] += " " + w
        else: out.append(w)
    return out


sr = load(clips[0])[1]
out, words, t = [], [], 0.0
for (shot, text, last), path in zip(segs, clips):
    x, r = load(path)
    assert r == sr, f"{path.name}: sample rate {r} != {sr}"
    # Trim to the voiced span (20 ms windows above −40 dB of the clip peak), keep 40 ms margins.
    win = int(0.02 * sr)
    env = np.array([np.abs(x[i:i + win]).max() for i in range(0, len(x), win)])
    on = np.nonzero(env > env.max() * 0.01)[0]
    a, b = max(0, on[0] * win - int(0.04 * sr)), min(len(x), (on[-1] + 1) * win + int(0.04 * sr))
    x = x[a:b]
    # shortcut: word times are spread over the clip by letter count + punctuation pauses, not
    # transcribed; fine for captions. Upgrade to audio.transcribe if captions drift visibly.
    toks = tokens(text)
    weight = [len(re.sub(r"[^A-Za-z0-9]", "", w)) + 2 for w in toks]
    pause = [4 if re.search(r"[.?!]$", w) else 2 if w.endswith(",") else 0 for w in toks]
    pause[-1] = 0
    unit = (len(x) / sr - 0.08) / (sum(weight) + sum(pause))
    c = t + 0.04
    for w, wt, p in zip(toks, weight, pause):
        words.append({"text": w, "startMs": round(c * 1000), "endMs": round((c + wt * unit) * 1000)})
        c += (wt + p) * unit
    gap = (SHOT_GAP + shot.get("tts_pause_after_ms", 0) / 1000) if last else LINE_GAP
    out += [x, np.zeros(int(gap * sr))]
    t += len(x) / sr + gap

y = np.concatenate(out[:-1])  # no trailing gap
dst = wave.open(str(ep / "voice-joined.wav"), "wb")
dst.setnchannels(1); dst.setsampwidth(2); dst.setframerate(sr)
dst.writeframes(np.clip(y, -32768, 32767).astype(np.int16).tobytes()); dst.close()
(ep / "04-words.json").write_text(json.dumps(words, indent=1, ensure_ascii=False))
print(f"{len(words)} words, {len(y) / sr:.2f} s of voice, last word ends {words[-1]['endMs']} ms")
print(f"next: ffmpeg -i {ep / 'voice-joined.wav'} -af loudnorm=I=-16:TP=-1.5:LRA=11 -ar 44100 -ac 1 -b:a 192k public/episodes/{slug}/voice.mp3")
