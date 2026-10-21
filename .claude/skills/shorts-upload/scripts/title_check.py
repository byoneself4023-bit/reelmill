# /// script
# requires-python = ">=3.10"
# dependencies = ["kiwipiepy"]
# ///
"""제목·첫 화면 문구 검사(한국어) — youtube-agent-skill 의 yt-package/title.py(MIT) 규칙을 한국어로 다시 만든 것.

  uv run title_check.py --title "제목" --screen "첫 화면 문구"
  uv run title_check.py --title "제목1" --title "제목2" --screen "…"   # 여러 제목 비교

보는 것
- 길이: 40자(모바일 피드에서 잘리기 쉬운 곳) · 60자(데스크톱 검색에서 잘리는 곳) — yt-package 기준(경험칙)
- 숫자·이름·날짜 같은 구체적인 것이 있는가
- 첫 화면 문구가 제목의 낱말(명사·숫자)을 되풀이하는가 — 화면과 제목은 같은 약속을 다른 말로
- 첫 화면 문구가 10자 안팎인가(소리 없이 1초 안에 읽히게)
"""
from __future__ import annotations

import argparse
import re
import sys

from kiwipiepy import Kiwi

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
_kiwi = Kiwi()
STOP = {"이유", "진짜", "정말", "것", "수", "때문"}


def keys(t: str) -> set[str]:
    out = set()
    for tok in _kiwi.tokenize(t):
        if tok.tag in ("NNG", "NNP", "SL") and tok.form not in STOP and len(tok.form) >= 2:
            out.add(tok.form)
    out |= set(re.findall(r"\d[\d,.]*", t))
    return out


def check(title: str, screen: str | None) -> tuple[int, list[str], list[str]]:
    bad, good = [], []
    n = len(title)
    if n > 60:
        bad.append(f"{n}자 — 60자를 넘어 데스크톱 검색에서 뒤가 잘림")
    elif n > 40:
        bad.append(f"{n}자 — 40자를 넘어 모바일 피드에서 잘릴 수 있음")
    else:
        good.append(f"{n}자 — 40자 안")
    if re.search(r"\d", title):
        good.append("숫자가 들어 있음")
    else:
        bad.append("숫자·이름·날짜 같은 구체적인 것이 없음")
    if title.count("!") + title.count("?") > 1:
        bad.append("느낌표·물음표가 여러 개 — 낚시처럼 보임")
    if screen:
        same = keys(title) & keys(screen)
        if same:
            bad.append(f"첫 화면 문구가 제목 낱말을 되풀이함: {', '.join(sorted(same))} — 다른 말로 같은 약속을")
        else:
            good.append("첫 화면 문구와 제목이 다른 말")
        m = len(screen.replace(" ", ""))
        if m > 14:
            bad.append(f"첫 화면 문구 {m}자(공백 뺌) — 10자 안팎이 1초 안에 읽힘")
    score = max(0, min(100, 100 - 15 * len(bad) + 3 * len(good)))
    return score, bad, good


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--title", action="append", required=True)
    ap.add_argument("--screen")
    a = ap.parse_args()
    rows = sorted(((check(t, a.screen), t) for t in a.title), key=lambda x: -x[0][0])
    for (score, bad, good), t in rows:
        print(f"\n「{t}」 {score}점")
        for b in bad:
            print(f"  ✗ {b}")
        for g in good:
            print(f"  ✓ {g}")


if __name__ == "__main__":
    main()
