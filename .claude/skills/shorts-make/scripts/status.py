# /// script
# requires-python = ">=3.10"
# ///
"""쇼츠 한 편이 어디까지 만들어졌는지와 준비물이 갖춰졌는지 본다(아무것도 바꾸지 않는다).

  uv run status.py                 # 준비물만
  uv run status.py <에피소드 폴더>   # 준비물 + 그 편의 단계별 진행

다음에 할 단계를 마지막 줄에 「다음: N단계」로 적는다. 키 값은 찍지 않고 있는지만 본다.
"""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[4]
KEYS = [("ELEVENLABS_API_KEY", "2 나레이션"), ("ELEVENLABS_VOICE_ID", "2 나레이션"), ("GROQ_API_KEY", "3 문장 시각")]


def env_keys() -> dict[str, bool]:
    f = ROOT / ".env"
    have = {}
    if f.exists():
        for line in f.read_text(encoding="utf-8").splitlines():
            k, _, v = line.strip().partition("=")
            have[k.removeprefix("export ").strip()] = bool(v.strip().strip("'\""))
    return have


def ready() -> bool:
    ok = True
    print("[준비물]")
    for tool in ("uv", "ffmpeg", "ffprobe", "node", "npx"):
        found = shutil.which(tool) is not None
        ok &= found
        print(f"  {'✓' if found else '✗'} {tool}")
    studio = (ROOT / "remotion" / "node_modules").exists() and (ROOT / "remotion" / "src" / "episode" / "Episode.tsx").exists()
    ok &= studio
    print(f"  {'✓' if studio else '✗'} Remotion 작업실 reelmill/remotion")
    have = env_keys()
    for k, step in KEYS:
        print(f"  {'✓' if have.get(k) else '✗'} .env {k} ({step})")
        ok &= bool(have.get(k))
    return ok


def progress(ep: Path) -> int:
    """다음에 할 단계 번호(1~6), 다 됐으면 7."""
    d = ep / "drafts" / "drafts.json"
    chosen = json.loads(d.read_text(encoding="utf-8")).get("chosen") if d.exists() else None
    sj = ep / "sentences.json"
    timing_ok = False
    if sj.exists() and (ep / "narration.mp3").exists():
        import hashlib
        h = hashlib.sha256((ep / "narration.mp3").read_bytes()).hexdigest()[:16]
        timing_ok = json.loads(sj.read_text(encoding="utf-8")).get("audio_hash") == h
    md = ep / "script.md"
    steps = [
        ("1 대본", md.exists() and "## 대본" in md.read_text(encoding="utf-8") and "## 제목 3안" in md.read_text(encoding="utf-8")),
        ("2 나레이션", (ep / "narration.mp3").exists()),
        ("3 문장 시각", timing_ok),
        ("4 스타일 시안", bool(chosen)),
        ("5 조립·렌더", (ep / "video.mp4").exists()),
        ("6 업로드 문구", (ep / "upload.md").exists()),
    ]
    print(f"[진행] {ep.name}")
    nxt = 7
    for i, (name, done) in enumerate(steps, 1):
        print(f"  {'✓' if done else '·'} {name}")
        if not done and nxt == 7:
            nxt = i
    if (ep / "video.mp4").exists() and nxt < 5:
        print("  ⚠️ 앞 단계가 바뀌어 영상이 지금 결과물과 맞지 않을 수 있습니다")
    return nxt


def main() -> None:
    ok = ready()
    if len(sys.argv) > 1:
        n = progress(Path(sys.argv[1]).resolve())
        print("다음: 완성" if n == 7 else f"다음: {n}단계")
    if not ok:
        print("준비물이 모자랍니다(✗)")


if __name__ == "__main__":
    main()
