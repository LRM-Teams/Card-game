#!/usr/bin/env python3
"""LRM-527: Narrative Pixel teahouse SFX (procedural, no competitor samples)."""
from __future__ import annotations

import json
import math
import struct
import subprocess
import wave
from pathlib import Path

SAMPLE_RATE = 44100
ROOT = Path(__file__).resolve().parents[3]
DOCS = Path(__file__).resolve().parent
PUBLIC = ROOT / "apps/client/public/narrative-pixel/audio"
DOCS_OUT = DOCS / "audio"


def synth(samples: list[float]) -> bytes:
    return b"".join(
        struct.pack("<h", max(-32767, min(32767, int(s * 32767)))) for s in samples
    )


def envelope(t: float, attack: float, release: float, duration: float) -> float:
    if t < attack:
        return t / attack if attack else 1.0
    if t > duration - release:
        return max(0.0, (duration - t) / release) if release else 0.0
    return 1.0


def tone(freq: float, duration: float, *, attack=0.01, release=0.05, amp=0.35) -> list[float]:
    n = int(duration * SAMPLE_RATE)
    return [
        math.sin(2 * math.pi * freq * (i / SAMPLE_RATE))
        * amp
        * envelope(i / SAMPLE_RATE, attack, release, duration)
        for i in range(n)
    ]


def noise_burst(duration: float, *, amp=0.2, seed=0) -> list[float]:
    n = int(duration * SAMPLE_RATE)
    out, x = [], seed or 1
    for i in range(n):
        t = i / SAMPLE_RATE
        x = (1103515245 * x + 12345) & 0x7FFFFFFF
        out.append(((x / 0x7FFFFFFF) * 2 - 1) * amp * envelope(t, 0.002, duration * 0.5, duration))
    return out


def mix(*tracks: list[float]) -> list[float]:
    length = max((len(t) for t in tracks), default=0)
    out = [0.0] * length
    for tr in tracks:
        for i, v in enumerate(tr):
            out[i] += v
    peak = max((abs(v) for v in out), default=1.0)
    if peak > 0.98:
        out = [v * 0.98 / peak for v in out]
    return out


def write_wav(path: Path, samples: list[float]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(synth(samples))


def transcode(wav: Path, out: Path, codec: str) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    args = ["ffmpeg", "-y", "-i", str(wav)]
    if codec == "ogg":
        args += ["-c:a", "libvorbis", "-q:a", "5"]
    else:
        args += ["-c:a", "libmp3lame", "-q:a", "4"]
    subprocess.run([*args, str(out)], check=True, capture_output=True)


BUILDERS = {
    "bid": lambda: mix(tone(196, 0.12, amp=0.28), tone(294, 0.18, amp=0.2)),  # 叫分
    "play": lambda: mix(tone(440, 0.08, amp=0.2), tone(660, 0.12, amp=0.14), noise_burst(0.14, amp=0.05)),
    "bomb": lambda: mix(tone(98, 0.28, amp=0.42), tone(180, 0.2, amp=0.22), noise_burst(0.32, amp=0.26)),
    "spring": lambda: mix(tone(523, 0.2, amp=0.24), tone(784, 0.3, amp=0.2), tone(1047, 0.5, amp=0.16)),
    "win": lambda: mix(tone(392, 0.14, amp=0.26), tone(494, 0.18, amp=0.22), tone(587, 0.35, amp=0.18)),
    "lose": lambda: mix(tone(330, 0.18, amp=0.22), tone(262, 0.22, amp=0.18)),
}


def main() -> None:
    tmp = DOCS / "_tmp_wav"
    tmp.mkdir(exist_ok=True)
    manifest: dict = {"version": "v1", "issue": "LRM-527", "clips": {}}
    for name, builder in BUILDERS.items():
        samples = builder()
        dur = round(len(samples) / SAMPLE_RATE, 2)
        wav = tmp / f"{name}.wav"
        write_wav(wav, samples)
        entry = {"duration_s": dur, "formats": ["ogg", "mp3"]}
        for base in (PUBLIC, DOCS_OUT):
            transcode(wav, base / f"{name}.ogg", "ogg")
            transcode(wav, base / f"{name}.mp3", "mp3")
        manifest["clips"][name] = {**entry, "path": f"narrative-pixel/audio/{name}"}
        print(f"ok {name} ({dur}s)")
    (DOCS / "audio-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    for f in tmp.glob("*.wav"):
        f.unlink()
    tmp.rmdir()
    print("[OK] ->", PUBLIC)


if __name__ == "__main__":
    main()
