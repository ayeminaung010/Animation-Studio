#!/usr/bin/env python3
"""Dialogue voices with Speko: one clip per line, each speaker with their own voice.

usage: python3 tools/speko_lines.py <slug> samples   (or: npm run lines -- <slug> samples)
       python3 tools/speko_lines.py <slug> retime    (tempo change only, no Speko call)
       python3 tools/speko_lines.py <slug>           (or: npm run lines -- <slug>)
Voices live in episodes/<slug>/04-voices.json ({model, speakers: {id: {candidates, voice, speed,
instructions}}}); a line's `delivery` in 03-shots.json adds
an acting note for that line. `samples` speaks each speaker's first 3 lines in every candidate voice →
out/voice-samples/. The full run writes episodes/<slug>/voice-clips/NN-<speaker>.wav for every line,
(raw takes in voice-clips-raw/, a speaker's optional `tempo`
applied), then join_lines.py + loudnorm → 04-words.json and public/episodes/<slug>/voice.mp3.
Lines come from 03-shots.json, or from 02-script.md before the shot list exists (samples only).
"""
import json, re, subprocess, sys, urllib.request
from pathlib import Path

from speko_voice import Speko, api_key, find_url

ROOT = Path(__file__).resolve().parent.parent
SAMPLE_LINES = 3


def segments(shots):
    """(speaker, text) per line in shot order — the same order join_lines.py reads clips in."""
    return [(l["speaker"], l["text"]) for s in shots for l in s.get("lines") or [{"speaker": "narrator", "text": s["text"]}]]


def line_notes(shots):
    """Per-line acting note (`lines[].delivery`, "" when none), aligned with segments()."""
    return [l.get("delivery", "") for s in shots for l in s.get("lines") or [{}]]


def instructions(spk, note):
    return f"{spk['instructions']} This line: {note}" if note else spk["instructions"]


def tempo_filter(spk):
    """ffmpeg filter for a speaker's optional `tempo` (speed-up that keeps pitch)."""
    return f"atempo={spk['tempo']}" if spk.get("tempo") else "anull"


def script_segments(md):
    """Lines of a 02-script.md: `[BEAT] speaker: text`, `(beat)` markers dropped."""
    out = []
    for line in md.splitlines():
        m = re.match(r"\[[^\]]+\]\s*([a-z_]+):\s*(.+)", line)
        if m: out.append((m[1], re.sub(r"\s*\(beat\)", "", m[2]).strip()))
    return out


def clip_name(i, speaker):
    return f"{i + 1:02d}-{speaker}.wav"


def synth(speko, cfg, spk, voice, text, out, note=""):
    body = {"text": text, "voice": voice, "model": cfg["model"], "speed": spk["speed"], "instructions": instructions(spk, note),
            "intent": {"language": "en-US", "optimizeFor": "accuracy"},
            "constraints": {"allowedProviders": {"tts": ["openai-tts"]}}}
    res = speko.tool("audio.synthesize", {"body": body})
    url = find_url(res) or sys.exit(f"no download url in synthesize result: {str(res)[:500]}")
    raw = out.with_suffix(".audio")
    urllib.request.urlretrieve(url, raw)
    # One rate and channel count for every clip: join_lines.py asserts they match.
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", raw, "-ac", "1", "-ar", "24000", "-c:a", "pcm_s16le", out], check=True)
    raw.unlink()


def main():
    if len(sys.argv) < 2: sys.exit("usage: python3 tools/speko_lines.py <slug> [samples|retime]")
    slug, mode = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "all")
    # A full run deletes the raw takes and pays for new ones: never fall into it by a typo.
    if mode not in ("all", "samples", "retime"): sys.exit(f"unknown mode {mode!r} (samples, retime, or nothing for a full run)")
    ep = ROOT / f"episodes/{slug}"
    cfg = json.loads((ep / "04-voices.json").read_text())
    shots_path = ep / "03-shots.json"
    if shots_path.exists():
        shots = json.loads(shots_path.read_text())["shots"]
        segs, notes = segments(shots), line_notes(shots)
    elif mode == "samples":
        segs = script_segments((ep / "02-script.md").read_text())
        notes = [""] * len(segs)
    else: sys.exit(f"{shots_path} is missing — write the shot list before generating every line")
    for spk in {s for s, _ in segs} - set(cfg["speakers"]):
        sys.exit(f"speaker {spk!r} has no entry in {ep / '04-voices.json'}")
    if mode == "samples":
        speko = Speko(api_key())
        out = ROOT / "out/voice-samples"
        out.mkdir(parents=True, exist_ok=True)
        for spk_id, spk in cfg["speakers"].items():
            lines = [t for s, t in segs if s == spk_id][:SAMPLE_LINES]
            for voice in spk["candidates"]:
                for n, text in enumerate(lines, 1):
                    path = out / f"{spk_id}-{voice}-{n}.wav"
                    print(f"sample {path.name}: {text}")
                    synth(speko, cfg, spk, voice, text, path)
        print(f"done: {out}")
        return

    raw = ep / "voice-clips-raw"
    if mode != "retime":  # retime: re-apply tempo to the clips already synthesized, no Speko call
        for spk_id, spk in cfg["speakers"].items():
            if not spk.get("voice"): sys.exit(f"pick a voice for {spk_id!r} in 04-voices.json first (samples: npm run lines -- {slug} samples)")
        speko = Speko(api_key())
        raw.mkdir(exist_ok=True)
        for old in raw.glob("*.wav"): old.unlink()  # stale clips would shift every line after them
        for i, (spk_id, text) in enumerate(segs):
            print(f"{clip_name(i, spk_id)}: {text}")
            synth(speko, cfg, cfg["speakers"][spk_id], cfg["speakers"][spk_id]["voice"], text, raw / clip_name(i, spk_id), notes[i])
    clips = ep / "voice-clips"
    clips.mkdir(exist_ok=True)
    for old in clips.glob("*.wav"): old.unlink()
    for i, (spk_id, _) in enumerate(segs):
        name = clip_name(i, spk_id)
        if not (raw / name).exists(): sys.exit(f"{raw / name} is missing — run npm run lines -- {slug}")
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", raw / name, "-af", tempo_filter(cfg["speakers"][spk_id]),
                        "-c:a", "pcm_s16le", clips / name], check=True)
    subprocess.run([sys.executable, ROOT / "tools/join_lines.py", slug], check=True)
    (ROOT / f"public/episodes/{slug}").mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", ep / "voice-joined.wav", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                    "-ar", "44100", "-ac", "1", "-b:a", "192k", ROOT / f"public/episodes/{slug}/voice.mp3"], check=True)
    print(f"done: episodes/{slug}/04-words.json, public/episodes/{slug}/voice.mp3")


if __name__ == "__main__":
    main()
