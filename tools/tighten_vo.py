#!/usr/bin/env python3
"""Close the voiceover's pauses (Fit Law: no gap over 0.25 s, no intro silence) without a new TTS take.

usage: python3 tools/tighten_vo.py <slug> [keep_ms=200]
Reads episodes/<slug>/voice-padded.wav + 04-words.json (from speko_voice.py), cuts the middle of every
gap longer than keep_ms down to keep_ms, drops the silence before the first word, shifts the word
timings to match, and rewrites both, then public/episodes/<slug>/voice.mp3 (loudnorm, as speko_voice).
"""
import json, shutil, subprocess, sys, wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def plan(words, keep_ms):
    """[(start_ms, end_ms)] spans to remove, and the shifted words."""
    cuts = [(0, words[0]["startMs"])] if words[0]["startMs"] > 0 else []
    for a, b in zip(words, words[1:]):
        gap = b["startMs"] - a["endMs"]
        if gap > keep_ms:
            mid = a["endMs"] + keep_ms // 2
            cuts.append((mid, mid + gap - keep_ms))
    out, removed, k = [], 0, 0
    for w in words:
        while k < len(cuts) and cuts[k][1] <= w["startMs"]:
            removed += cuts[k][1] - cuts[k][0]
            k += 1
        out.append({**w, "startMs": w["startMs"] - removed, "endMs": w["endMs"] - removed})
    return cuts, out


_c, _w = plan([{"text": "a", "startMs": 300, "endMs": 500}, {"text": "b", "startMs": 1100, "endMs": 1300}], 200)
assert _c == [(0, 300), (600, 1000)] and _w[0]["startMs"] == 0 and _w[1]["startMs"] - _w[0]["endMs"] == 200, (_c, _w)


def main():
    slug = sys.argv[1] if len(sys.argv) > 1 else sys.exit("usage: python3 tools/tighten_vo.py <slug> [keep_ms]")
    keep = int(sys.argv[2]) if len(sys.argv) > 2 else 200
    ep = ROOT / f"episodes/{slug}"
    # Both files are rewritten in place: keep the untouched take once, so a bad keep_ms can be undone.
    for name in ("voice-padded.wav", "04-words.json"):
        orig = ep / name.replace(".", ".orig.", 1)
        if not orig.exists(): shutil.copy(ep / name, orig)
    words = json.loads((ep / "04-words.json").read_text())
    cuts, tight = plan(words, keep)

    src = wave.open(str(ep / "voice-padded.wav"))
    p = src.getparams()
    data = src.readframes(p.nframes)
    bpf = p.sampwidth * p.nchannels
    at = lambda ms: int(ms * p.framerate / 1000) * bpf
    out, last = b"", 0
    for a, b in cuts:
        out += data[last:at(a)]
        last = at(b)
    out += data[last:]
    dst = wave.open(str(ep / "voice-padded.wav"), "wb")
    dst.setparams(p)
    dst.writeframes(out)
    dst.close()
    (ep / "04-words.json").write_text(json.dumps(tight, indent=1, ensure_ascii=False))

    (ROOT / f"public/episodes/{slug}").mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", ep / "voice-padded.wav", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                    "-ar", "44100", "-ac", "1", "-b:a", "192k", ROOT / f"public/episodes/{slug}/voice.mp3"], check=True)
    removed = sum(b - a for a, b in cuts)
    print(f"removed {removed} ms in {len(cuts)} cuts; last word now ends {tight[-1]['endMs']} ms")


if __name__ == "__main__":
    main()
