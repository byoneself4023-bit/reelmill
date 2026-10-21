# /// script
# requires-python = ">=3.10"
# dependencies = ["kiwipiepy"]
# ///
"""추천 제목 기록 — 대화가 바뀌어도 같은 질문을 다시 추천하지 않게 한다.

기록: reelmill/work/ideas/history.jsonl (한 줄에 제목 하나)
  {"date","niche","title","key":[핵심 명사],"picked":false,"episode":null}

  uv run ideas.py check "제목1" "제목2" ...     # 기록과 겹치는 후보를 알려 준다
  uv run ideas.py add --niche 스포츠 "제목1" ...  # 추천한 제목을 기록한다
  uv run ideas.py pick "제목" [--episode 폴더]   # 고른 주제 표시

겹침: 니치와 상관없이 핵심 명사가 절반 이상 같으면 같은 질문으로 본다(매번 같은 결과).
풀어 주기: 추천만 하고 고르지 않은 제목은 180일이 지나면 다시 추천할 수 있다.
고른 제목은 기간과 상관없이 계속 막는다.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

from kiwipiepy import Kiwi

ROOT = Path(__file__).resolve().parents[4]
HIST = ROOT / "work" / "ideas" / "history.jsonl"
RELEASE_DAYS = 180
OVERLAP = 0.5
STOP = {"이유", "왜", "얼마나", "진짜", "어떻게", "무엇", "누구", "정말", "사람", "때문"}

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
_kiwi = Kiwi()


def key(title: str) -> list[str]:
    out = []
    for t in _kiwi.tokenize(title):
        if t.tag in ("NNG", "NNP", "SL", "SN") and t.form not in STOP and (len(t.form) >= 2 or t.tag == "SN"):
            if t.form not in out:
                out.append(t.form)
    return out


def load() -> list[dict]:
    if not HIST.exists():
        return []
    return [json.loads(l) for l in HIST.read_text(encoding="utf-8").splitlines() if l.strip()]


def save_all(rows: list[dict]) -> None:
    HIST.parent.mkdir(parents=True, exist_ok=True)
    HIST.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")


def active(r: dict, today: date) -> bool:
    if r.get("picked"):
        return True
    return (today - date.fromisoformat(r["date"])).days < RELEASE_DAYS


def sim(a: list[str], b: list[str]) -> float:
    if not a or not b:
        return 0.0
    sa, sb = set(a), set(b)
    return len(sa & sb) / min(len(sa), len(sb))


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("check"); c.add_argument("titles", nargs="+")
    a = sub.add_parser("add"); a.add_argument("--niche", required=True); a.add_argument("titles", nargs="+")
    p = sub.add_parser("pick"); p.add_argument("title"); p.add_argument("--episode")
    args = ap.parse_args()
    rows, today = load(), date.today()

    if args.cmd == "check":
        live = [r for r in rows if active(r, today)]
        clash = 0
        for t in args.titles:
            k = key(t)
            hits = sorted(((sim(k, r["key"]), r) for r in live), key=lambda x: -x[0])
            if hits and hits[0][0] >= OVERLAP:
                s, r = hits[0]
                clash += 1
                print(f"겹침\t{t}\t← {r['title']} ({r['date']}, {'고름' if r.get('picked') else '추천만'}, {s:.2f})")
            else:
                print(f"새것\t{t}")
        print(f"(기록 {len(rows)}개 중 유효 {len(live)}개 · 겹침 {clash}개)")
    elif args.cmd == "add":
        have = {r["title"] for r in rows}
        new = [{"date": today.isoformat(), "niche": args.niche, "title": t, "key": key(t), "picked": False, "episode": None}
               for t in args.titles if t not in have]
        save_all(rows + new)
        print(f"기록 +{len(new)} → {HIST}")
    elif args.cmd == "pick":
        k = key(args.title)
        best = max(rows, key=lambda r: sim(k, r["key"]), default=None)
        if best and (best["title"] == args.title or sim(k, best["key"]) >= 0.8):
            best["picked"], best["episode"] = True, args.episode or best.get("episode")
        else:
            rows.append({"date": today.isoformat(), "niche": "직접 입력", "title": args.title, "key": k,
                         "picked": True, "episode": args.episode})
        save_all(rows)
        print(f"고름: {args.title}")


if __name__ == "__main__":
    main()
