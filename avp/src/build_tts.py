"""Narration + timeline builder for the ISKONNECT AVP.

Reads src/script.json, synthesizes every narration line with Kokoro TTS,
and writes:
  build/voice/<scene>_<n>.wav   one clip per line (24 kHz mono)
  build/timeline.json           absolute scene/line/caption timings
  output/ISKONNECT_AVP.srt      captions for the finished video

Scene length follows the narration, so visuals (which key off line times in
timeline.json) always stay in sync with the voice.

Usage: python build_tts.py --model kokoro-v1.0.onnx --voices voices-v1.0.bin
"""
import argparse
import json
import os
import re

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
BUILD = os.path.join(ROOT, "build")

DEFAULT_GAP = 0.35
MAX_CAPTION_CHARS = 72

# Display text keeps the branding (ISKONNECT, CED); the voice needs help with
# a few words espeak would otherwise mispronounce.
TEXT_FIXES = [
    (r"\bISKONNECT\b", "Iskonnect"),
    (r"\bISKO\b", "Isko"),
    (r"\bCONNECT\b", "connect"),
    (r"\bCED\b", "C-E-D"),
]
PHONEME_FIXES = [
    ("ˈɪskənˌɛkt", "ˈɪskoʊnˌɛkt"),  # IS-ko-NECT, not "iscon-ect"
    ("kˈælɐpˌæn", "kɐlˈɑːpɐn"),  # ka-LA-pan (Filipino stress)
]


def speech_text(text):
    for pat, rep in TEXT_FIXES:
        text = re.sub(pat, rep, text)
    return text


def trim_silence(audio, sr, thresh=0.004, keep=0.03):
    idx = np.where(np.abs(audio) > thresh)[0]
    if len(idx) == 0:
        return audio
    a = max(0, idx[0] - int(keep * sr))
    b = min(len(audio), idx[-1] + int(keep * sr))
    return audio[a:b]


def split_caption(text):
    """Split a narration line into balanced caption chunks of roughly equal
    length (at most ~MAX_CAPTION_CHARS), preferring breaks at punctuation or
    before a conjunction so no chunk ends up as a lone word."""
    if len(text) <= MAX_CAPTION_CHARS:
        return [text]
    n = -(-len(text) // MAX_CAPTION_CHARS)
    spaces = [m.start() for m in re.finditer(" ", text)]
    breaks, lo = [], 0
    for k in range(1, n):
        ideal = len(text) * k / n
        best, best_score = None, None
        for pos in spaces:
            if pos <= lo + 12:
                continue
            score = abs(pos - ideal)
            if text[pos - 1] in ",:;.":
                score -= 14
            nxt = text[pos + 1:].split(" ", 1)[0].lower()
            if nxt in ("and", "but", "while", "with", "so", "or", "then", "which"):
                score -= 7
            if best_score is None or score < best_score:
                best, best_score = pos, score
        breaks.append(best)
        lo = best
    out, prev = [], 0
    for b in breaks + [len(text)]:
        out.append(text[prev:b].strip())
        prev = b
    return [c for c in out if c]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--voices", required=True)
    ap.add_argument("--only-timeline", action="store_true",
                    help="reuse existing wav clips, just rebuild timings")
    args = ap.parse_args()

    with open(os.path.join(HERE, "script.json"), encoding="utf-8") as f:
        script = json.load(f)

    os.makedirs(os.path.join(BUILD, "voice"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "output"), exist_ok=True)
    kokoro = None if args.only_timeline else Kokoro(args.model, args.voices)
    voice, speed = script.get("voice", "af_heart"), script.get("speed", 1.0)

    t = 0.0
    timeline = {"scenes": [], "captions": []}
    for scene in script["scenes"]:
        s_start = t
        cursor = s_start + scene.get("pre", 0.5)
        lines_out = []
        lines = [l if isinstance(l, dict) else {"t": l} for l in scene["lines"]]
        for i, line in enumerate(lines):
            wav = os.path.join(BUILD, "voice", f"{scene['id']}_{i:02d}.wav")
            if not args.only_timeline:
                ph = kokoro.tokenizer.phonemize(speech_text(line["t"]), "en-us")
                for a, b in PHONEME_FIXES:
                    ph = ph.replace(a, b)
                audio, sr = kokoro.create(ph, voice=voice, speed=speed, is_phonemes=True)
                audio = trim_silence(audio, sr)
                sf.write(wav, audio, sr)
            info = sf.info(wav)
            dur = info.frames / info.samplerate
            l_start, l_end = cursor, cursor + dur
            lines_out.append({"text": line["t"], "start": round(l_start, 3),
                              "end": round(l_end, 3), "wav": os.path.relpath(wav, ROOT)})
            # Caption chunks share the line's time in proportion to length.
            chunks = split_caption(line["t"])
            total = sum(len(c) for c in chunks)
            c_t = l_start
            for c in chunks:
                c_d = dur * len(c) / total
                timeline["captions"].append({"text": c, "start": round(c_t, 3), "end": round(c_t + c_d, 3)})
                c_t += c_d
            last = i == len(lines) - 1
            cursor = l_end + (scene.get("post", 0.7) if last else line.get("gap", scene.get("gap", DEFAULT_GAP)))
        s_end = cursor
        entry = {k: v for k, v in scene.items() if k not in ("lines",)}
        entry.update({"start": round(s_start, 3), "end": round(s_end, 3), "lines": lines_out})
        timeline["scenes"].append(entry)
        t = s_end
        print(f"{scene['id']:<20} {s_start:7.2f} -> {s_end:7.2f}  ({s_end - s_start:5.2f}s)")

    timeline["duration"] = round(t, 3)
    with open(os.path.join(BUILD, "timeline.json"), "w", encoding="utf-8") as f:
        json.dump(timeline, f, indent=1, ensure_ascii=False)

    def ts(x):
        ms = int(round(x * 1000))
        return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"

    with open(os.path.join(ROOT, "output", "ISKONNECT_AVP.srt"), "w", encoding="utf-8") as f:
        for n, c in enumerate(timeline["captions"], 1):
            f.write(f"{n}\n{ts(c['start'])} --> {ts(c['end'])}\n{c['text']}\n\n")
    print(f"total {t:.1f}s  ({int(t // 60)}m{t % 60:04.1f}s), {len(timeline['captions'])} captions")


if __name__ == "__main__":
    main()
