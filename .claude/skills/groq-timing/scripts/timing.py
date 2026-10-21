# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "numpy"]
# ///
"""나레이션에서 문장마다 언제 시작하고 끝나는지 잰다.

  uv run timing.py <에피소드 폴더>     # sentences.json 을 쓰고 표를 보여 준다

사내 Shorts_Automation 의 sentences.py · sound.py · subtitle.py 에서 필요한 부분만 옮겼다(2026-10-21).

시각은 두 가지를 합친다.
  - Groq 받아 적기의 단어 시각 — 쉼 없이 이어 읽은 문장의 시작은 이것으로만 알 수 있다.
  - 소리로 잰 말 구간 — 쉼이 있는 자리는 0.01초 단위로 정확하다. 단어 시각이 말 구간
    경계와 0.35초 안이면 그쪽으로 당겨 붙인다.
받아 적은 글과 맞춰 보는 쪽은 실제로 읽힌 글이다 — Typecast 는 읽기본(reading.txt), 일레븐랩스는 대본 원문. 더 닮은 쪽을 고른다.
문장 수·순서는 script.md 대본과 같으므로 결과에는 대본 문장(숫자 그대로)을 함께 적는다.
받아 적기 결과는 나레이션 해시로 캐시해(~/.cache/reelmill/transcripts) 같은 소리는 다시 보내지 않는다.
"""
from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
import requests

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[4]          # reelmill
CACHE = Path.home() / ".cache" / "reelmill" / "transcripts"
GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
MODEL = "whisper-large-v3"
SNAP = 0.35          # 단어 시각이 말 구간 경계와 이보다 가까우면 그쪽으로 붙인다

# 소리로 말 구간 재기(사내 sound.py): 10밀리초마다 세기를 재고, 가장 센 곳에서 38dB 아래를 문턱으로.
SR, HOP, PEAK_DROP, MIN_SIL, MIN_SPEECH = 16000, 0.010, 38.0, 0.18, 0.06


# ── 키·받아 적기 ──────────────────────────────────────────────────────────

def groq_key() -> str:
    """reelmill/.env 의 GROQ_API_KEY. 없으면 사내 설정(~/.config/watch/.env)을 본다. 화면에 찍지 않는다."""
    for env in (ROOT / ".env", Path.home() / ".config" / "watch" / ".env"):
        if env.exists():
            for line in env.read_text(encoding="utf-8").splitlines():
                k, _, v = line.strip().partition("=")
                v = v.strip().strip("'\"")
                if k.removeprefix("export ").strip() == "GROQ_API_KEY" and v:
                    return v
    sys.exit("[중단] GROQ_API_KEY 가 없습니다 — reelmill/.env 에 한 줄로 넣어 주세요.")


def audio_hash(audio: Path) -> str:
    return hashlib.sha256(audio.read_bytes()).hexdigest()[:16]


def transcript(audio: Path) -> dict:
    f = CACHE / f"{audio_hash(audio)}.json"
    if f.exists():
        return json.loads(f.read_text(encoding="utf-8"))
    print(f"[문장 시각] Groq {MODEL} 받아 적는 중 … ({audio.name})", flush=True)
    for attempt in range(3):                        # 잠깐 끊겨도 바로 멈추지 않게
        try:
            with audio.open("rb") as fh:
                r = requests.post(
                    GROQ_URL, headers={"Authorization": f"Bearer {groq_key()}"},
                    files={"file": (audio.name, fh, "audio/mpeg")},
                    data=[("model", MODEL), ("language", "ko"), ("response_format", "verbose_json"),
                          ("temperature", "0"), ("timestamp_granularities[]", "word"),
                          ("timestamp_granularities[]", "segment")],
                    timeout=600)
        except (requests.ConnectionError, requests.Timeout):
            if attempt == 2:
                raise
            continue
        if r.status_code in (429, 500, 502, 503, 504) and attempt < 2:
            continue
        break
    if r.status_code != 200:
        sys.exit(f"[중단] Groq 받아 적기 실패 {r.status_code}: {r.text[:300]}")
    data = r.json()
    got = {"segments": data.get("segments", []), "words": data.get("words", [])}
    CACHE.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(got, ensure_ascii=False), encoding="utf-8")
    return got


# ── 소리로 말 구간 재기 ───────────────────────────────────────────────────

def segments(audio: Path) -> list[tuple[float, float]]:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(audio), "-ac", "1", "-ar", str(SR),
                          "-f", "s16le", "-"], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype="<i2").astype("float32") / 32768.0
    n = int(SR * HOP)
    m = len(x) // n
    if m == 0:
        sys.exit(f"[중단] 소리를 읽지 못했습니다: {audio}")
    f = x[: m * n].reshape(m, n)
    db = (20 * np.log10(np.sqrt((f ** 2).mean(axis=1) + 1e-12))).tolist()
    th = max(db) - PEAK_DROP
    found, i = [], 0
    while i < len(db):
        if db[i] > th:
            j = i
            while j < len(db) and db[j] > th:
                j += 1
            found.append([i * HOP, j * HOP])
            i = j
        else:
            i += 1
    out: list[list[float]] = []
    for a, b in found:
        if out and a - out[-1][1] < MIN_SIL:
            out[-1][1] = b
        else:
            out.append([a, b])
    return [(round(a, 3), round(b, 3)) for a, b in out if b - a >= MIN_SPEECH]


# ── 받아 적은 글 ↔ 읽기본 맞추기 ───────────────────────────────────────────

def nz(t: str) -> str:
    return re.sub(r"[^가-힣0-9a-zA-Z]", "", t or "")


def split_sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.?!])\s+", text.strip()) if s.strip()]


def word_index(words: list[dict]) -> tuple[str, list[tuple[int, int, float, float]]]:
    """단어들을 이어 붙인 비교용 글과 (시작글자, 끝글자, 시작초, 끝초) 목록."""
    text, spans, pos = [], [], 0
    for w in words:
        s = nz(w.get("word") or "")
        if not s:
            continue
        spans.append((pos, pos + len(s), float(w["start"]), float(w["end"])))
        pos += len(s)
        text.append(s)
    return "".join(text), spans


def script_map(stream: str, script_norm: str) -> list[int]:
    """받아 적은 글자 → 읽기본 글자 자리. 잘못 들은 자리는 맞게 들은 앞뒤를 닻으로 비례해 메운다."""
    mapped = [0] * (len(stream) + 1)
    sm = difflib.SequenceMatcher(None, stream, script_norm, autojunk=False)
    last_a = last_b = 0
    for a, b, size in sm.get_matching_blocks():
        for k in range(last_a, a):
            share = (k - last_a) / max(1, a - last_a)
            mapped[k] = int(last_b + (b - last_b) * share)
        for k in range(size):
            mapped[a + k] = b + k
        last_a, last_b = a + size, b + size
    for k in range(last_a, len(stream) + 1):
        mapped[k] = min(len(script_norm), last_b + (k - last_a))
    return mapped


def script_sentences(ep: Path) -> list[str]:
    md = (ep / "script.md").read_text(encoding="utf-8")
    body = md.split("## 대본", 1)[1].split("\n## ", 1)[0]
    return split_sentences(" ".join(body.split()))


def measure(ep: Path) -> list[dict]:
    audio = ep / "narration.mp3"
    if not audio.exists():
        sys.exit(f"[중단] {audio} 가 없습니다 — 2단계 나레이션을 먼저 만드세요")
    shown = script_sentences(ep)
    words = transcript(audio)["words"]
    if not words:
        sys.exit("[중단] 받아 적기에 단어 시각이 없습니다")

    # 무엇을 읽혔나: Typecast 는 읽기본(reading.txt), 일레븐랩스는 대본 원문. 받아 적은 글과 더 닮은 쪽과 맞춘다.
    heard_all = "".join(nz(w.get("word") or "") for w in words)
    cands = {"대본": " ".join(shown)}
    if (ep / "reading.txt").exists():
        cands["읽기본"] = (ep / "reading.txt").read_text(encoding="utf-8").strip()
    src = max(cands, key=lambda k: difflib.SequenceMatcher(None, heard_all, nz(cands[k]), autojunk=False).ratio())
    said = cands[src]
    heard = split_sentences(said)
    print(f"[문장 시각] 받아 적은 글을 {src}과 맞춥니다", flush=True)
    if len(heard) != len(shown):
        sys.exit(f"[중단] 문장 수가 다릅니다 — 대본 {len(shown)} · {src} {len(heard)}")
    segs = segments(audio)
    onsets, ends = [a for a, _ in segs], [b for _, b in segs]
    stream, spans = word_index(words)
    mapped = script_map(stream, nz(said))

    at, starts = 0, []
    for s in heard:
        starts.append(at)
        at += len(nz(s))

    rows = []
    for i, s in enumerate(heard):
        lo, hi = starts[i], starts[i] + len(nz(s))
        idxs = [k for k in range(len(stream)) if lo <= mapped[k] < hi]
        row = {"no": i + 1, "text": shown[i], "start": None, "end": None, "after": ""}
        if idxs:
            t0 = next(t for a, b, t, _ in spans if a <= idxs[0] < b)
            t1 = next(t for a, b, _, t in spans if a <= idxs[-1] < b)
            near = min(onsets, key=lambda x: abs(x - t0))
            if abs(near - t0) <= SNAP:
                t0 = near
            near = min(ends, key=lambda x: abs(x - t1))
            if abs(near - t1) <= SNAP:
                t1 = near
            row["start"], row["end"] = round(t0, 3), round(t1, 3)
        rows.append(row)

    prev = 0.0                                # 시간이 뒤로 가지 않게
    on = {round(a, 2) for a in onsets}
    for r in rows:
        if r["start"] is None:
            continue
        r["start"] = max(r["start"], prev)
        r["end"] = max(r["end"], r["start"] + 0.2)
        prev = r["start"] + 0.2
        r["after"] = "쉼 뒤" if round(r["start"], 2) in on else "이어 읽음"
    return rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ep = Path(ap.parse_args().episode).resolve()
    rows = measure(ep)
    out = {"audio": "narration.mp3", "audio_hash": audio_hash(ep / "narration.mp3"), "sentences": rows}
    (ep / "sentences.json").write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    miss = [r["no"] for r in rows if r["start"] is None]
    for r in rows:
        t = "   —  ~   —  " if r["start"] is None else f"{r['start']:6.2f}~{r['end']:6.2f}"
        print(f"  {r['no']:2d} {t}  {r['after']:5}  {r['text'][:40]}")
    run = sum(1 for r in rows if r["after"] == "이어 읽음")
    print(f"문장 {len(rows)}개 · 쉼 없이 이어 읽은 문장 {run}개 · 못 찾은 문장 {len(miss)}개 {miss or ''}")
    print(f"→ {ep / 'sentences.json'}")


if __name__ == "__main__":
    main()
