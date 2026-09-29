"""Soundtrack builder for the ISKONNECT AVP.

Synthesizes an original background score (so there are no licensing issues)
whose mood follows the video's sections, synthesizes the sound effects cued
by the scenes (build/cues.json), and mixes them with the narration clips
(build/voice/*.wav) using build/timeline.json. Music is ducked under the
voice. Writes build/mix.wav plus stems in build/stems/.

Usage: python mix_audio.py
"""
import json
import os

import numpy as np
import pyloudnorm as pyln
from scipy.ndimage import maximum_filter1d
import soundfile as sf
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
BUILD = os.path.join(ROOT, "build")
SR = 48000
BPM = 88
BEAT = 60 / BPM
BAR = 4 * BEAT
RNG = np.random.default_rng(2026)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def db(x):
    return 10 ** (x / 20)


# ---------------------------------------------------------------- chords
CH = {  # pad voicing, bass root (MIDI)
    "Am": ([57, 60, 64, 69], 45), "F": ([53, 57, 60, 65], 41), "C": ([55, 60, 64, 67], 48),
    "G": ([55, 59, 62, 67], 43), "Em": ([55, 59, 64, 67], 40), "Fmaj7": ([53, 57, 60, 64], 41),
    "Dm": ([57, 62, 65, 69], 38), "Csus": ([55, 60, 65, 67], 48),
}
PROG_MINOR = ["Am", "F", "C", "G"]
PROG_MAJOR = ["C", "G", "Am", "F"]
PROG_BUILD = ["F", "G", "Am", "C"]

# per-section layer gains: pad, arp, bass, kick, hat, arp density (notes/bar)
SECTIONS = {
    "problem": dict(prog=PROG_MINOR, pad=0.85, arp=0.28, bass=0.5, kick=0.0, hat=0.0, dens=4),
    "process": dict(prog=PROG_MINOR, pad=0.75, arp=0.42, bass=0.6, kick=0.0, hat=0.10, dens=8),
    "problems": dict(prog=PROG_MINOR, pad=0.75, arp=0.40, bass=0.6, kick=0.0, hat=0.10, dens=8),
    "bridge": dict(prog=["F", "G", "Am", "G"], pad=0.8, arp=0.5, bass=0.6, kick=0.0, hat=0.16, dens=8),
    "intro": dict(prog=PROG_MAJOR, pad=0.9, arp=0.65, bass=0.8, kick=0.38, hat=0.28, dens=8),
    "overview": dict(prog=PROG_MAJOR, pad=0.75, arp=0.6, bass=0.75, kick=0.36, hat=0.28, dens=8),
    "journey": dict(prog=PROG_MAJOR, pad=0.65, arp=0.55, bass=0.7, kick=0.32, hat=0.26, dens=8),
    "benefits": dict(prog=PROG_BUILD, pad=0.95, arp=0.7, bass=0.8, kick=0.4, hat=0.3, dens=8),
    "closing": dict(prog=["F", "G"], pad=1.0, arp=0.5, bass=0.8, kick=0.0, hat=0.0, dens=8),
}


def env_ar(n, a, r, sus=1.0):
    """Attack / release envelope over n samples (a, r in seconds)."""
    e = np.ones(n) * sus
    na, nr = int(a * SR), int(r * SR)
    if na:
        e[:na] = np.linspace(0, sus, na)
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def saw_soft(f, t, harmonics=9):
    y = np.zeros_like(t)
    for k in range(1, harmonics + 1):
        if f * k > 9000:
            break
        y += np.sin(2 * np.pi * f * k * t) / k * (0.82 ** (k - 1))
    return y


def pluck(f, dur=1.8, bright=1.0):
    t = np.arange(int(dur * SR)) / SR
    parts = [(1, 1.0, 0.55), (2, 0.38 * bright, 0.32), (3, 0.16 * bright, 0.22), (4.02, 0.07 * bright, 0.15), (6.1, 0.025 * bright, 0.08)]
    y = sum(a * np.exp(-t / d) * np.sin(2 * np.pi * f * m * t) for m, a, d in parts)
    y *= np.minimum(1, t / 0.004)
    return y


def lowpass(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2))
    return signal.lfilter(b, a, x, axis=0)


def highpass(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), btype="high")
    return signal.lfilter(b, a, x, axis=0)


def bandpass(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], btype="band")
    return signal.lfilter(b, a, x, axis=0)


def reverb_ir(seconds=2.8, decay=0.6):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = RNG.standard_normal((n, 2)) * np.exp(-t / decay)[:, None]
    ir = lowpass(ir, 5000)
    ir[: int(0.012 * SR)] = 0  # pre-delay
    return ir / np.sqrt((ir ** 2).sum(axis=0))


def add(buf, x, start, pan=0.0, gain=1.0):
    """Mix mono or stereo x into stereo buf at sample `start`."""
    if start >= len(buf):
        return
    if x.ndim == 1:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        x = np.stack([x * l, x * r], axis=1) * np.sqrt(2)
    s0 = max(0, start)
    x = x[s0 - start:]
    n = min(len(x), len(buf) - s0)
    buf[s0:s0 + n] += x[:n] * gain


# ---------------------------------------------------------------- music
def build_music(timeline, total):
    n_total = int(total * SR)
    pad = np.zeros((n_total, 2))
    arp = np.zeros((n_total, 2))
    low = np.zeros((n_total, 2))
    perc = np.zeros((n_total, 2))

    sec_starts = []
    for s in timeline["scenes"]:
        if not sec_starts or sec_starts[-1][1] != s["section"]:
            sec_starts.append((s["start"], s["section"]))

    def section_at(t):
        cur = sec_starts[0][1]
        for st, name in sec_starts:
            if t + 0.01 >= st:
                cur = name
        return cur

    bar_info = []
    for j, (st, sec) in enumerate(sec_starts):
        end = sec_starts[j + 1][0] if j + 1 < len(sec_starts) else total
        cfg = SECTIONS[sec]
        idx, t0 = 0, st
        while t0 < end - 0.05:
            chord = cfg["prog"][idx % len(cfg["prog"])]
            if sec == "closing" and idx >= 2:
                chord = "C"
            bar_info.append((t0, sec, chord, idx, min(BAR, end - t0)))
            idx += 1
            t0 += BAR

    for b, (t0, sec, chord, idx, blen) in enumerate(bar_info):
        cfg = SECTIONS[sec]
        notes, root = CH[chord]
        start = int(t0 * SR)
        final_hold = sec == "closing" and idx >= 2
        # pad: sustained, detuned, soft attack; the final chord rings to the end
        if not (final_hold and idx > 2):
            dur = (total - t0 + 0.2) if final_hold else blen + 1.6
            n = int(dur * SR)
            t = np.arange(n) / SR
            e = env_ar(n, 0.9 if not final_hold else 1.6, 1.6 if not final_hold else 4.5)
            voices = notes + ([48, 72] if final_hold else [])
            for i, m in enumerate(voices):
                for det, pan in ((-7, -0.45), (7, 0.45)):
                    f = hz(m) * 2 ** (det / 1200)
                    add(pad, saw_soft(f, t) * e * 0.055, start, pan=pan * (1 if i % 2 else -1), gain=cfg["pad"])
        # bass
        if not (final_hold and idx > 2):
            f = hz(root)
            if cfg["kick"] > 0 and not final_hold:
                for beat in (0, 2):
                    n = int(BEAT * 2 * SR)
                    t = np.arange(n) / SR
                    y = (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)) * np.exp(-t / 0.9) * env_ar(n, 0.02, 0.1)
                    add(low, y * 0.22, start + int(beat * BEAT * SR), gain=cfg["bass"])
            else:
                dur = (total - t0) if final_hold else blen + 0.3
                n = int(dur * SR)
                t = np.arange(n) / SR
                y = (np.sin(2 * np.pi * f * t) + 0.2 * np.sin(4 * np.pi * f * t)) * env_ar(n, 0.25, 1.2 if final_hold else 0.4)
                add(low, y * 0.18, start, gain=cfg["bass"])
        # arpeggio
        if cfg["arp"] > 0 and not (final_hold and idx > 2):
            pattern = [0, 1, 2, 3, 2, 1, 2, 3] if cfg["dens"] == 8 else [0, 2, 1, 3]
            step = BAR / len(pattern)
            tones = [m + 12 for m in notes]
            if final_hold:  # one last rising arpeggio into the tonic
                pattern, step, tones = [0, 1, 2, 3, 4, 5], BEAT / 2, [60, 64, 67, 72, 76, 79]
            for k, p in enumerate(pattern):
                if k * step > blen - 0.05 and not final_hold:
                    break
                vel = 0.8 if k % 2 == 0 else 0.6
                if final_hold:
                    vel = 0.9
                y = pluck(hz(tones[p % len(tones)]), dur=2.2 if final_hold else 1.6)
                add(arp, y * 0.06 * vel, start + int(k * step * SR), pan=(-0.35 if k % 2 else 0.35), gain=cfg["arp"])
        # percussion
        if cfg["kick"] > 0:
            for beat in (0, 2):
                if beat * BEAT > blen - 0.05:
                    continue
                n = int(0.35 * SR)
                t = np.arange(n) / SR
                ph = 2 * np.pi * np.cumsum(46 + 70 * np.exp(-t / 0.035)) / SR
                y = np.sin(ph) * np.exp(-t / 0.13)
                add(perc, y * 0.2, start + int(beat * BEAT * SR), gain=cfg["kick"])
        if cfg["hat"] > 0:
            for k in range(8):
                if k * BAR / 8 > blen - 0.02:
                    break
                n = int(0.08 * SR)
                t = np.arange(n) / SR
                y = highpass(RNG.standard_normal(n), 6500) * np.exp(-t / (0.018 if k % 2 == 0 else 0.03))
                add(perc, y * (0.035 if k % 2 else 0.02), start + int((k * BAR / 8) * SR), pan=0.25, gain=cfg["hat"])

    pad = lowpass(pad, 1500)
    wet = signal.oaconvolve(pad * 0.6 + arp, reverb_ir(), axes=0)[:n_total]
    music = pad + arp + low + perc + wet * 0.45
    # gentle fade-in at the start and fade-out at the end
    t = np.arange(n_total) / SR
    fade = np.minimum(1, t / 3.0) * np.clip((total - t) / 3.5, 0, 1)
    return music * fade[:, None]


# ---------------------------------------------------------------- sfx
def sfx(name):
    def T(d):
        return np.arange(int(d * SR)) / SR

    if name == "whoosh":
        t = T(0.9)
        x = RNG.standard_normal(len(t))
        out = np.zeros(len(t))
        # sweep a band-pass upward in short blocks
        for i, (lo, hi) in enumerate(zip(np.geomspace(300, 2500, 12), np.geomspace(900, 7000, 12))):
            a, b = i * len(t) // 12, (i + 1) * len(t) // 12
            out[a:b] = bandpass(x, lo, hi)[a:b]
        e = np.sin(np.pi * np.clip(t / 0.9, 0, 1)) ** 2
        y = out * e * 0.5
        pan = np.linspace(-0.6, 0.6, len(t))
        return np.stack([y * np.cos((pan + 1) * np.pi / 4), y * np.sin((pan + 1) * np.pi / 4)], 1) * 1.4
    if name == "pop":
        t = T(0.12)
        f = 520 + 380 * np.exp(-t / 0.02)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.035) * 0.35
    if name == "tick":
        t = T(0.05)
        return np.sin(2 * np.pi * 2100 * t) * np.exp(-t / 0.008) * 0.25
    if name == "tap":
        t = T(0.08)
        return (np.sin(2 * np.pi * 1150 * t) * np.exp(-t / 0.012) * 0.3 + bandpass(RNG.standard_normal(len(t)), 2000, 6000) * np.exp(-t / 0.004) * 0.3)
    if name == "chime":
        y = np.zeros(int(2.2 * SR))
        for k, m in enumerate([88, 95, 100]):
            p = pluck(hz(m), dur=2.0, bright=0.5)
            s = int(k * 0.07 * SR)
            y[s:s + len(p)] += p[: len(y) - s] * (0.18 - k * 0.03)
        return y
    if name == "ding":
        y = np.zeros(int(1.6 * SR))
        for k, m in enumerate([79, 84]):
            p = pluck(hz(m), dur=1.4, bright=0.4)
            s = int(k * 0.12 * SR)
            y[s:s + len(p)] += p[: len(y) - s] * 0.22
        return y
    if name == "beep":
        t = T(0.16)
        y = (np.sin(2 * np.pi * 1760 * t) + 0.2 * np.sin(2 * np.pi * 3520 * t)) * env_ar(len(t), 0.004, 0.03) * 0.22
        return y
    if name == "alert":
        y = np.zeros(int(1.0 * SR))
        for k, m in enumerate([81, 77]):
            t = T(0.4)
            p = (np.sin(2 * np.pi * hz(m) * t) + 0.3 * np.sin(2 * np.pi * hz(m) * 3 * t)) * np.exp(-t / 0.18) * 0.2
            s = int(k * 0.2 * SR)
            y[s:s + len(p)] += p
        return y
    if name == "shimmer":
        y = np.zeros(int(1.8 * SR))
        for k in range(26):
            f = hz(RNG.choice([84, 88, 91, 96, 100, 103, 108]))
            p = pluck(f, dur=0.9, bright=0.2) * 0.05
            s = int(RNG.uniform(0, 0.8) * SR)
            y[s:s + len(p)] += p[: len(y) - s]
        t = T(1.8)
        y += highpass(RNG.standard_normal(len(t)), 7000) * np.sin(np.pi * np.clip(t / 1.8, 0, 1)) ** 2 * 0.04
        return y
    if name == "impact":
        t = T(1.6)
        y = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-t / 0.08)) / SR) * np.exp(-t / 0.55) * 0.5
        y += lowpass(RNG.standard_normal(len(t)), 900) * np.exp(-t / 0.06) * 0.25
        return y
    if name == "swell":
        t = T(3.0)
        y = bandpass(RNG.standard_normal(len(t)), 800, 6000) * (t / 3.0) ** 2.5 * 0.12
        return y * np.clip((3.0 - t) / 0.3, 0, 1)
    if name == "paper":
        t = T(0.35)
        y = bandpass(RNG.standard_normal(len(t)), 1500, 7000) * np.abs(np.sin(2 * np.pi * 18 * t)) * np.exp(-t / 0.12) * 0.25
        return y
    if name == "stamp":
        t = T(0.2)
        return np.sin(2 * np.pi * np.cumsum(90 + 90 * np.exp(-t / 0.02)) / SR) * np.exp(-t / 0.05) * 0.5 + lowpass(RNG.standard_normal(len(t)), 2500) * np.exp(-t / 0.01) * 0.2
    if name == "resolve":
        y = np.zeros(int(4.0 * SR))
        for k, m in enumerate([72, 76, 79, 84]):
            p = pluck(hz(m), dur=3.5, bright=0.35)
            s = int(k * 0.09 * SR)
            y[s:s + len(p)] += p[: len(y) - s] * 0.12
        return y
    if name == "riser":
        t = T(2.4)
        k = t / 2.4
        noise = RNG.standard_normal(len(t))
        out = np.zeros(len(t))
        for i, (lo, hi) in enumerate(zip(np.geomspace(400, 4000, 16), np.geomspace(1200, 12000, 16))):
            a, b = i * len(t) // 16, (i + 1) * len(t) // 16
            out[a:b] = bandpass(noise, lo, hi)[a:b]
        tone = np.sin(2 * np.pi * np.cumsum(200 + 900 * k ** 2) / SR) * 0.25
        return (out * 0.35 + tone) * k ** 2.2 * np.clip((2.4 - t) / 0.06, 0, 1)
    if name == "flip":
        t = T(0.3)
        y = bandpass(RNG.standard_normal(len(t)), 1500, 6000) * np.sin(np.pi * np.clip(t / 0.22, 0, 1)) * 0.3
        s0 = int(0.2 * SR)
        y[s0:s0 + int(0.03 * SR)] += np.sin(2 * np.pi * 900 * T(0.03)) * np.exp(-T(0.03) / 0.006) * 0.4
        return y
    if name == "snap":
        t = T(0.6)
        y = np.sin(2 * np.pi * 1300 * t) * np.exp(-t / 0.01) * 0.5
        y += highpass(RNG.standard_normal(len(t)), 3000) * np.exp(-t / 0.08) * (RNG.random(len(t)) > 0.85) * 0.6
        y += np.sin(2 * np.pi * np.cumsum(120 + 200 * np.exp(-t / 0.03)) / SR) * np.exp(-t / 0.12) * 0.4
        return y
    if name == "boing":
        t = T(0.35)
        f = 300 + 500 * (1 - np.exp(-t / 0.08))
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.12) * (1 + 0.3 * np.sin(2 * np.pi * 18 * t)) * 0.3
    if name == "thud":
        t = T(0.7)
        y = np.sin(2 * np.pi * np.cumsum(70 + 60 * np.exp(-t / 0.03)) / SR) * np.exp(-t / 0.16) * 0.6
        return y + bandpass(RNG.standard_normal(len(t)), 300, 3000) * np.exp(-t / 0.08) * 0.3
    raise ValueError(name)


SFX_GAIN = {"pop": 0.35, "tick": 0.45, "tap": 0.6, "whoosh": 0.55, "stamp": 0.7, "paper": 0.8, "chime": 0.8, "ding": 0.9,
            "beep": 0.9, "alert": 0.9, "shimmer": 0.9, "impact": 0.8, "swell": 0.9, "resolve": 0.9,
            "riser": 0.8, "flip": 0.8, "snap": 0.9, "boing": 0.7, "thud": 0.8}


def main():
    with open(os.path.join(BUILD, "timeline.json"), encoding="utf-8") as f:
        timeline = json.load(f)
    with open(os.path.join(BUILD, "cues.json"), encoding="utf-8") as f:
        cues = json.load(f)
    total = timeline["duration"]
    n = int(total * SR)

    # narration: each clip resampled 24k -> 48k and levelled to the same RMS
    voice = np.zeros((n, 2))
    for s in timeline["scenes"]:
        for line in s["lines"]:
            a, sr = sf.read(os.path.join(ROOT, line["wav"]))
            a = signal.resample_poly(a, SR, sr)
            rms = np.sqrt(np.mean(a ** 2)) + 1e-9
            a = a * (db(-23) / rms)
            add(voice, a, int(line["start"] * SR))
    voice = np.tanh(voice * 1.2) / 1.2  # soft-limit rare peaks

    print("synthesizing music…")
    music = build_music(timeline, total)
    music *= db(-27) / (np.sqrt(np.mean(music ** 2)) + 1e-9)
    # dramatic pause: the music drops out just before each 'mbreak' cue
    for c in [c for c in cues if c["name"] == "mbreak"]:
        e = np.ones(n)
        a, b = int((c["t"] - 1.4) * SR), int(c["t"] * SR)
        e[a:b] = np.linspace(1, 0.06, b - a)
        music *= e[:, None]
    cues = [c for c in cues if c["name"] != "mbreak"]

    # duck music under the voice
    env = np.abs(voice[:, 0])
    win = int(0.05 * SR)
    env = np.convolve(env, np.ones(win) / win, mode="same")
    act = (env > 0.004).astype(float)
    # smooth: fast attack, slow release
    k_att, k_rel = 1 - np.exp(-1 / (0.08 * SR)), 1 - np.exp(-1 / (0.6 * SR))
    sm = np.empty_like(act)
    acc = 0.0
    for i in range(0, len(act), 64):  # block-wise one-pole to keep this fast
        target = act[i:i + 64].max()
        k = k_att if target > acc else k_rel
        acc += (target - acc) * (1 - (1 - k) ** 64)
        sm[i:i + 64] = acc
    duck = 1 - 0.45 * sm
    music *= duck[:, None]

    print("placing", len(cues), "sfx…")
    fx = np.zeros((n, 2))
    cache = {}
    for c in cues:
        if c["name"] not in cache:
            cache[c["name"]] = sfx(c["name"])
        add(fx, cache[c["name"]], int(c["t"] * SR), gain=c.get("gain", 1) * SFX_GAIN.get(c["name"], 0.6))
    fx *= db(-6)

    mix = voice + music + fx
    # master: normalize to -16 LUFS (online video), then a look-ahead peak
    # limiter holds true peaks under -1.5 dBFS
    loud = pyln.Meter(SR).integrated_loudness(mix)
    mix *= db(-16 - loud)
    ceiling = db(-1.5)
    peak = maximum_filter1d(np.abs(mix).max(axis=1), size=int(0.006 * SR))
    g = np.minimum(1.0, ceiling / (peak + 1e-9))
    g = signal.lfilter([1 - np.exp(-1 / (0.08 * SR))], [1, -np.exp(-1 / (0.08 * SR))], 1 - g)
    g = 1 - np.maximum(g, 1 - np.minimum(1.0, ceiling / (peak + 1e-9)))
    mix = np.clip(mix * g[:, None], -ceiling, ceiling)
    print(f"loudness before {loud:.1f} LUFS -> after {pyln.Meter(SR).integrated_loudness(mix):.1f} LUFS")
    os.makedirs(os.path.join(BUILD, "stems"), exist_ok=True)
    sf.write(os.path.join(BUILD, "mix.wav"), mix.astype(np.float32), SR, subtype="PCM_16")
    sf.write(os.path.join(BUILD, "stems", "narration.wav"), voice.astype(np.float32), SR, subtype="PCM_16")
    sf.write(os.path.join(BUILD, "stems", "music.wav"), (music / max(1, np.abs(music).max() / 0.9)).astype(np.float32), SR, subtype="PCM_16")
    sf.write(os.path.join(BUILD, "stems", "sfx.wav"), fx.astype(np.float32), SR, subtype="PCM_16")
    rms = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
    print(f"mix peak {20 * np.log10(np.abs(mix).max()):.1f} dBFS; rms voice {rms(voice):.1f}, music {rms(music):.1f}, fx {rms(fx):.1f}, total {rms(mix):.1f}")


if __name__ == "__main__":
    main()
