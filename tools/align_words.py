#!/usr/bin/env python3
"""Align a Speko transcript (word_timestamps=true) to 03-shots.json, insert the
shots' tts_pause_after_ms as real silence, and write 04-words.json + a padded WAV.

usage: python3 tools/align_words.py transcript.json voice-raw.wav
Captions use the script's exact words; timings come from the transcript.
"""
import json, re, sys, wave

transcript, raw_wav = sys.argv[1], sys.argv[2]
try:
    shots = json.load(open("03-shots.json"))["shots"]
except FileNotFoundError:  # engine-contract episodes (project.json): the beats carry the script text
    shots = json.load(open("project.json"))["beats"]
T = json.load(open(transcript))["words"]

toks, pause_after = [], {}
for s in shots:
    for w in s["text"].split():
        if w in ("—", "–", "-"): toks[-1] += " " + w
        else: toks.append(w)
    if s.get("tts_pause_after_ms"): pause_after[len(toks) - 1] = s["tts_pause_after_ms"]

NUM = {"1": ["one", "dollar"]}  # "$1." → one dollar; extend as scripts need
tr = []
for w in T:
    m = re.fullmatch(r"\$(\d+)\W*", w["text"])
    if m and m.group(1) in NUM:
        parts, a, b = NUM[m.group(1)], w["start_ms"], w["end_ms"]
        step = (b - a) // len(parts)
        tr += [{"text": p, "start_ms": a + k * step, "end_ms": a + (k + 1) * step} for k, p in enumerate(parts)]
    else:
        tr.append(w)

norm = lambda x: re.sub(r"[^a-z']", "", x.lower().replace("’", "'"))
if len(tr) != len(toks):
    sys.exit(f"word count mismatch: script {len(toks)} vs transcript {len(tr)}")
for a, b in zip(toks, tr):
    if norm(a.split()[0]) != norm(b["text"]):
        print(f"  note: script '{a}' heard as '{b['text']}'")

words, shift, cuts = [], 0, []
for i, (t, w) in enumerate(zip(toks, tr)):
    words.append({"text": t, "startMs": w["start_ms"] + shift, "endMs": w["end_ms"] + shift})
    if i in pause_after and i + 1 < len(tr):
        cuts.append(((w["end_ms"] + tr[i + 1]["start_ms"]) // 2, pause_after[i]))
        shift += pause_after[i]
json.dump(words, open("04-words.json", "w"), indent=1, ensure_ascii=False)

src = wave.open(raw_wav); p = src.getparams(); data = src.readframes(p.nframes)
bpf, fr, out, last = p.sampwidth * p.nchannels, p.framerate, b"", 0
for cut, ms in cuts:
    pos = int(cut * fr / 1000) * bpf
    out += data[last:pos] + b"\x00" * (int(ms * fr / 1000) * bpf); last = pos
dst = wave.open("voice-padded.wav", "wb"); dst.setparams(p); dst.writeframes(out + data[last:]); dst.close()
print(f"{len(words)} words, pauses {cuts}, last word ends {words[-1]['endMs']} ms")
print("next: ffmpeg -i voice-padded.wav -af loudnorm=I=-16:TP=-1.5:LRA=11 -ar 44100 -ac 1 -b:a 192k 04-voice.mp3")
