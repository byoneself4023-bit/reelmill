# /// script
# requires-python = ">=3.10"
# ///
"""장면 설계(render/plan.json) + 문장 시각(sentences.json) + 나레이션으로 영상을 조립한다(Remotion).

  uv run make_video.py <에피소드 폴더> --stills    # 장면마다 끝 무렵 정지 화면 → render/check/NN.png (점검용)
  uv run make_video.py <에피소드 폴더> --render    # 영상 → <에피소드>/video.mp4

plan.json 의 "at"·"noteAt"·"swapAt"·"toAt" 은 문장 번호다. 여기서 그 문장이 시작하는 초로 바꾼다
— 요소가 「그 숫자를 말하는 순간」 나타나게. 장면 경계도 장면 첫 문장의 시작 시각이다.
만든 값은 render/props.json 에 남긴다(무엇으로 렌더했는지).
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[4]
STUDIO = ROOT / "remotion"
NPX = "npx.cmd" if sys.platform == "win32" else "npx"
FPS = 30
CUE_CHARS, CUE_WORDS = 13, 4      # 자막 한 덩이: 글자(공백 뺌) · 어절 상한 — 사내 자막 기준값
# 자막에서만 숫자 바로 뒤 단위를 기호로 줄인다(사내 subtitle.py UNIT_SHORT 와 같음). 대본·나레이션은 그대로 —
# 나레이션은 「그램」으로 읽어야 하고, 화면에서는 「18g」이 짧고 잘 읽힌다. 긴 것부터 바꾼다.
UNIT_SHORT = (("제곱미터", "㎡"), ("킬로미터", "km"), ("센티미터", "cm"), ("밀리미터", "mm"),
              ("킬로그램", "kg"), ("퍼센트", "%"), ("미터", "m"), ("그램", "g"))


def short_units(text: str) -> str:
    for word, sym in UNIT_SHORT:
        text = re.sub(rf"(\d)\s?{word}", rf"\1{sym}", text)
    return text


def seconds(path: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                       capture_output=True, text=True)
    return float(r.stdout.strip())


def cues(text: str, t0: float, t1: float) -> list[dict]:
    """문장 하나를 자막 덩이로 나누고 글자 수 비례로 시각을 준다. 문장 끝 마침표·쉼표는 뺀다(숫자 안 점은 둔다)."""
    words = re.sub(r"(?<!\d)[.,?!](?!\d)", "", short_units(text)).split()
    chunks, cur = [], []
    for w in words:
        if cur and (len("".join(cur + [w])) > CUE_CHARS or len(cur) >= CUE_WORDS):
            chunks.append(cur)
            cur = []
        cur.append(w)
    if cur:
        chunks.append(cur)
    total = sum(len("".join(c)) for c in chunks) or 1
    out, at = [], t0
    for c in chunks:
        dur = (t1 - t0) * len("".join(c)) / total
        out.append({"start": round(at, 3), "end": round(at + dur, 3), "text": " ".join(c)})
        at += dur
    return out


def build(ep: Path) -> dict:
    plan = json.loads((ep / "render" / "plan.json").read_text(encoding="utf-8"))
    sj = json.loads((ep / "sentences.json").read_text(encoding="utf-8"))
    sents = sj["sentences"]
    dur = seconds(ep / "narration.mp3")
    start = {s["no"]: s["start"] for s in sents}
    if any(v is None for v in start.values()):
        sys.exit("[중단] 시각을 못 찾은 문장이 있습니다 — 3단계를 다시 확인하세요")

    def sec(n: int) -> float:
        return start[n]

    def conv(o):
        if isinstance(o, dict):
            return {k: (sec(v) if k in ("at", "noteAt", "swapAt", "toAt") and isinstance(v, int) else conv(v)) for k, v in o.items()}
        if isinstance(o, list):
            return [conv(x) for x in o]
        return o

    scenes = []
    n = len(plan["scenes"])
    for i, sc in enumerate(plan["scenes"]):
        a, b = sc["sentences"]
        s0 = 0.0 if i == 0 else sec(a)
        s1 = dur if i == n - 1 else sec(plan["scenes"][i + 1]["sentences"][0])
        scenes.append({"start": round(s0, 3), "end": round(s1, 3), "page": f"{i + 1}/{n}",
                       "headline": sc["headline"], "layout": conv(sc["layout"]),
                       "box": conv(sc.get("box")) if sc.get("box") else None, "source": sc.get("source", "")})
    # 문장이 장면에 빠짐·겹침 없이 1번부터 끝까지 들어갔는지
    covered = [k for sc in plan["scenes"] for k in range(sc["sentences"][0], sc["sentences"][1] + 1)]
    if covered != list(range(1, len(sents) + 1)):
        sys.exit(f"[중단] 장면의 문장 범위가 1~{len(sents)} 를 빠짐·겹침 없이 덮지 않습니다")

    caps = []
    for i, s in enumerate(sents):
        t1 = sents[i + 1]["start"] if i + 1 < len(sents) else s["end"]
        caps += cues(s["text"], s["start"], max(t1, s["end"]) if i + 1 == len(sents) else t1)
    props = {"theme": plan["theme"], "masthead": plan["masthead"], "audio": "narration.mp3",
             "duration": round(dur + 0.4, 3), "scenes": scenes, "captions": caps}
    (ep / "render" / "props.json").write_text(json.dumps(props, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return props


def remotion(args: list[str], props: dict) -> None:
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump(props, f, ensure_ascii=False)
    r = subprocess.run([NPX, "remotion", *args, f"--props={f.name}", "--log=error"], cwd=STUDIO,
                       capture_output=True, text=True, encoding="utf-8")
    Path(f.name).unlink(missing_ok=True)
    if r.returncode != 0:
        sys.exit(f"[중단] Remotion 실패\n{(r.stdout + r.stderr)[-1500:]}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--stills", action="store_true")
    g.add_argument("--render", action="store_true")
    a = ap.parse_args()
    ep = Path(a.episode).resolve()
    props = build(ep)
    pub = f"--public-dir={ep}"
    if a.stills:
        out = ep / "render" / "check"
        out.mkdir(parents=True, exist_ok=True)
        for i, s in enumerate(props["scenes"], 1):
            f = max(0, int((s["end"] - 0.3) * FPS))
            print(f"[점검] 장면 {i} · {f / FPS:.1f}초", flush=True)
            remotion(["still", "Episode", str(out / f"{i:02d}.png"), f"--frame={f}", pub], props)
        print(f"→ {out}")
    else:
        out = ep / "video.mp4"
        print(f"[렌더] {props['duration']:.1f}초 · 장면 {len(props['scenes'])}개 …", flush=True)
        remotion(["render", "Episode", str(out), pub], props)
        print(f"→ {out}")


if __name__ == "__main__":
    main()
