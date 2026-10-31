#!/usr/bin/env python3
"""Self-check for tools/speko_lines.py: python3 tools/test_speko_lines.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from speko_lines import clip_name, script_segments, segments

shots = [{"text": "Hi there. Hello.", "lines": [{"speaker": "grandpa", "text": "Hi there."}, {"speaker": "agent", "text": "Hello."}]},
         {"text": "Narration line."}]
assert segments(shots) == [("grandpa", "Hi there."), ("agent", "Hello."), ("narrator", "Narration line.")]
assert clip_name(0, "grandpa") == "01-grandpa.wav" and clip_name(11, "agent") == "12-agent.wav"
names = [clip_name(i, s) for i, (s, _) in enumerate(segments(shots))]
assert sorted(names) == names  # join_lines.py reads clips in sorted order
assert script_segments("# c\n[HOOK] grandpa: Hi, son. (beat)\n[SETUP] agent: Hello!\n") == [("grandpa", "Hi, son."), ("agent", "Hello!")]
