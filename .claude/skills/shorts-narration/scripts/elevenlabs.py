# /// script
# requires-python = ">=3.10"
# dependencies = ["requests"]
# ///
"""대본(script.md 의 「## 대본」 원문)을 일레븐랩스 API 로 읽혀 나레이션 mp3 를 받는다.

읽기본으로 바꾸지 않는다 — 일레븐랩스는 숫자·단위를 스스로 읽는다(language_code=ko 로 한국어 읽기를 고정).
읽기본(reading.txt)은 Typecast 용이다.

  uv run elevenlabs.py <에피소드 폴더> --voices              # 내 계정 목소리 목록(이름·ID)
  uv run elevenlabs.py <에피소드 폴더> --check               # 남은 글자·들 글자만 본다(글자 안 씀)
  uv run elevenlabs.py <에피소드 폴더> --generate [--voice ID] [--out narration.mp3]   # 글자 씀

키: reelmill/.env 의 ELEVENLABS_API_KEY (없으면 ~/.config/watch/.env). 화면에 찍지 않는다.
목소리: --voice 로 주거나, reelmill/.env 의 ELEVENLABS_VOICE_ID.
요금: 따로 청구되지 않고 요금제의 남은 글자에서 빠진다(읽기본 글자 수만큼).
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

import requests

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[4]          # reelmill
API = "https://api.elevenlabs.io"
MODEL = "eleven_v4"                                 # 가장 최신·최고 품질 모델(2026-10 기준). 속도 조절 없음 = 기본 1.0
SETTINGS = {"stability": 0.5, "similarity_boost": 0.75, "speed": 1.0}   # 목소리에 저장된 속도(1.15)를 쓰지 않는다


def env(name: str) -> str:
    for f in (ROOT / ".env", Path.home() / ".config" / "watch" / ".env"):
        if f.exists():
            for line in f.read_text(encoding="utf-8").splitlines():
                k, _, v = line.strip().partition("=")
                v = v.strip().strip("'\"")
                if k.removeprefix("export ").strip() == name and v:
                    return v
    return ""


def for_voice(body: str) -> str:
    """일레븐랩스로 보낼 글. 대본 파일은 그대로 두고 보낼 때만 다듬는다(금메달 시험 2026-10-21).

    - 토막 문장(「그리고 한가운데.」「은은 92.5퍼센트 이상.」처럼 「~다/요」로 끝나지 않는 문장)은
      끝 마침표를 쉼표로 바꿔 다음 문장과 잇는다 — 토막마다 문장 끝 억양이 붙어 뚝뚝 끊기지 않게.
    - 문단이 바뀌는 자리(빈 줄)에 줄표(—)를 넣어 한 박자 더 쉬게 한다. eleven_v4 는 쉼 태그를
      못 쓰고, 문장 끝 쉼이 모두 0.2~0.3초로 같아 생각이 바뀌는 자리에서도 쉬지 않았다.
    """
    paras = []
    for p in body.strip().split("\n\n"):
        sents = re.split(r"(?<=[.?!])\s+", " ".join(p.split()))
        out = []
        for i, x in enumerate(sents):
            if x.endswith(".") and not re.search(r"[다요]\.$", x) and i < len(sents) - 1:
                x = x[:-1] + ","
            out.append(x)
        if out:
            paras.append(" ".join(out))
    return " — ".join(paras)


def headers() -> dict:
    key = env("ELEVENLABS_API_KEY")
    if not key:
        sys.exit("[중단] ELEVENLABS_API_KEY 가 없습니다 — reelmill/.env 에 한 줄로 넣어 주세요.")
    return {"xi-api-key": key}


def left() -> int:
    r = requests.get(f"{API}/v1/user/subscription", headers=headers(), timeout=30)
    r.raise_for_status()
    u = r.json()
    return u.get("character_limit", 0) - u.get("character_count", 0)


def seconds(path: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", str(path)], capture_output=True, text=True)
    return float(r.stdout.strip() or 0)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--voices", action="store_true")
    g.add_argument("--check", action="store_true")
    g.add_argument("--generate", action="store_true")
    ap.add_argument("--voice", default="")
    ap.add_argument("--out", default="narration.mp3")
    a = ap.parse_args()

    if a.voices:
        r = requests.get(f"{API}/v2/voices", params={"page_size": 100}, headers=headers(), timeout=30)
        r.raise_for_status()
        for v in r.json().get("voices", []):
            print(f"{v['voice_id']}  {v['name']}  ({v.get('category', '')})")
        return

    ep = Path(a.episode).resolve()
    md = ep / "script.md"
    if not md.exists():
        sys.exit(f"[중단] {md} 가 없습니다 — 1단계 대본을 먼저 만드세요")
    body = md.read_text(encoding="utf-8").split("## 대본", 1)[1].split("\n## ", 1)[0]
    text = for_voice(body)
    print("[나레이션] 보낼 글:\n" + text)
    need, have = len(text), left()
    print(f"[나레이션] 일레븐랩스 · 들 글자 {need:,} · 남은 글자 {have:,}")
    if a.check:
        return
    if need > have:
        sys.exit("[중단] 남은 글자가 모자랍니다")

    voice = a.voice or env("ELEVENLABS_VOICE_ID")
    if not voice:
        sys.exit("[중단] 목소리가 없습니다 — --voice ID 를 주거나 reelmill/.env 에 ELEVENLABS_VOICE_ID 를 적어 주세요(--voices 로 목록)")
    print(f"[나레이션] 생성 중 … 목소리 {voice} · 모델 {MODEL}", flush=True)
    r = requests.post(f"{API}/v1/text-to-speech/{voice}", params={"output_format": "mp3_44100_128"},
                      headers={**headers(), "Content-Type": "application/json"},
                      json={"text": text, "model_id": MODEL, "language_code": "ko", "voice_settings": SETTINGS}, timeout=600)
    if r.status_code != 200:
        sys.exit(f"[중단] 일레븐랩스 실패 {r.status_code}: {r.text[:300]}")
    out = ep / a.out
    out.write_bytes(r.content)
    print(f"[나레이션] 받았습니다 → {out.name} ({len(r.content)/1e6:.1f} MB) · 실제 길이 {seconds(out):.1f}초 · 남은 글자 {left():,}")


if __name__ == "__main__":
    main()
