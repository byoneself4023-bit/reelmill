# /// script
# requires-python = ">=3.10"
# ///
"""롱폼 에피소드에서 쇼츠를 잘라 낸다 — 같은 나레이션 구간, 같은 자막 맞추기 결과, 같은 장면 설계로.

  uv run cut.py list <롱폼 폴더>                                   # 장별 문장 번호 · 글자 수 · 시각
  uv run cut.py make <롱폼 폴더> --chapter 2 --name <짧은 이름>       # 장 하나를 통째로
  uv run cut.py make <롱폼 폴더> --range 31-50 --name <짧은 이름> [--title "제목"] [--screen "첫 화면 문구"]

make 는 <롱폼 폴더>/cuts/<이름>/ 에 보통 쇼츠 에피소드 모양으로 만든다.
  narration.mp3        롱폼 나레이션에서 문장 A 시작 ~ 문장 B 끝을 잘라 냄(새로 읽히지 않는다 — 크레딧 없음)
  sentences.json       롱폼 자막 맞추기 결과를 잘라 낸 구간 기준으로 당긴 것(번호는 1부터 다시)
  script.md            잘라 낸 문장만 「## 대본」에, 팩트체크는 롱폼 것을 그대로
  render/plan.json     롱폼 장면 중 구간에 걸친 것만 잘라 번호를 다시 매긴 것(이미 있으면 두고, --force 면 새로)
그다음은 쇼츠와 같다: shorts-render 의 make_video.py <잘라 낸 폴더> --stills / --render (9:16).
"""
from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

SEC_PER_CHAR = 60 / 450          # 일레븐랩스 eleven_v4 · 속도 1.0, 문단 이어 읽기·쉼 포함 실측(약 450자/분) — 나레이션 전 어림용
LEAD, TAIL = 0.15, 0.35          # 잘라 낼 때 문장 앞뒤로 남길 숨(초). 앞뒤 문장 소리는 넘지 않는다
GAP_MAX, GAP_KEEP = 0.3, 0.25    # --tighten: 문장 사이 무음이 GAP_MAX 초를 넘으면 GAP_KEEP 초로 줄인다
AT_KEYS = ("at", "noteAt", "swapAt", "toAt")


def split_sentences(text: str) -> list[str]:
    """groq-timing 의 timing.py 와 같은 규칙(문장 번호가 맞아야 한다)."""
    return [s.strip() for s in re.split(r"(?<=[.?!])\s+", text.strip()) if s.strip()]


def section(md: str, name: str) -> str:
    return md.split(f"## {name}", 1)[1].split("\n## ", 1)[0] if f"## {name}" in md else ""


def chapters(md: str) -> list[dict]:
    """「## 대본」 안 「### N장. 제목」으로 장을 나눈다. 장마다 문단(문장 목록의 목록)과 번호 범위."""
    out, cur, para = [], None, []

    def close_para():
        if cur is not None and para:
            cur["paras"].append(split_sentences(" ".join(" ".join(para).split())))
        para.clear()

    for line in section(md, "대본").splitlines():
        m = re.match(r"\s*###\s*(\d+)\s*장\.?\s*(.+)", line)
        if m:
            close_para()
            cur = {"no": int(m.group(1)), "title": m.group(2).strip(), "paras": []}
            out.append(cur)
        elif line.lstrip().startswith("#"):
            continue
        elif not line.strip():
            close_para()
        else:
            para.append(line)
    close_para()
    n = 0
    for c in out:
        k = sum(len(p) for p in c["paras"])
        c["range"] = (n + 1, n + k)
        n += k
    return out


def mmss(t: float) -> str:
    return f"{int(t // 60)}:{t % 60:04.1f}"


def seconds(path: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    return float(r.stdout.strip())


def load(ep: Path) -> tuple[str, list[dict]]:
    md_path = ep / "script.md"
    if not md_path.exists():
        sys.exit(f"[중단] {md_path} 가 없습니다")
    md = md_path.read_text(encoding="utf-8")
    chs = chapters(md)
    if not chs:
        sys.exit("[중단] 「## 대본」에 「### N장. 제목」 줄이 없습니다 — 롱폼 대본이 아닙니다")
    return md, chs


def cmd_list(ep: Path) -> None:
    md, chs = load(ep)
    sj = ep / "sentences.json"
    times = {s["no"]: s for s in json.loads(sj.read_text(encoding="utf-8"))["sentences"]} if sj.exists() else {}
    if times and len(times) != chs[-1]["range"][1]:
        print(f"[알림] sentences.json 문장 {len(times)}개가 대본 {chs[-1]['range'][1]}개와 달라(대본을 고친 뒤) 시각 대신 어림으로 보여 줍니다")
        times = {}
    n = 0
    for c in chs:
        a, b = c["range"]
        chars = sum(len(s) for p in c["paras"] for s in p)
        if times:
            t0 = times[a]["start"]
            t1 = times[b + 1]["start"] if b + 1 in times else times[b]["end"]
            dur = f"실측 {t1 - t0:.0f}초"
        else:
            dur = f"어림 {chars * SEC_PER_CHAR:.0f}초"
        print(f"\n{c['no']}장. {c['title']}  — 문장 {a}~{b} · {chars:,}자 · {dur}")
        for p in c["paras"]:
            for s in p:
                n += 1
                t = f"[{mmss(times[n]['start'])}] " if times else ""
                print(f"  {n:>3} {t}{s}")
            print()
    cand = section(md, "쇼츠로 잘라 쓸 구간").strip()
    if cand:
        print("── 쇼츠로 잘라 쓸 구간 (script.md) ──\n" + cand)


def renumber(o, a: int, b: int, scene: int):
    """plan.json 조각의 문장 번호(at 등)를 잘라 낸 구간 기준으로 바꾼다.

    - 구간 앞(at < a): 롱폼에서 이미 나와 있던 것이므로 쇼츠 첫 문장에 바로 보이게 1로 둔다.
    - 구간 뒤(at > b): 쇼츠에서는 말하지 않는 것이다. 목록 항목(checks·parts·rows)은 빼고,
      그 밖의 값은 끝 문장에 붙이고 경고한다(나중 항목이 끝에 한꺼번에 뜨지 않게).
    """
    if isinstance(o, dict):
        out = {}
        for k, v in o.items():
            if k in AT_KEYS and isinstance(v, int):
                if v > b:
                    print(f"[경고] 장면 {scene}의 {k}={v} 가 구간({a}~{b}) 밖입니다 — 끝 문장에 붙입니다. 쇼츠 plan.json 을 확인하세요")
                out[k] = min(max(v, a), b) - a + 1
            else:
                out[k] = renumber(v, a, b, scene)
        return out
    if isinstance(o, list):
        keep = []
        for x in o:
            if isinstance(x, dict) and isinstance(x.get("at"), int) and x["at"] > b:
                print(f"[경고] 장면 {scene}의 항목 「{x.get('text') or x.get('name') or x.get('label')}」이 구간 밖(문장 {x['at']})이라 뺍니다")
                continue
            keep.append(renumber(x, a, b, scene))
        return keep
    return o


def cmd_make(ep: Path, args: argparse.Namespace) -> None:
    md, chs = load(ep)
    if args.chapter:
        c = next((c for c in chs if c["no"] == args.chapter), None)
        if not c:
            sys.exit(f"[중단] {args.chapter}장이 없습니다")
        a, b = c["range"]
    else:
        m = re.fullmatch(r"\s*(\d+)\s*[-~]\s*(\d+)\s*", args.range or "")
        if not m:
            sys.exit("[중단] --chapter N 이나 --range A-B 를 주세요")
        a, b = int(m.group(1)), int(m.group(2))
    total = chs[-1]["range"][1]
    if not 1 <= a <= b <= total:
        sys.exit(f"[중단] 문장 범위 {a}~{b} 가 1~{total} 밖입니다")
    for f in ("narration.mp3", "sentences.json"):
        if not (ep / f).exists():
            sys.exit(f"[중단] 롱폼 {f} 가 없습니다 — 롱폼 나레이션·자막 맞추기를 먼저 만드세요")
    sents = json.loads((ep / "sentences.json").read_text(encoding="utf-8"))["sentences"]
    if len(sents) != total:
        sys.exit(f"[중단] sentences.json 문장 {len(sents)}개와 대본 {total}개가 다릅니다")
    by = {s["no"]: s for s in sents}
    if any(by[k]["start"] is None for k in range(a, b + 1)):
        sys.exit("[중단] 구간 안에 시각을 못 찾은 문장이 있습니다")

    out = ep / "cuts" / args.name
    (out / "render").mkdir(parents=True, exist_ok=True)

    # 1) 나레이션 구간 — 앞 문장 끝과 뒤 문장 시작을 넘지 않게 숨만 조금 남긴다
    long_dur = seconds(ep / "narration.mp3")
    prev_end = (by[a - 1]["end"] or 0.0) if a > 1 else 0.0          # 앞 문장의 시각을 못 찾았으면 막지 않는다
    t0 = max(by[a]["start"] - LEAD, prev_end + 0.02 if a > 1 else 0.0, 0.0)
    t0 = min(t0, by[a]["start"])
    next_start = (by[b + 1]["start"] or long_dur) if b < total else long_dur
    t1 = min(by[b]["end"] + TAIL, next_start - 0.02 if b < total else long_dur, long_dur)
    t1 = max(t1, by[b]["end"])
    # 남길 소리 구간. --tighten 이면 문장 사이 0.3초 넘는 무음을 0.25초로 줄인다(문장 안 쉼은 그대로)
    kept = [[t0, t1]]
    if getattr(args, "tighten", False):
        kept, cur = [], t0
        for k in range(a, b):
            e, nx = by[k]["end"], by[k + 1]["start"]
            if e is not None and nx is not None and nx - e > GAP_MAX:
                kept.append([cur, e + GAP_KEEP / 2])
                cur = nx - GAP_KEEP / 2
        kept.append([cur, t1])

    def shift(t: float) -> float:
        """롱폼 시각 → 잘라 낸 쇼츠 시각(줄인 쉼만큼 당김)."""
        acc = 0.0
        for k0, k1 in kept:
            if t <= k1:
                return acc + max(0.0, t - k0)
            acc += k1 - k0
        return acc

    clip = sum(k1 - k0 for k0, k1 in kept)
    audio = out / "narration.mp3"
    # atrim 으로 자르고 시각을 0부터 다시 세야 페이드가 잘라 낸 구간 기준으로 걸린다. 이어 붙이는 곳마다 10ms 페이드(딸깍 소리 방지)
    parts, labels = [], []
    for n, (k0, k1) in enumerate(kept):
        fi = "afade=t=in:d=0.02" if n == 0 else "afade=t=in:d=0.01"
        fo = f"afade=t=out:st={max(0.0, k1 - k0 - (0.06 if n == len(kept) - 1 else 0.01)):.3f}:d={0.06 if n == len(kept) - 1 else 0.01}"
        parts.append(f"[0:a]atrim=start={k0:.3f}:end={k1:.3f},asetpts=PTS-STARTPTS,{fi},{fo}[p{n}]")
        labels.append(f"[p{n}]")
    graph = ";".join(parts) + f";{''.join(labels)}concat=n={len(kept)}:v=0:a=1[o]"
    r = subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(ep / "narration.mp3"), "-filter_complex", graph, "-map", "[o]",
                        "-c:a", "libmp3lame", "-b:a", "128k", str(audio)],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        sys.exit(f"[중단] ffmpeg 실패\n{r.stderr[-800:]}")

    # 2) 자막 맞추기 결과 — 구간 시작을 0초로(줄인 쉼만큼 당김)
    rows = []
    for k in range(a, b + 1):
        s = by[k]
        rows.append({**s, "no": k - a + 1, "start": round(shift(s["start"]), 3),
                     "end": round(shift(min(s["end"], t1)), 3), "long_no": k})
    rows[0]["after"] = "쉼 뒤"
    h = hashlib.sha256(audio.read_bytes()).hexdigest()[:16]
    (out / "sentences.json").write_text(json.dumps({"audio": "narration.mp3", "audio_hash": h,
                                                     "cut_from": {"episode": ep.name, "sentences": [a, b],
                                                                  "seconds": [round(t0, 3), round(t1, 3)],
                                                                  "tightened": round((t1 - t0) - clip, 2)},
                                                     "sentences": rows}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # 3) script.md — 잘라 낸 문장만(문단은 롱폼 그대로), 팩트체크는 롱폼 것
    paras, n, chap = [], 0, []
    for c in chs:
        for p in c["paras"]:
            keep = [s for i, s in enumerate(p, n + 1) if a <= i <= b]
            n += len(p)
            if keep:
                paras.append(" ".join(keep))
                if c["title"] not in chap:
                    chap.append(c["title"])
    head = md.splitlines()[0].lstrip("# ").strip()
    title = args.title or f"{head} — {' · '.join(chap)}"
    src = re.search(r"^- 자료:.*$", md, re.M)
    today = datetime.date.today().isoformat()
    lines = [f"# {title}", "",
             f"- 형식: 쇼츠 9:16 — 롱폼 `{ep.name}` 문장 {a}~{b}({' · '.join(chap)})에서 잘라 냄",
             f"- 상태: 잘라 냄 {today} · 나레이션 {clip:.1f}초(롱폼 {mmss(t0)}~{mmss(t1)})"]
    if src:
        lines.append(src.group(0))
    lines += ["", "## 대본", "", "\n\n".join(paras), ""]
    fc = section(md, "팩트체크").strip()
    if fc:
        lines += ["## 팩트체크", "", f"롱폼 `{ep.name}` 의 팩트체크를 그대로 옮김(문장 번호는 롱폼 번호).", "", fc, ""]
    lines += ["## 제목 3안", "", f"고른 제목: {title}", ""]
    screen = args.screen
    if not screen and (ep / "render" / "plan.json").exists():   # 첫 화면 문구가 없으면 구간 첫 장면 제목으로(커버가 늘 생기게)
        for sc in json.loads((ep / "render" / "plan.json").read_text(encoding="utf-8"))["scenes"]:
            if sc["sentences"][0] <= a <= sc["sentences"][1]:
                screen = " ".join("".join(x["t"] for x in line) for line in sc["headline"])
                break
    if screen:
        lines += ["## 첫 화면 문구", "", screen, ""]
    (out / "script.md").write_text("\n".join(lines), encoding="utf-8")

    # 4) 장면 설계 — 구간에 걸친 롱폼 장면만, 번호를 다시
    plan_out = out / "render" / "plan.json"
    long_plan = ep / "render" / "plan.json"
    if plan_out.exists() and not args.force:
        print(f"[장면] {plan_out} 가 이미 있어 그대로 둡니다(새로 만들려면 --force)")
    elif not long_plan.exists():
        print("[장면] 롱폼 render/plan.json 이 없어 장면 설계는 건너뜁니다 — 직접 쓰세요")
    else:
        lp = json.loads(long_plan.read_text(encoding="utf-8"))
        scenes = []
        for sc in lp["scenes"]:
            sa, sb = sc["sentences"]
            if sb < a or sa > b:
                continue
            box = sc.get("box")
            if box and isinstance(box.get("at"), int) and box["at"] > b:
                print(f"[경고] 장면 {len(scenes) + 1}의 상자 「{box.get('text')}」가 구간 밖(문장 {box['at']})이라 뺍니다")
                sc = {k: v for k, v in sc.items() if k != "box"}
            x = renumber({k: v for k, v in sc.items() if k != "sentences"}, a, b, len(scenes) + 1)
            scenes.append({"sentences": [max(sa, a) - a + 1, min(sb, b) - a + 1], **x})
        plan = {"theme": args.theme or lp["theme"], "masthead": args.masthead or lp["masthead"], "scenes": scenes}
        if lp.get("mastLabel") and not args.theme:
            plan["mastLabel"] = lp["mastLabel"]
        plan_out.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"[장면] 롱폼 장면 {len(scenes)}개를 옮겼습니다 → {plan_out}")

    print(f"[잘라 냄] 문장 {a}~{b} ({b - a + 1}개) · {clip:.1f}초" + (f"(쉼 {(t1 - t0) - clip:.1f}초 줄임)" if len(kept) > 1 else "") + f" → {out}")
    print("다음: uv run .claude/skills/shorts-render/scripts/make_video.py "
          f"\"{out}\" --stills  →  점검 화면을 보고 --render")


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("list")
    p.add_argument("episode")
    p = sub.add_parser("make")
    p.add_argument("episode")
    p.add_argument("--chapter", type=int, default=0)
    p.add_argument("--range", default="")
    p.add_argument("--name", required=True, help="잘라 낸 쇼츠 폴더 이름(영문 짧게)")
    p.add_argument("--title", default="")
    p.add_argument("--screen", default="", help="첫 화면 문구(커버)")
    p.add_argument("--theme", default="", help="롱폼과 다른 스타일로(비우면 롱폼 것)")
    p.add_argument("--masthead", default="")
    p.add_argument("--force", action="store_true", help="이미 있는 render/plan.json 도 새로")
    p.add_argument("--tighten", action="store_true", help="문장 사이 0.3초 넘는 쉼을 0.25초로(쇼츠 호흡, 롱폼은 그대로)")
    a = ap.parse_args()
    ep = Path(a.episode).resolve()
    if a.cmd == "list":
        cmd_list(ep)
    else:
        cmd_make(ep, a)


if __name__ == "__main__":
    main()
