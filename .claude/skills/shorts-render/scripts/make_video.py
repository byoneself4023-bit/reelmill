# /// script
# requires-python = ">=3.10"
# ///
"""장면 설계(render/plan.json) + 문장 시각(sentences.json) + 나레이션으로 영상을 조립한다(Remotion).

  uv run make_video.py <에피소드 폴더> --stills    # 장면마다 끝 무렵 정지 화면 → render/check/NN.png (점검용)
  uv run make_video.py <에피소드 폴더> --render    # 영상 → <에피소드>/video.mp4 + 커버 cover.png
  uv run make_video.py <에피소드 폴더> --cover     # 커버만 → <에피소드>/cover.png
  uv run make_video.py <롱폼 폴더> --long --stills [--theme 키] [--scenes 3,7]   # 롱폼 16:9 점검 화면(장 카드 포함)
  uv run make_video.py <롱폼 폴더> --long --render                             # 롱폼 16:9 영상 → video.mp4

롱폼(--long)은 1920×1080 Composition 「Longform」으로 그린다. 장은 script.md 「## 대본」 안의
`### N장. 제목` 줄에서 읽고, 장이 시작할 때 장 제목 카드를 띄운다. 장면 설계(plan.json)는 쇼츠와 같은 모양이다.

plan.json 의 "at"·"noteAt"·"swapAt"·"toAt" 은 문장 번호다. 여기서 그 문장이 시작하는 초로 바꾼다
— 요소가 「그 숫자를 말하는 순간」 나타나게. 장면 경계도 장면 첫 문장의 시작 시각이다.
만든 값은 render/props.json 에 남긴다(무엇으로 렌더했는지).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
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
CHUNK = 3600                      # 롱폼 렌더 조각(프레임) — 2분
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
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
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


def split_sentences(text: str) -> list[str]:
    """groq-timing 의 timing.py 와 같은 규칙으로 문장을 나눈다(문장 번호가 맞아야 한다)."""
    return [s.strip() for s in re.split(r"(?<=[.?!])\s+", text.strip()) if s.strip()]


def chapters_of(ep: Path) -> list[dict]:
    """롱폼 script.md 의 「### N장. 제목」 줄로 장을 나누고, 장마다 문장 번호 범위를 센다."""
    body = (ep / "script.md").read_text(encoding="utf-8").split("## 대본", 1)[1].split("\n## ", 1)[0]
    out, cur = [], None
    for line in body.splitlines():
        m = re.match(r"\s*###\s*(\d+)\s*장\.?\s*(.+)", line)
        if m:
            cur = {"no": int(m.group(1)), "title": m.group(2).strip(), "text": []}
            out.append(cur)
        elif cur is not None and not line.lstrip().startswith("#"):
            cur["text"].append(line)
    n = 0
    for c in out:
        k = len(split_sentences(" ".join(" ".join(c.pop("text")).split())))
        c["sentences"] = [n + 1, n + k]
        n += k
    return out


def build(ep: Path, long: bool = False) -> dict:
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
    if plan.get("mastLabel"):                       # 스타일의 머리글 이름을 이 영상에서만 바꿀 때
        props["mastLabel"] = plan["mastLabel"]
    if long:
        chs = chapters_of(ep)
        if not chs:
            sys.exit("[중단] 롱폼인데 script.md 「## 대본」에 「### N장. 제목」 줄이 없습니다")
        if chs[-1]["sentences"][1] != len(sents):
            sys.exit(f"[중단] 장으로 센 문장 {chs[-1]['sentences'][1]}개와 sentences.json {len(sents)}개가 다릅니다")
        firsts = {c["sentences"][0] for c in chs}
        for sc in plan["scenes"]:                   # 장면이 장 경계를 넘으면 장 카드 뒤에 앞 장 화면이 남는다
            a, b = sc["sentences"]
            if any(a < f <= b for f in firsts):
                print(f"[경고] 장면 {a}~{b} 이 장 경계를 넘습니다 — 장 첫 문장에서 장면을 나누세요")
        props["chapters"] = []
        for i, c in enumerate(chs):
            c0 = 0.0 if i == 0 else sec(c["sentences"][0])
            c1 = dur if i == len(chs) - 1 else sec(chs[i + 1]["sentences"][0])
            props["chapters"].append({"no": c["no"], "title": c["title"], "start": round(c0, 3), "end": round(c1, 3),
                                      "sentences": c["sentences"]})
    (ep / "render" / "props.json").write_text(json.dumps(props, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return props


def remotion(args: list[str], props: dict | None) -> None:
    extra = []
    if props is not None:
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
            json.dump(props, f, ensure_ascii=False)
        extra = [f"--props={f.name}"]
    r = subprocess.run([NPX, "remotion", *args, *extra, "--log=error"], cwd=STUDIO,
                       capture_output=True, text=True, encoding="utf-8")
    if extra:
        Path(extra[0].split("=", 1)[1]).unlink(missing_ok=True)
    if r.returncode != 0:
        sys.exit(f"[중단] Remotion 실패\n{(r.stdout + r.stderr)[-1500:]}")


def cover(ep: Path, props: dict) -> None:
    """script.md 의 「## 첫 화면 문구」와 고른 제목으로 커버 한 장을 만든다."""
    md = (ep / "script.md").read_text(encoding="utf-8")
    text = md.split("## 첫 화면 문구", 1)[1].strip().splitlines()[0].strip() if "## 첫 화면 문구" in md else ""
    import re as _re
    picked = _re.search(r"고른 제목:\s*(?:\d+\.\s*)?(.+)", md)
    title = picked.group(1).strip() if picked else md.splitlines()[0].lstrip("# ").strip()
    if not text:
        print("[커버] 첫 화면 문구가 없어 건너뜁니다")
        return
    out = ep / "cover.png"
    remotion(["still", "Cover", str(out)], {"theme": props["theme"], "masthead": props["masthead"], "text": text, "title": title})
    print(f"→ {out}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--stills", action="store_true")
    g.add_argument("--render", action="store_true")
    g.add_argument("--cover", action="store_true")
    ap.add_argument("--long", action="store_true", help="롱폼 16:9(1920×1080)")
    ap.add_argument("--theme", default="", help="점검 화면만 이 스타일로(스타일 비교용, plan.json 은 그대로)")
    ap.add_argument("--scenes", default="", help="점검 화면을 뽑을 장면 번호(예: 3,7). 비우면 전부")
    a = ap.parse_args()
    ep = Path(a.episode).resolve()
    props = build(ep, a.long)
    pub = f"--public-dir={ep}"
    if a.long:
        long_video(ep, props, a, pub)
        return
    if a.stills:
        out = ep / "render" / "check"
        out.mkdir(parents=True, exist_ok=True)
        for i, s in enumerate(props["scenes"], 1):
            f = max(0, int((s["end"] - 0.3) * FPS))
            print(f"[점검] 장면 {i} · {f / FPS:.1f}초", flush=True)
            remotion(["still", "Episode", str(out / f"{i:02d}.png"), f"--frame={f}", pub], props)
        print(f"→ {out}")
    elif a.cover:
        cover(ep, props)
    else:
        out = ep / "video.mp4"
        print(f"[렌더] {props['duration']:.1f}초 · 장면 {len(props['scenes'])}개 …", flush=True)
        remotion(["render", "Episode", str(out), pub], props)
        print(f"→ {out}")
        cover(ep, props)


def long_video(ep: Path, props: dict, a: argparse.Namespace, pub: str) -> None:
    """롱폼 16:9. 점검 화면은 장면마다 끝 무렵 + 장마다 장 카드(시작 1.2초 뒤)."""
    if a.cover:
        sys.exit("[중단] 롱폼 커버(16:9 썸네일)는 아직 없습니다")
    if a.stills:
        out = ep / "render" / "check"
        out.mkdir(parents=True, exist_ok=True)
        if a.theme:
            props = {**props, "theme": a.theme}
        props = {**props, "audio": ""}       # 정지 화면엔 소리가 필요 없다(긴 나레이션을 장마다 읽으면 느리다)
        try:
            pick = {int(x) for x in a.scenes.split(",") if x.strip()}
        except ValueError:
            sys.exit(f"[중단] --scenes 는 장면 번호를 쉼표로 이어 적습니다(예: 3,7) — 받은 값: {a.scenes}")
        pre = f"{a.theme}-" if a.theme else ""
        # 한 번만 묶고 브라우저 하나로 전부 뽑는다(remotion still 을 장마다 부르면 장마다 20초 가까이 걸린다)
        jobs = []
        for i, s in enumerate(props["scenes"], 1):
            if not pick or i in pick:
                jobs.append({"frame": max(0, int((s["end"] - 0.3) * FPS)), "out": str(out / f"{pre}{i:02d}.png"),
                             "label": f"장면 {i}"})
        if not pick:
            for c in props["chapters"]:
                jobs.append({"frame": int((c["start"] + 1.2) * FPS), "out": str(out / f"{pre}ch{c['no']}.png"),
                             "label": f"{c['no']}장 카드"})
        with tempfile.TemporaryDirectory() as tmp:
            bundle = str(Path(tmp) / "bundle")
            print(f"[점검] Remotion 묶는 중 … (정지 화면 {len(jobs)}장)", flush=True)
            remotion(["bundle", f"--out-dir={bundle}", pub], None)
            (Path(tmp) / "props.json").write_text(json.dumps(props, ensure_ascii=False), encoding="utf-8")
            (Path(tmp) / "jobs.json").write_text(json.dumps(jobs, ensure_ascii=False), encoding="utf-8")
            r = subprocess.run(["node", "scripts/stills.mjs", bundle, "Longform", str(Path(tmp) / "props.json"),
                                str(Path(tmp) / "jobs.json")], cwd=STUDIO, text=True, encoding="utf-8")
            if r.returncode != 0:
                sys.exit("[중단] 정지 화면 뽑기 실패")
        print(f"→ {out}")
        return
    out = ep / "video.mp4"
    print(f"[렌더] 롱폼 16:9 · {props['duration']:.1f}초 · 장 {len(props['chapters'])}개 · 장면 {len(props['scenes'])}개 …", flush=True)
    # 소리 없이 그린 뒤 나레이션을 ffmpeg 로 붙인다 — 8분짜리 소리를 Remotion 이 프레임마다 섞으면
    # 임시 파일이 커서(디스크가 빠듯하면 ENOSPC) 느리다. 소리는 narration.mp3 그대로라 결과는 같다.
    # 2분씩 나눠 그린다 — 중간에 멈춰도(디스크·전원) 다시 부르면 다 그린 조각은 건너뛴다.
    # 조각 이름에 「무엇으로 그렸나」 지문을 넣는다 — 렌더 값(props)과 Remotion 코드(src)가 같을 때만 옛 조각을 다시 쓴다.
    # 대본·plan·스타일·화면 코드를 바꾸면 지문이 달라지고, 지문이 다른 옛 조각은 시작할 때 지운다.
    h = hashlib.sha256(json.dumps({**props, "audio": ""}, sort_keys=True, ensure_ascii=False).encode("utf-8"))
    for f in sorted((STUDIO / "src").rglob("*")):
        if f.is_file():
            h.update(f.relative_to(STUDIO).as_posix().encode("utf-8") + f.read_bytes())
    tag = h.hexdigest()[:8]
    parts_dir = ep / "render" / "parts"
    parts_dir.mkdir(parents=True, exist_ok=True)
    for old in parts_dir.iterdir():
        if old.suffix == ".mp4" and not old.name.endswith(f"-{tag}.mp4"):
            print(f"[렌더] 지문이 다른 옛 조각을 지웁니다: {old.name}")
            old.unlink()
    total = math.ceil(props["duration"] * FPS)
    parts = []
    for k, f0 in enumerate(range(0, total, CHUNK)):
        f1 = min(total, f0 + CHUNK) - 1
        part = parts_dir / f"{k + 1:02d}-{f0}-{f1}-{tag}.mp4"
        parts.append(part)
        if part.exists():
            continue
        print(f"[렌더] 조각 {k + 1} · {f0 / FPS:.0f}~{(f1 + 1) / FPS:.0f}초", flush=True)
        tmp = parts_dir / f"{part.stem}.tmp.mp4"
        remotion(["render", "Longform", str(tmp), pub, "--muted", f"--frames={f0}-{f1}"], {**props, "audio": ""})
        tmp.replace(part)
    lst = parts_dir / "list.txt"
    lst.write_text("".join(f"file '{x.name}'\n" for x in parts), encoding="utf-8")
    silent = ep / "render" / "video-silent.mp4"
    r = subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(silent)],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        sys.exit(f"[중단] 조각 잇기 실패\n{r.stderr[-800:]}")
    r = subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(silent), "-i", str(ep / "narration.mp3"),
                        "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", str(out)],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        sys.exit(f"[중단] 나레이션 붙이기 실패\n{r.stderr[-800:]}")
    silent.unlink(missing_ok=True)
    for x in parts_dir.iterdir():
        x.unlink()
    parts_dir.rmdir()
    print(f"→ {out}")
    print("[챕터] 유튜브 설명란에 붙일 장 시각:")
    for c in props["chapters"]:
        m, s = divmod(int(c["start"]), 60)
        print(f"{m}:{s:02d} {c['title']}")


if __name__ == "__main__":
    main()
