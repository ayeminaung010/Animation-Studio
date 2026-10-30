#!/usr/bin/env python3
"""Synthesize the episode's music bed and every sound effect in code (original, royalty-free).

usage: python3 tools/make_audio.py <slug>
writes public/audio/sfx/*.wav, public/audio/music/<slug>.wav, public/audio/LICENSES.md

Music sections follow the story, timed from 03-shots.json + 04-words.json:
  A warm & bouncy (HOOK..ESC-2) → B minor & sparse (ESC-3, WARNING) → C tension (TWIST setup)
  → silence 0.5 s before the reveal line → D music-box reprise under the BUTTON.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

SR = 44100
ROOT = Path(__file__).resolve().parent.parent
rng = np.random.default_rng(7)  # seeded: the same files every run


# ---------- building blocks ----------
def secs(d):
    return np.arange(int(d * SR)) / SR


def noise(d, seed=None):
    g = np.random.default_rng(seed) if seed is not None else rng
    return g.standard_normal(int(d * SR))


def filt(x, kind, f):
    sos = butter(4, f, btype=kind, fs=SR, output="sos")
    return sosfilt(sos, x)


def bp(x, lo, hi):
    return filt(x, "bandpass", [lo, hi])


def decay(d, tau, attack=0.002):
    t = secs(d)
    return np.minimum(1, t / max(attack, 1e-6)) * np.exp(-t / tau)


def place(out, x, at):
    i = int(at * SR)
    if i >= len(out):
        return
    n = min(len(x), len(out) - i)
    out[i : i + n] += x[:n]


def reverb(x, size=1.2, mix=0.25, seed=3):
    t = secs(size)
    ir = noise(size, seed) * np.exp(-t * 6 / size)
    ir = filt(ir, "lowpass", 6000)
    wet = fftconvolve(x, ir)[: len(x) + len(ir)]
    wet /= np.max(np.abs(wet)) + 1e-9
    dry = np.concatenate([x, np.zeros(len(wet) - len(x))])
    peak = np.max(np.abs(dry)) + 1e-9
    return dry + wet * peak * mix * 2


def bell(f, d, partials=((1, 1), (2.76, 0.5), (5.4, 0.25), (8.93, 0.12)), tau=0.5):
    t = secs(d)
    y = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / (tau / (1 + 0.6 * i))) for i, (r, a) in enumerate(partials))
    return y * np.minimum(1, t / 0.002)


def pluck(f, d, bright=1.0):
    t = secs(d)
    y = sum((1 / n) * np.sin(2 * np.pi * f * n * t) * np.exp(-t * (3 + n * 2.5 / bright)) for n in range(1, 9))
    return y * np.minimum(1, t / 0.003)


def sine_glide(f0, f1, d, tau):
    t = secs(d)
    f = f0 + (f1 - f0) * (1 - np.exp(-t / (d / 4)))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / tau)


def saw(f, d, n=12):
    t = secs(d)
    return sum(np.sin(2 * np.pi * f * k * t) / k for k in range(1, n + 1))


def fade(x, a=0.005, b=0.02):
    n = len(x)
    ia, ib = int(a * SR), int(b * SR)
    if ia:
        x[:ia] *= np.linspace(0, 1, ia)
    if ib:
        x[n - ib :] *= np.linspace(1, 0, ib)
    return x


def peak_norm(x, db=-1.0):
    return x / (np.max(np.abs(x)) + 1e-9) * 10 ** (db / 20)


def rms_norm(x, db):
    return x / (np.sqrt(np.mean(x**2)) + 1e-9) * 10 ** (db / 20)


def write(path, x):
    path.parent.mkdir(parents=True, exist_ok=True)
    x = np.clip(x, -1, 1)
    wavfile.write(path, SR, (x * 32767).astype(np.int16))


# ---------- sound effects ----------
def cash_register_ding():
    out = np.zeros(int(1.6 * SR))
    click = bp(noise(0.03), 2000, 7000) * decay(0.03, 0.008)
    drawer = bp(noise(0.14), 300, 1400) * decay(0.14, 0.05) * 0.6
    place(out, click, 0)
    place(out, drawer, 0.015)
    place(out, bell(2093, 1.4) + 0.6 * bell(2637, 1.4, tau=0.4), 0.06)
    return peak_norm(reverb(out, 0.8, 0.15)[: len(out)])


def cash_register_ding_soft():
    out = np.zeros(int(2.4 * SR))
    place(out, bell(1318.5, 2.2, tau=0.9) + 0.4 * bell(1760, 2.2, tau=0.7), 0.0)
    out = fade(out, 0.01, 0.2)
    return peak_norm(reverb(out, 1.6, 0.35)[: len(out)])


def town_ambience():
    d = 4.0
    out = filt(noise(d, 11), "lowpass", 700) * 0.25
    g = np.random.default_rng(12)
    for at in g.uniform(0.2, d - 0.3, 7):
        f = g.uniform(3000, 4800)
        ch = sine_glide(f, f * 1.25, 0.09, 0.05) * 0.5
        place(out, ch, at)
        place(out, ch * 0.7, at + 0.12)
    return rms_norm(fade(out, 0.3, 0.4), -24)


def dish_whirr():
    d = 2.8
    t = secs(d)
    x = saw(110 + 6 * np.sin(2 * np.pi * 0.7 * 0), d) * (0.7 + 0.3 * np.sin(2 * np.pi * 3 * t))
    x = filt(x, "lowpass", 1200) + 0.3 * np.sin(2 * np.pi * 220 * t)
    return rms_norm(fade(x, 0.3, 0.4), -22)


def cart_bump():
    d = 0.7
    t = secs(d)
    thump = sine_glide(80, 45, d, 0.12)
    clank = bp(noise(d), 600, 2600) * decay(d, 0.07)
    ring = sum(np.sin(2 * np.pi * f * t) * np.exp(-t / tau) for f, tau in ((940, 0.2), (1780, 0.14), (2650, 0.1)))
    return peak_norm(thump * 0.9 + clank + ring * 0.25)


def candle_fizzle():
    d = 0.9
    x = filt(noise(d), "highpass", 2500) * decay(d, 0.25, attack=0.02)
    g = np.random.default_rng(5)
    for at in g.uniform(0, 0.5, 6):
        place(x, filt(noise(0.01), "highpass", 3000) * decay(0.01, 0.003) * 2, at)
    return peak_norm(x)


def phone_buzz():
    out = np.zeros(int(1.0 * SR))
    for k in range(2):
        t = secs(0.22)
        b = np.sign(np.sin(2 * np.pi * 150 * t)) * (0.6 + 0.4 * np.sin(2 * np.pi * 30 * t))
        place(out, fade(filt(b, "lowpass", 900), 0.01, 0.03), k * 0.4)
    return peak_norm(out)


def paper_flip(d=0.07, seed=None):
    return bp(noise(d, seed), 1500, 7000) * decay(d, 0.02, attack=0.005)


def calendar_flip():
    out = np.zeros(int(2.0 * SR))
    for k in range(13):
        place(out, paper_flip(seed=100 + k), k * 0.13)
    return peak_norm(out)


def hollow_clink():
    d = 0.4
    t = secs(d)
    y = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t / tau) for f, a, tau in ((1180, 1, 0.12), (2950, 0.5, 0.08), (4400, 0.25, 0.05)))
    return peak_norm(y + bp(noise(d), 2000, 6000) * decay(d, 0.01) * 0.3)


def gut_thud():
    d = 0.6
    return peak_norm(sine_glide(95, 38, d, 0.22) + filt(noise(d), "lowpass", 300) * decay(d, 0.06) * 0.6)


def whoosh():
    d = 0.6
    t = secs(d)
    shape = np.sin(np.pi * t / d) ** 2
    lo = bp(noise(d), 200, 800) * shape
    hi = bp(noise(d), 900, 3500) * np.sin(np.pi * t / d) ** 6
    return peak_norm(lo * 0.6 + hi)


def coins_cascade():
    d = 1.8
    out = np.zeros(int(d * SR))
    g = np.random.default_rng(21)
    for at in np.sort(g.uniform(0, 1.1, 46) ** 1.3):
        f = g.uniform(2400, 5200)
        place(out, (bell(f, 0.25, ((1, 1), (2.4, 0.4)), tau=g.uniform(0.05, 0.15))) * g.uniform(0.4, 1), at)
    return peak_norm(out)


def door_creak():
    d = 1.2
    g = np.random.default_rng(9)
    walk = np.cumsum(g.standard_normal(int(d * SR))) / 400
    walk = filt(walk, "lowpass", 6)
    f = 70 + 35 * (walk - walk.min()) / (np.ptp(walk) + 1e-9)
    phase = np.cumsum(f) / SR
    pulses = (np.diff(np.floor(phase), prepend=0) > 0).astype(float)
    x = bp(pulses, 500, 2200) * (0.6 + 0.4 * np.sin(np.linspace(0, 3 * np.pi, len(pulses))))
    return peak_norm(fade(x, 0.05, 0.1))


def clock_tick():
    d = 4.0
    out = np.zeros(int(d * SR))
    for k in range(8):
        f = 4200 if k % 2 == 0 else 2700
        t = secs(0.03)
        tick = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.006) + bp(noise(0.03), 2000, 8000) * decay(0.03, 0.003)
        place(out, tick, k * 0.5)
    return peak_norm(out)


def plate_clatter():
    d = 0.9
    out = np.zeros(int(d * SR))
    g = np.random.default_rng(31)
    for at in np.sort(g.uniform(0, 0.35, 6)):
        place(out, hollow_clink() * g.uniform(0.4, 1) * 0.6, at)
    place(out, bp(noise(0.5), 800, 4000) * decay(0.5, 0.12) * 0.4, 0)
    return peak_norm(out)


def wedding_bells_distant():
    d = 3.4
    out = np.zeros(int(d * SR))
    church = ((0.5, 0.6), (1, 1), (1.2, 0.5), (1.5, 0.35), (2, 0.4), (2.5, 0.2), (3, 0.15))
    for k, f in enumerate((392, 330, 392, 294)):
        place(out, bell(f, 2.4, church, tau=1.1) * (1 if k % 2 == 0 else 0.8), k * 0.75)
    out = filt(out, "lowpass", 2200)
    return peak_norm(reverb(out, 2.0, 0.45)[: len(out)] * np.linspace(1, 0.4, len(out)))


def tv_crowd_cheer():
    d = 2.4
    t = secs(d)
    body = bp(noise(d), 300, 3500) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.9 * t + 1)) * np.minimum(1, t / 0.15)
    out = body
    g = np.random.default_rng(41)
    for at in g.uniform(0, 1.6, 14):
        f = g.uniform(280, 650)
        place(out, sine_glide(f, f * 1.4, 0.5, 0.25) * 0.15, at)
    return rms_norm(fade(out, 0.02, 0.5), -27)  # a crowd on a TV in the next room, not a stadium


def glass_crack():
    d = 0.7
    out = filt(noise(0.02), "highpass", 3000) * decay(0.02, 0.006) * 2
    out = np.concatenate([out, np.zeros(int(d * SR) - len(out))])
    g = np.random.default_rng(51)
    for at in np.sort(g.exponential(0.12, 40)):
        if at < d - 0.05:
            place(out, filt(noise(0.006), "highpass", 2000) * g.uniform(0.2, 0.9), at)
    for at in g.uniform(0.05, 0.4, 5):
        place(out, bell(g.uniform(4000, 7000), 0.2, ((1, 1),), tau=0.05) * 0.3, at)
    return peak_norm(out)


def soft_chime():
    out = np.zeros(int(2.0 * SR))
    place(out, bell(1046.5, 1.8, tau=0.7), 0)
    place(out, bell(1568, 1.6, tau=0.6) * 0.6, 0.12)
    out = fade(out, 0.008, 0.3)
    return peak_norm(reverb(out, 1.4, 0.3)[: len(out)])


def soft_pat():
    out = np.zeros(int(0.6 * SR))
    for at in (0, 0.22):
        place(out, filt(noise(0.08), "lowpass", 380) * decay(0.08, 0.025), at)
    return peak_norm(out)


def room_tone():
    d = 4.0
    brown = np.cumsum(noise(d, 61))
    brown = filt(filt(brown, "highpass", 25), "lowpass", 450)
    return rms_norm(fade(brown, 0.3, 0.3), -30)


def ceramic_crack():
    d = 0.9
    out = bp(noise(0.25), 900, 5000) * decay(0.25, 0.06)
    out = np.concatenate([out, np.zeros(int(d * SR) - len(out))])
    t = secs(d)
    out += 0.3 * (np.sin(2 * np.pi * 1700 * t) * np.exp(-t / 0.15) + np.sin(2 * np.pi * 3400 * t) * np.exp(-t / 0.08))
    place(out, sine_glide(120, 60, 0.3, 0.08) * 0.8, 0)
    return peak_norm(out)


def paper_avalanche():
    d = 2.9
    out = np.zeros(int(d * SR))
    g = np.random.default_rng(71)
    for at in np.sort(g.uniform(0, 2.4, 170)):
        dur = g.uniform(0.02, 0.07)
        place(out, paper_flip(dur, seed=int(at * 1e4)) * g.uniform(0.3, 1), at)
    t = secs(d)
    out *= np.minimum(1, t / 0.15) * np.where(t > 1.6, np.exp(-(t - 1.6) / 0.5), 1)
    return peak_norm(out)


def sting_low():
    d = 3.8
    t = secs(d)
    sub = np.sin(2 * np.pi * 55 * t) * np.exp(-t / 1.6)
    cluster = sum(sum((1 / n) * np.sin(2 * np.pi * f * n * t) * np.exp(-t * (0.7 + n * 0.6)) for n in range(1, 6)) for f in (55, 110, 130.81, 164.81))
    hit = filt(noise(d), "lowpass", 900) * decay(d, 0.09)
    out = sub * 0.8 + cluster * 0.35 + hit * 0.6
    return peak_norm(reverb(fade(out, 0.002, 0.4), 2.4, 0.3)[: len(out)])


def bite_crunch():
    out = np.zeros(int(0.45 * SR))
    g = np.random.default_rng(31)
    for at in np.sort(g.uniform(0, 0.18, 9)):
        place(out, bp(noise(0.04), 900, 5000) * decay(0.04, 0.008) * g.uniform(0.4, 1), at)
    place(out, filt(noise(0.2), "lowpass", 600) * decay(0.2, 0.05) * 0.5, 0.0)
    return peak_norm(out)


def crowd_murmur():
    d = 3.0
    t = secs(d)
    out = np.zeros(int(d * SR))
    g = np.random.default_rng(41)
    for k in range(6):
        # Each "voice" is band-limited noise with a slow syllable envelope.
        f0 = g.uniform(250, 700)
        env = np.clip(np.sin(2 * np.pi * g.uniform(2.5, 4.5) * t + g.uniform(0, 6)), 0, 1) ** 2
        out += bp(noise(d, 50 + k), f0, f0 * 2.2) * env
    return peak_norm(fade(out, 0.3, 0.6))


def chicken_cluck():
    out = np.zeros(int(1.0 * SR))
    for i, (at, f) in enumerate(((0, 620), (0.16, 680), (0.3, 560), (0.52, 900))):
        d = 0.09 if i < 3 else 0.28
        y = sine_glide(f, f * (0.7 if i < 3 else 1.4), d, d / 2) + 0.5 * bp(noise(d), f, f * 4) * decay(d, d / 3)
        place(out, y, at)
    return peak_norm(out)


def wind():
    d = 4.0
    t = secs(d)
    gust = 0.6 + 0.4 * np.sin(2 * np.pi * 0.35 * t) ** 2
    return peak_norm(fade(bp(noise(d, 61), 250, 1200) * gust, 0.6, 0.8))


def birdsong():
    out = np.zeros(int(3.0 * SR))
    g = np.random.default_rng(71)
    for at in np.sort(g.uniform(0.1, 2.6, 9)):
        f = g.uniform(2600, 4200)
        place(out, sine_glide(f, f * g.uniform(1.15, 1.5), 0.08, 0.04) * g.uniform(0.4, 1), at)
    return peak_norm(fade(out, 0.2, 0.4))


def church_bell():
    d = 3.5
    y = bell(196, d, ((0.5, 0.6), (1, 1), (1.19, 0.5), (1.5, 0.35), (2, 0.4), (2.5, 0.2)), tau=1.6)
    return peak_norm(reverb(fade(y, 0.002, 0.5), 2.2, 0.35)[: int(d * SR)])


def crow_caw():
    out = np.zeros(int(1.4 * SR))
    for at in (0.0, 0.42):
        d = 0.3
        t = secs(d)
        f = 520 - 120 * t / d
        buzz = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR))
        place(out, bp(buzz, 700, 3200) * np.sin(np.pi * t / d) ** 0.6, at)
    return peak_norm(reverb(out, 1.0, 0.2)[: len(out)])


def record_scratch():
    d = 0.5
    t = secs(d)
    f = 300 + 1600 * np.abs(np.sin(2 * np.pi * 2.2 * t))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.4 + bp(noise(d), 1500, 6000) * 0.5
    return peak_norm(fade(y * np.exp(-t / 0.25), 0.002, 0.05))


def snore():
    d = 1.7
    t = secs(d)
    env = np.where(t < 0.75, np.sin(np.pi * t / 0.75) ** 2, 0) + 0.8 * np.where(t >= 0.85, np.sin(np.pi * np.clip(t - 0.85, 0, 0.8) / 0.8) ** 2, 0)
    y = bp(noise(d, 91), 120, 900) * env
    y += 0.35 * np.sin(2 * np.pi * np.cumsum(70 + 12 * np.sin(2 * np.pi * 11 * t)) / SR) * env
    return peak_norm(fade(y, 0.01, 0.1))


def horse_neigh():
    d = 1.1
    t = secs(d)
    f = 450 + 900 * np.sin(np.pi * np.minimum(t / 0.35, 1) * 0.5) - 500 * np.maximum(0, (t - 0.5) / 0.6)
    f = f * (1 + 0.04 * np.sin(2 * np.pi * 28 * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sign(np.sin(ph)) * 0.5 + np.sin(ph)
    return peak_norm(fade(bp(y, 500, 3500) * np.sin(np.pi * t / d) ** 0.7, 0.01, 0.1))


def sword_draw():
    d = 0.9
    t = secs(d)
    scrape = bp(noise(d, 93), 3000, 9000) * np.minimum(1, t / 0.5) * np.where(t < 0.55, 1, np.exp(-(t - 0.55) / 0.05))
    ring = sum(np.sin(2 * np.pi * f * t) * np.exp(-(t - 0.5).clip(0) / 0.25) for f in (2200, 3300, 4400)) * (t > 0.5) * 0.15
    return peak_norm(fade(scrape + ring, 0.01, 0.1))


def door_kick():
    d = 0.8
    thud = sine_glide(140, 50, 0.35, 0.09)
    crack = bp(noise(0.2, 95), 300, 3000) * decay(0.2, 0.05)
    out = np.zeros(int(d * SR))
    place(out, thud * 0.9, 0)
    place(out, crack * 0.8, 0)
    return peak_norm(reverb(out, 0.8, 0.2)[: len(out)])


def ice_thunk():
    d = 0.7
    out = np.zeros(int(d * SR))
    place(out, sine_glide(120, 60, 0.4, 0.1) * 0.8, 0)
    place(out, bell(2600, 0.3, ((1, 1), (2.4, 0.4)), tau=0.06) * 0.35, 0)
    place(out, bp(noise(0.08, 101), 1500, 6000) * decay(0.08, 0.015) * 0.5, 0)
    return peak_norm(reverb(out, 0.6, 0.15)[: len(out)])


def crowd_laugh():
    d = 2.2
    t = secs(d)
    out = np.zeros(int(d * SR))
    g = np.random.default_rng(111)
    for k in range(7):
        # "Ha-ha-ha": pitched bursts with a fast choppy envelope, each voice its own rate and pitch.
        f0 = g.uniform(160, 420)
        rate = g.uniform(4.5, 6.5)
        env = np.clip(np.sin(2 * np.pi * rate * t + g.uniform(0, 6)), 0, 1) ** 3 * np.exp(-t / g.uniform(1.0, 1.8))
        voice = saw(f0, d, 6) * 0.3 + bp(noise(d, 120 + k), f0 * 2, f0 * 5)
        out += filt(voice, "lowpass", 3000) * env
    return peak_norm(fade(out, 0.02, 0.4))


def water_drip():
    d = 0.35
    return peak_norm(fade(sine_glide(700, 1500, d, 0.05) + bell(1900, d, ((1, 1),), tau=0.03) * 0.3, 0.001, 0.05))


def egg_sizzle():
    d = 2.0
    t = secs(d)
    crackle = np.zeros(int(d * SR))
    g = np.random.default_rng(131)
    for at in g.uniform(0, d - 0.02, 160):
        place(crackle, filt(noise(0.004), "highpass", 3000) * g.uniform(0.2, 1), at)
    hiss = bp(noise(d, 132), 3000, 9000) * 0.25
    return peak_norm(fade((crackle + hiss) * np.minimum(1, t / 0.05), 0.01, 0.4))


def hammer_knock():
    d = 1.6
    out = np.zeros(int(d * SR))
    for at in (0, 0.42, 0.84):
        place(out, sine_glide(420, 260, 0.15, 0.04), at)
        place(out, bp(noise(0.05, 141), 800, 4000) * decay(0.05, 0.01), at)
    return peak_norm(reverb(out, 0.7, 0.2)[: len(out)])


def hatch_slam():
    return door_kick()


def coin_drop():
    d = 1.0
    out = np.zeros(int(d * SR))
    for i, at in enumerate((0, 0.12, 0.2, 0.26, 0.3)):
        place(out, bell(3200 + 300 * i, 0.4, ((1, 1), (2.7, 0.4)), tau=0.08) * (1 - 0.15 * i), at)
    return peak_norm(out)


SFX = {
    "cash-register-ding": cash_register_ding,
    "cash-register-ding-soft": cash_register_ding_soft,
    "town-ambience": town_ambience,
    "dish-whirr": dish_whirr,
    "cart-bump": cart_bump,
    "candle-fizzle": candle_fizzle,
    "phone-buzz": phone_buzz,
    "calendar-flip": calendar_flip,
    "hollow-clink": hollow_clink,
    "gut-thud": gut_thud,
    "whoosh": whoosh,
    "coins-cascade": coins_cascade,
    "door-creak": door_creak,
    "clock-tick": clock_tick,
    "plate-clatter": plate_clatter,
    "wedding-bells-distant": wedding_bells_distant,
    "tv-crowd-cheer": tv_crowd_cheer,
    "glass-crack": glass_crack,
    "soft-chime": soft_chime,
    "soft-pat": soft_pat,
    "room-tone": room_tone,
    "ceramic-crack": ceramic_crack,
    "paper-avalanche": paper_avalanche,
    "sting-low": sting_low,
    "bite-crunch": bite_crunch,
    "crowd-murmur": crowd_murmur,
    "chicken-cluck": chicken_cluck,
    "wind": wind,
    "birdsong": birdsong,
    "church-bell": church_bell,
    "crow-caw": crow_caw,
    "record-scratch": record_scratch,
    "snore": snore,
    "horse-neigh": horse_neigh,
    "sword-draw": sword_draw,
    "door-kick": door_kick,
    "ice-thunk": ice_thunk,
    "crowd-laugh": crowd_laugh,
    "water-drip": water_drip,
    "egg-sizzle": egg_sizzle,
    "hammer-knock": hammer_knock,
    "hatch-slam": hatch_slam,
    "coin-drop": coin_drop,
}


# ---------- music ----------
NOTE = {n: 440 * 2 ** ((i - 9) / 12) for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}


def hz(name):
    return NOTE[name[:-1]] * 2 ** (int(name[-1]) - 4)


CHORDS = {
    "C": ["C4", "E4", "G4", "C5"], "Am": ["A3", "C4", "E4", "A4"], "F": ["F3", "A3", "C4", "F4"],
    "G": ["G3", "B3", "D4", "G4"], "Dm": ["D4", "F4", "A4", "D5"], "E": ["E3", "G#3", "B3", "E4"],
}
BASS = {"C": "C2", "Am": "A1", "F": "F1", "G": "G1", "Dm": "D2", "E": "E2"}


def kick():
    return sine_glide(110, 45, 0.3, 0.09)


def shaker():
    return filt(noise(0.05), "highpass", 6000) * decay(0.05, 0.012)


def pad(chord, d):
    t = secs(d)
    y = sum(saw(hz(n) * det, d, 6) for n in CHORDS[chord] for det in (0.997, 1.003))
    y = filt(y, "lowpass", 900)
    return y * np.minimum(1, t / 0.6) * np.minimum(1, (d - t) / 0.4)


def section_a(d, beat, prog=("C", "Am", "F", "G")):
    out = np.zeros(int(d * SR) + SR)
    pattern = [0, 2, 1, 2, 3, 2, 1, 2]
    bar = 4 * beat
    k = 0
    while k * bar < d:
        ch = prog[k % 4]
        notes = CHORDS[ch]
        for i, p in enumerate(pattern):
            at = k * bar + i * beat / 2
            if at < d:
                place(out, pluck(hz(notes[p]), 0.5) * (0.55 if i % 2 else 0.8), at)
        for b in (0, 2):
            at = k * bar + b * beat
            if at < d:
                place(out, pluck(hz(BASS[ch]), 0.9, bright=0.5) * 0.9, at)
                place(out, kick() * 0.5, at)
        for i in range(8):
            at = k * bar + i * beat / 2 + beat / 4
            if at < d:
                place(out, shaker() * 0.25, at)
        k += 1
    return out[: int(d * SR)]


def section_b(d, beat):
    out = np.zeros(int(d * SR) + 2 * SR)
    prog = ["Am", "F", "Dm", "E"]
    bar = 4 * beat
    k = 0
    while k * bar < d:
        ch = prog[k % 4]
        place(out, pad(ch, bar) * 0.18, k * bar)
        for b in range(4):
            at = k * bar + b * beat
            if at < d:
                place(out, pluck(hz(CHORDS[ch][b % 3]) / 2, 0.8, bright=0.7) * 0.6, at)
        place(out, pluck(hz(BASS[ch]), 1.6, bright=0.4) * 0.8, k * bar)
        k += 1
    return out[: int(d * SR)]


def section_c(d, beat):
    n = int(d * SR)
    t = secs(d)
    drone = np.sin(2 * np.pi * 55 * t) * 0.6 + filt(saw(110, d, 8), "lowpass", 400) * 0.25
    out = drone * np.minimum(1, t / 0.5)
    for k in range(int(d / (2 * beat)) + 1):
        place(out, kick() * 0.7, k * 2 * beat)
        place(out, kick() * 0.45, k * 2 * beat + 0.22)
    riser = bp(noise(d, 81), 500, 4000) * (t / d) ** 2 * 0.5
    out = out + riser
    return fade(out[:n], 0.01, 0.012)


def section_d(d):
    out = np.zeros(int(d * SR) + 2 * SR)
    box = ((1, 1), (3.0, 0.3), (5.1, 0.12))
    for i, (note, at) in enumerate((("E5", 0), ("C5", 0.55), ("A4", 1.1), ("B4", 1.75))):
        if at < d:
            place(out, bell(hz(note), 1.6, box, tau=0.6) * (0.8 - i * 0.1), at)
    place(out, pad("Am", min(d, 3.0)) * 0.08, 0)
    out = reverb(out, 1.8, 0.4)[: int(d * SR)]
    t = secs(d)
    return out * np.minimum(1, (d - t) / 0.6)


def shot_starts(slug):
    shots = json.loads((ROOT / f"episodes/{slug}/03-shots.json").read_text())["shots"]
    words = json.loads((ROOT / f"episodes/{slug}/04-words.json").read_text())
    i, starts = 0, {}
    for s in shots:
        starts[s["id"]] = 0 if not starts else round(words[i]["startMs"] / 1000 * 30) / 30
        i += len([w for w in s["text"].split() if w and w not in ("—", "–", "-")])
    total = round((words[-1]["endMs"] + 500) / 1000 * 30) / 30
    return shots, starts, total


def first_shot(shots, starts, beats):
    return min(starts[s["id"]] for s in shots if s["beat"] in beats)


def music(slug):
    shots, starts, total = shot_starts(slug)
    beat = 0.6  # 100 bpm
    b_start = first_shot(shots, starts, {"ESC-3"})
    c_start = first_shot(shots, starts, {"TWIST"})
    # The reveal line is the twist shot with the dolly-zoom, falling back to the last TWIST shot.
    twist = [s for s in shots if s["beat"] == "TWIST"]
    reveal = next((s for s in twist if s["camera"]["move"] == "dolly-zoom"), twist[-1])
    cut = starts[reveal["id"]] - 0.5
    d_start = first_shot(shots, starts, {"BUTTON"})
    out = np.zeros(int(total * SR))
    # "music_mood": "dark" in 03-shots.json plays section A in A minor (folk-tale creepy, not bouncy).
    dark = json.loads((ROOT / f"episodes/{slug}/03-shots.json").read_text()).get("music_mood") == "dark"
    a = section_a(b_start + 0.4, beat, ("Am", "Dm", "Am", "E") if dark else ("C", "Am", "F", "G"))
    a[-int(0.4 * SR) :] *= np.linspace(1, 0, int(0.4 * SR))
    place(out, a, 0)
    b = section_b(c_start - b_start + 0.3, beat)
    b[: int(0.2 * SR)] *= np.linspace(0, 1, int(0.2 * SR))
    b[-int(0.3 * SR) :] *= np.linspace(1, 0, int(0.3 * SR))
    place(out, b, b_start)
    if cut > c_start + 0.5:  # reveal is the first TWIST shot: no tension section, just the silence
        place(out, section_c(cut - c_start, beat), c_start)
    place(out, section_d(total - d_start), d_start)
    out[int(cut * SR) : int(d_start * SR)] = 0  # hard silence before the reveal
    return out, {"b": b_start, "c": c_start, "cut": cut, "d": d_start, "total": total, "reveal": reveal["id"]}


def loudnorm(path, target=-16.0):
    """Two-pass linear loudness normalisation with ffmpeg (keeps dynamics, no limiter pumping)."""
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", f"loudnorm=I={target}:TP=-1.5:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True)
    # Last {...} block: some ffmpeg builds print more lines after the loudnorm report.
    m = json.loads(re.findall(r"\{[^{}]*\}", r.stderr)[-1])
    gain = target - float(m["input_i"])
    sr, x = wavfile.read(path)
    y = x.astype(np.float64) / 32767 * 10 ** (gain / 20)
    y = y / max(1, np.max(np.abs(y)) / 10 ** (-1.5 / 20))
    write(path, y)
    return float(m["input_i"]), gain


def main():
    slug = sys.argv[1]
    sfx_dir = ROOT / "public/audio/sfx"
    for name, fn in SFX.items():
        x = fn()
        write(sfx_dir / f"{name}.wav", x)
        print(f"sfx  {name:26s} {len(x) / SR:4.1f}s")
    m, cues = music(slug)
    mpath = ROOT / f"public/audio/music/{slug}.wav"
    write(mpath, peak_norm(m, -3))
    before, gain = loudnorm(mpath)
    print(f"music {mpath.name}: {cues}  loudness {before:.1f} → -16 LUFS ({gain:+.1f} dB)")
    (ROOT / "public/audio/LICENSES.md").write_text(
        "# Audio licences\n\n"
        "Every file in `public/audio/` (music in `music/`, effects in `sfx/`) was synthesized from code by\n"
        "`tools/make_audio.py` in this repository. No samples, loops or third-party recordings are used,\n"
        "so there is nothing to license from anyone else. The channel owner may use, modify and publish\n"
        "them anywhere, including monetized videos.\n\n"
        "The voiceover (`public/episodes/*/voice.mp3`) was generated with Speko (OpenAI gpt-4o-mini-tts,\n"
        "voice Echo); check your Speko/OpenAI terms for commercial use of TTS output.\n"
    )


if __name__ == "__main__":
    main()
