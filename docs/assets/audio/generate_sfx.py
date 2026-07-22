#!/usr/bin/env python3
"""LRM-259: regenerate procedural SFX (stdlib + ffmpeg). No competitor audio."""

from __future__ import annotations

import math
import struct
import subprocess
import wave
from pathlib import Path

SAMPLE_RATE = 44100
ROOT = Path(__file__).resolve().parent
OUT_SFX = ROOT / "sfx"
PUBLIC_SFX = ROOT.parents[2] / "apps" / "client" / "public" / "audio" / "sfx"


def synth(samples: list[float]) -> bytes:
    return b"".join(
        struct.pack("<h", max(-32767, min(32767, int(s * 32767))))
        for s in samples
    )


def envelope(t: float, attack: float, release: float, duration: float) -> float:
    if t < 0:
        return 0.0
    if t < attack:
        return t / attack
    if t > duration - release:
        return max(0.0, (duration - t) / release)
    return 1.0


def tone(
    freq: float,
    duration: float,
    *,
    attack: float = 0.01,
    release: float = 0.05,
    amp: float = 0.35,
) -> list[float]:
    n = int(duration * SAMPLE_RATE)
    out: list[float] = []
    for i in range(n):
        t = i / SAMPLE_RATE
        e = envelope(t, attack, release, duration)
        out.append(math.sin(2 * math.pi * freq * t) * amp * e)
    return out


def noise_burst(duration: float, *, amp: float = 0.22, seed: int = 0) -> list[float]:
    n = int(duration * SAMPLE_RATE)
    out: list[float] = []
    x = seed or 1
    for i in range(n):
        t = i / SAMPLE_RATE
        x = (1103515245 * x + 12345) & 0x7FFFFFFF
        nval = ((x / 0x7FFFFFFF) * 2 - 1) * amp
        e = envelope(t, 0.002, duration * 0.55, duration)
        out.append(nval * e)
    return out


def mix(*tracks: list[float]) -> list[float]:
    length = max((len(t) for t in tracks), default=0)
    out = [0.0] * length
    for tr in tracks:
        for i, v in enumerate(tr):
            out[i] += v
    peak = max((abs(v) for v in out), default=1.0)
    if peak > 0.98:
        scale = 0.98 / peak
        out = [v * scale for v in out]
    return out


def write_wav(path: Path, samples: list[float]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(synth(samples))


def to_ogg(wav_path: Path, ogg_path: Path) -> None:
    ogg_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(wav_path),
            "-c:a",
            "libvorbis",
            "-q:a",
            "5",
            str(ogg_path),
        ],
        check=True,
        capture_output=True,
    )


def build_play() -> list[float]:
    # Align play-fly 260ms: short card flick
    return mix(
        tone(880, 0.08, attack=0.004, release=0.04, amp=0.18),
        tone(1320, 0.12, attack=0.006, release=0.06, amp=0.12),
        noise_burst(0.14, amp=0.06, seed=42),
    )


def build_bomb() -> list[float]:
    # Align bomb 420ms
    return mix(
        tone(120, 0.28, attack=0.004, release=0.18, amp=0.45),
        tone(220, 0.18, attack=0.01, release=0.12, amp=0.2),
        noise_burst(0.32, amp=0.28, seed=7),
    )


def build_rocket() -> list[float]:
    # Align rocket 560ms
    return mix(
        tone(90, 0.38, attack=0.004, release=0.22, amp=0.5),
        tone(180, 0.24, attack=0.008, release=0.16, amp=0.25),
        tone(520, 0.16, attack=0.02, release=0.1, amp=0.12),
        noise_burst(0.42, amp=0.32, seed=99),
    )


def build_win() -> list[float]:
    # Align settle-pop 180ms onset
    return mix(
        tone(523, 0.14, attack=0.008, release=0.08, amp=0.28),
        tone(659, 0.16, attack=0.01, release=0.1, amp=0.24),
        tone(784, 0.22, attack=0.012, release=0.14, amp=0.2),
    )


def build_lose() -> list[float]:
    return mix(
        tone(392, 0.18, attack=0.01, release=0.12, amp=0.22),
        tone(311, 0.22, attack=0.012, release=0.16, amp=0.18),
        noise_burst(0.1, amp=0.04, seed=13),
    )


def build_pass() -> list[float]:
    return tone(440, 0.1, attack=0.008, release=0.06, amp=0.16)


def build_button() -> list[float]:
    return mix(
        tone(1200, 0.05, attack=0.002, release=0.03, amp=0.14),
        tone(800, 0.04, attack=0.002, release=0.02, amp=0.1),
    )


BUILDERS = {
    "play": build_play,
    "bomb": build_bomb,
    "rocket": build_rocket,
    "win": build_win,
    "lose": build_lose,
    "pass": build_pass,
    "button": build_button,
}


def main() -> None:
    tmp = ROOT / "_tmp_wav"
    tmp.mkdir(exist_ok=True)
    for name, builder in BUILDERS.items():
        samples = builder()
        wav = tmp / f"{name}.wav"
        write_wav(wav, samples)
        for out_dir in (OUT_SFX, PUBLIC_SFX):
            to_ogg(wav, out_dir / f"{name}.ogg")
        print(f"ok {name}.ogg ({len(samples) / SAMPLE_RATE:.2f}s)")
    for wav in tmp.glob("*.wav"):
        wav.unlink()
    tmp.rmdir()
    print("done ->", OUT_SFX, "and", PUBLIC_SFX)


if __name__ == "__main__":
    main()
