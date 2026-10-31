#!/usr/bin/env python3
"""Make an episode's voiceover with Speko, without the Claude plugin.

usage: python3 tools/speko_voice.py <slug>        (or: npm run voice -- <slug>)
Needs SPEKO_API_KEY (sk_...) in the environment or in .env. Calls the same audio.synthesize /
audio.transcribe tools the plugin uses (Speko's hosted MCP endpoint takes an API key), so
episodes/<slug>/04-voice-request.json is sent unchanged. Then align_words.py + ffmpeg loudnorm
→ episodes/<slug>/04-words.json and public/episodes/<slug>/voice.mp3.
"""
import json, os, subprocess, sys, urllib.error, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MCP = "https://mcp.speko.ai/mcp"


def api_key():
    if os.environ.get("SPEKO_API_KEY"): return os.environ["SPEKO_API_KEY"]
    env = ROOT / ".env"
    for line in env.read_text().splitlines() if env.exists() else []:
        k, _, v = line.partition("=")
        if k.strip() == "SPEKO_API_KEY": return v.strip().strip("'\"")
    sys.exit("set SPEKO_API_KEY (environment or .env) — make one in the Speko dashboard under API keys")


def rpc_message(body, want_id):
    """A JSON-RPC reply comes back as plain JSON or as an SSE stream of `data:` lines."""
    for chunk in [body] if body.lstrip().startswith("{") else [l[5:] for l in body.splitlines() if l.startswith("data:")]:
        msg = json.loads(chunk)
        if msg.get("id") == want_id: return msg
    sys.exit(f"no reply to request {want_id}: {body[:300]}")


assert rpc_message('{"id":1,"result":2}', 1)["result"] == 2
assert rpc_message('event: message\ndata: {"id":3,"result":{"x":1}}\n\n', 3)["result"] == {"x": 1}


class Speko:
    def __init__(self, key):
        self.h = {"Authorization": f"Bearer {key}", "Content-Type": "application/json",
                  "Accept": "application/json, text/event-stream"}
        self.n = 0
        self.post("initialize", {"protocolVersion": "2025-06-18", "capabilities": {},
                                 "clientInfo": {"name": "twist-shorts", "version": "1"}})
        self.post("notifications/initialized", None)

    def post(self, method, params):
        msg = {"jsonrpc": "2.0", "method": method}
        if params is not None: self.n += 1; msg.update(id=self.n, params=params)
        req = urllib.request.Request(MCP, json.dumps(msg).encode(), self.h)
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                if r.headers.get("mcp-session-id"): self.h["mcp-session-id"] = r.headers["mcp-session-id"]
                body = r.read().decode()
        except urllib.error.HTTPError as e:
            sys.exit(f"Speko {method}: HTTP {e.code} {e.read().decode()[:500]}")
        if params is None: return None
        reply = rpc_message(body, self.n)
        if "error" in reply: sys.exit(f"Speko {method}: {reply['error']}")
        return reply["result"]

    def tool(self, name, args):
        res = self.post("tools/call", {"name": name, "arguments": args})
        text = "".join(c.get("text", "") for c in res.get("content", []))
        if res.get("isError"): sys.exit(f"{name} failed: {text}")
        return res.get("structuredContent") or json.loads(text)


def find_url(x):
    if isinstance(x, str): return x if x.startswith("https://") else None
    for v in (x.values() if isinstance(x, dict) else x if isinstance(x, list) else []):
        if (u := find_url(v)): return u


def main():
    slug = sys.argv[1] if len(sys.argv) > 1 else sys.exit("usage: python3 tools/speko_voice.py <slug>")
    ep = ROOT / f"episodes/{slug}"
    body = json.loads((ep / "04-voice-request.json").read_text())
    tr_opts = body.pop("_transcribe", {})

    speko = Speko(api_key())
    print("synthesizing…")
    audio = speko.tool("audio.synthesize", {"body": body})
    url = find_url(audio) or sys.exit(f"no download url in synthesize result: {str(audio)[:500]}")
    urllib.request.urlretrieve(url, ep / "voice-raw.audio")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", ep / "voice-raw.audio", "-ac", "1", "-c:a", "pcm_s16le",
                    ep / "voice-raw.wav"], check=True)

    print("transcribing…")
    tr = speko.tool("audio.transcribe", {"audio_url": url, "word_timestamps": True,
                                         "language": tr_opts.get("language", "en"), "keywords": tr_opts.get("keywords")})
    (ep / "transcript.json").write_text(json.dumps(tr, indent=1))

    subprocess.run([sys.executable, ROOT / "tools/align_words.py", "transcript.json", "voice-raw.wav"], cwd=ep, check=True)
    (ROOT / f"public/episodes/{slug}").mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", ep / "voice-padded.wav", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                    "-ar", "44100", "-ac", "1", "-b:a", "192k", ROOT / f"public/episodes/{slug}/voice.mp3"], check=True)
    print(f"done: episodes/{slug}/04-words.json, public/episodes/{slug}/voice.mp3")


if __name__ == "__main__":
    main()
