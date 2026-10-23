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

키: reelmill/.env 의 ELEVENLABS_API_KEY. 화면에 찍지 않는다.
목소리: --voice 로 주거나, reelmill/.env 의 ELEVENLABS_VOICE_ID.
요금: 따로 청구되지 않고 요금제의 남은 글자에서 빠진다(읽기본 글자 수만큼).
"""
from __future__ import annotations

import argparse
import hashlib
import json
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
# 종료 코드: 3 = 남은 글자 모자람(다시 해도 안 됨), 4 = 네트워크·5xx·429(잠시 뒤 --resume 으로 다시 하면 됨), 1 = 그 밖
EXIT_NO_CREDIT, EXIT_RETRY = 3, 4
SETTINGS = {"stability": 0.5, "similarity_boost": 0.75, "speed": 1.0}   # 목소리에 저장된 속도(1.15)를 쓰지 않는다


def env(name: str) -> str:
    for f in (ROOT / ".env",):
        if f.exists():
            for line in f.read_text(encoding="utf-8").splitlines():
                k, _, v = line.strip().partition("=")
                v = v.strip().strip("'\"")
                if k.removeprefix("export ").strip() == name and v:
                    return v
    return ""


_DIGIT = "영일이삼사오육칠팔구"


def sino(n: int) -> str:
    """한자 수로 읽는다. 16 → 십육, 254 → 이백오십사, 1200 → 천이백."""
    if n == 0:
        return "영"
    out, big = "", 0
    while n:
        n, chunk = divmod(n, 10000)
        part = ""
        for i, ch in enumerate(reversed(str(chunk))):
            d = int(ch)
            if d:
                part = ("" if d == 1 and i else _DIGIT[d]) + ("", "십", "백", "천")[i] + part
        if part:
            out = part + ("", "만", "억", "조")[big] + out
        big += 1
    return out


_N = r"(?<![\d.,])(\d{1,3}(?:,\d{3})+|\d+)(?![\d.,]*\d)"   # 정수 하나(천 단위 쉼표 허용, 소수·더 긴 수의 일부는 빼기)
_UNIT = r"(쪽|층|호)(?![가-힣]*[0-9])"                   # 「3호선」「제3호」의 뒤 숫자 등은 건드리지 않음


def sino_counters(text: str) -> str:
    """일레븐랩스가 우리말 수로 잘못 읽는 단위만 한자 수 글자로 바꾼다.
    「16쪽」을 「열여섯 쪽」으로 읽었다(2026-10-23 사용자 지적) → 「십육 쪽」. 「35층」도 같은 위험.
    대본 전체를 읽기본으로 바꾸면 「254-15번지」를 「이백오십사-열다섯 번지」로 읽는 등 다른 데가 틀려,
    틀리는 단위만 고른다. 소수(「1.5호」)는 건드리지 않는다."""
    v = lambda s: sino(int(s.replace(",", "")))
    text = re.sub(r"(?<![\d.])(\d+)-(\d+)\s*번지", lambda m: f"{v(m[1])} 다시 {v(m[2])} 번지", text)
    # 범위(「1~3층」)와 나열(「9·11쪽」 → 「9, 11쪽」): 단위가 끝 수에만 붙은 앞 수들
    text = re.sub(_N + r"(?=(?:\s*[~∼,·]\s*\d[\d,]*)+\s*(?:쪽|층|호))", lambda m: v(m[1]), text)
    return re.sub(_N + r"\s*" + _UNIT, lambda m: f"{v(m[1])} {m[2]}", text)


def for_voice(body: str) -> str:
    """일레븐랩스로 보낼 글. 대본 파일은 그대로 두고 보낼 때만 다듬는다(금메달 시험 2026-10-21).

    - 토막 문장(「그리고 한가운데.」「은은 92.5퍼센트 이상.」처럼 「~다/요」로 끝나지 않는 문장)은
      끝 마침표를 쉼표로 바꿔 다음 문장과 잇는다 — 토막마다 문장 끝 억양이 붙어 뚝뚝 끊기지 않게.
    - (2026-10-23 바꿈) 문단 사이 줄표는 넣지 않는다. 모든 문단 끝에 같은 줄표가 붙어 매 문단이 끝났다가 새로 시작하듯
      들렸다. 이제 문단마다 따로 만들고 사이에 실제 쉼을 넣는다(chunks_of). 한 조각 안에서 묶인 문단은 한 칸으로 잇는다.
    - 소리 없는 기호를 다듬는다: 「」 지우기, 가운뎃점 → 쉼표, 괄호 → 쉼표로 감싸기(대본 파일은 그대로)
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
    text = " ".join(paras)
    text = re.sub(r"[「」『』]", "", text).replace("(안)", "안")
    text = sino_counters(text)
    text = re.sub(r"(?<=[가-힣A-Za-z0-9])\s*·\s*(?=[가-힣A-Za-z0-9])", ", ", text)
    text = re.sub(r"\s*\(([^()]{1,40})\)", r", \1,", text)
    text = re.sub(r",\s*([,.?!])", r"\1", text)          # 괄호를 쉼표로 바꾼 뒤 남는 「,.」「,,」
    return text


PARA_GAP, CHAPTER_GAP, MIN_PARA = 0.45, 0.9, 150   # 문단 사이 쉼(초), 장 사이 쉼(초), 이보다 짧은 문단은 다음 문단과 묶음


def chunks_of(body: str) -> list[tuple[str, float]]:
    """보낼 글을 문단 단위 조각으로 나누고, 조각 뒤에 넣을 쉼(초)을 붙인다.
    한 번에 통째로 보내면 9분 동안 0.25초 넘게 쉬는 곳이 4번뿐이었다(롱폼 시험, 2026-10-23) — 생각이 바뀌는 자리를
    귀로 알 수 없어 맥락이 끊겨 들렸다. 문단마다 만들고 앞 조각의 요청 번호로 이어 읽게 한 뒤(request stitching),
    문단 사이에 PARA_GAP, 장(### 줄) 사이에 CHAPTER_GAP 만큼 실제로 쉰다. 쇼츠(장 없음)도 문단 쉼은 같다."""
    chapters, cur = [], []
    for line in body.splitlines():
        if line.lstrip().startswith("#"):
            if "\n".join(cur).strip():
                chapters.append("\n".join(cur))
            cur = []
        else:
            cur.append(line)
    if "\n".join(cur).strip():
        chapters.append("\n".join(cur))
    out = []
    for ch in chapters:
        paras, buf = [" ".join(x.split()) for x in ch.strip().split("\n\n") if x.strip()], ""
        for para in paras:
            buf = f"{buf}\n\n{para}" if buf else para
            if len(buf) >= MIN_PARA:
                out.append([for_voice(buf), PARA_GAP])
                buf = ""
        if buf:
            out.append([for_voice(buf), PARA_GAP])
        if out:
            out[-1][1] = CHAPTER_GAP
    if out:
        out[-1][1] = 0.0
    return [(t, g) for t, g in out]


def speak(voice: str, text: str, prev_ids: list[str], next_text: str = "", next_ids: list[str] | None = None) -> tuple[bytes, str]:
    body = {"text": text, "model_id": MODEL, "language_code": "ko", "voice_settings": SETTINGS,
            "previous_request_ids": prev_ids[-3:]}
    if next_ids:
        body["next_request_ids"] = next_ids[:3]
    elif next_text:
        body["next_text"] = next_text
    try:
        r = requests.post(f"{API}/v1/text-to-speech/{voice}", params={"output_format": "mp3_44100_128"},
                          headers={**headers(), "Content-Type": "application/json"}, json=body, timeout=600)
    except (requests.Timeout, requests.ConnectionError) as e:
        print(f"[중단] 일레븐랩스 연결 실패: {type(e).__name__}", flush=True)
        sys.exit(EXIT_RETRY)
    if r.status_code != 200:
        print(f"[중단] 일레븐랩스 실패 {r.status_code}: {r.text[:300]}", flush=True)
        sys.exit(EXIT_RETRY if r.status_code >= 500 or r.status_code == 429 else 1)
    rid = r.headers.get("request-id", "")
    if not rid:
        print("[나레이션] 주의: 응답에 request-id 가 없어 다음 조각과 이어 읽기를 못 합니다", flush=True)
    return r.content, rid


def join_parts(ep: Path, files: list[Path], gaps: list[float], out: Path) -> None:
    """조각 사이에 쉼을 넣어 하나로 잇는다. 다시 인코딩해 조각 경계의 틈·딸깍 소리를 없앤다."""
    parts_dir = ep / "narration-parts"
    seq = []
    for f, g in zip(files, gaps):
        seq.append(f)
        if g > 0:
            sil = parts_dir / f"silence-{g:.2f}.mp3"
            if not sil.exists():
                subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i",
                                "anullsrc=r=44100:cl=mono", "-t", f"{g}", "-c:a", "libmp3lame", "-b:a", "128k", str(sil)],
                               check=True)
            seq.append(sil)
    lst = parts_dir / "list.txt"
    lst.write_text("".join(f"file '{f.resolve()}'\n" for f in seq), encoding="utf-8")
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0",
                    "-i", str(lst), "-ar", "44100", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "128k", str(out)], check=True)


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
    ap.add_argument("--resume", action="store_true",
                    help="--generate 와 같이: 지난 생성에서 이미 받은 조각(글이 같고 파일이 있는 것)은 다시 사지 않고 이어서 만든다")
    ap.add_argument("--redo", type=int, default=0, help="--generate 와 같이: 그 조각(1부터)만 다시 만들고 앞뒤 조각과 이어 붙인다")
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
    pairs = chunks_of(body)                          # 롱폼 장 제목(### N장.)은 읽지 않고 조각·쉼 경계로만 쓴다
    chunks, gaps = [t for t, _ in pairs], [g for _, g in pairs]
    if not chunks:
        sys.exit(f"[중단] {md.name} 의 「## 대본」에 읽을 글이 없습니다")
    sha = lambda t: hashlib.sha256(t.encode("utf-8")).hexdigest()[:12]
    for i, (c, g) in enumerate(pairs, 1):
        print(f"[나레이션] 보낼 글 {i}/{len(chunks)} (뒤에 {g}초 쉼):\n{c}\n")
    meta_path = ep / "narration-parts" / "narration.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
    if a.redo:
        old = meta.get("chunks", [])
        if not old or len(old) != len(chunks) or not 1 <= a.redo <= len(chunks):
            sys.exit(f"[중단] --redo {a.redo}: 지난 생성 기록(narration-parts/narration.json)과 조각 수가 맞지 않습니다 — --generate 로 전부 다시 만드세요")
        # 다시 만드는 조각만 글이 바뀌어도 된다. 다른 조각 글이 바뀌었으면 그 조각 소리가 대본과 어긋난다
        changed = [i + 1 for i, (c, o) in enumerate(zip(chunks, old)) if i != a.redo - 1 and o.get("sha") != sha(c)]
        if changed:
            sys.exit(f"[중단] --redo {a.redo}: 다른 조각 {changed} 의 글도 지난 생성 뒤 바뀌었습니다 — 그 조각들도 --redo 하거나 --generate 로 전부")
        need = len(chunks[a.redo - 1])
    else:
        need = sum(len(c) for c in chunks)
    have = left()
    print(f"[나레이션] 일레븐랩스 · 조각 {len(chunks)}개 · 들 글자 {need:,} · 남은 글자 {have:,}")
    if a.check:
        return
    if need > have:
        print("[중단] 남은 글자가 모자랍니다", flush=True)
        sys.exit(EXIT_NO_CREDIT)

    voice = a.voice or env("ELEVENLABS_VOICE_ID")
    if not voice:
        sys.exit("[중단] 목소리가 없습니다 — --voice ID 를 주거나 reelmill/.env 에 ELEVENLABS_VOICE_ID 를 적어 주세요(--voices 로 목록)")
    parts_dir = ep / "narration-parts"
    parts_dir.mkdir(exist_ok=True)
    files = [parts_dir / f"{i:02d}.mp3" for i in range(1, len(chunks) + 1)]
    print(f"[나레이션] 생성 중 … 목소리 {voice} · 모델 {MODEL}", flush=True)
    if a.redo:
        k = a.redo - 1
        ids = [c["request_id"] for c in meta["chunks"]]
        audio, rid = speak(voice, chunks[k], ids[max(0, k - 3):k], next_ids=ids[k + 1:k + 4])
        files[k].write_bytes(audio)
        meta["chunks"][k].update(request_id=rid or meta["chunks"][k]["request_id"], chars=len(chunks[k]), sha=sha(chunks[k]),
                                 seconds=round(seconds(files[k]), 2))
        print(f"[나레이션] 조각 {a.redo} 다시 만듦 ({meta['chunks'][k]['seconds']}초)")
    else:
        prev = meta if (a.resume and meta.get("model") == MODEL and meta.get("voice") == voice) else {}
        ids, meta = [], {"model": MODEL, "voice": voice, "settings": SETTINGS, "chunks": []}
        for i, c in enumerate(chunks):
            old = (prev.get("chunks") or [])[i] if i < len(prev.get("chunks") or []) else None
            # 앞에서부터 이어지는 동안만 다시 쓴다(뒤 조각은 앞 조각의 요청 번호로 이어 읽으므로)
            if old and len(meta["chunks"]) == i and old.get("sha") == sha(c) and files[i].exists():
                meta["chunks"].append(old)
                if old.get("request_id"):
                    ids.append(old["request_id"])
                print(f"[나레이션] 조각 {i + 1}/{len(chunks)} 지난 생성 그대로 씀", flush=True)
                continue
            nxt = chunks[i + 1][:300] if i + 1 < len(chunks) else ""
            audio, rid = speak(voice, c, ids, next_text=nxt)
            files[i].write_bytes(audio)
            if rid:
                ids.append(rid)
            meta["chunks"].append({"file": files[i].name, "request_id": rid, "chars": len(c), "sha": sha(c),
                                   "gap_after": gaps[i], "seconds": round(seconds(files[i]), 2)})
            meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")   # 중간에 끊겨도 기록이 남게
            print(f"[나레이션] 조각 {i + 1}/{len(chunks)} 받음 ({meta['chunks'][-1]['seconds']}초)", flush=True)
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    out = ep / a.out
    for f in parts_dir.glob("[0-9][0-9].mp3"):       # 조각 수가 줄었으면 지난 생성의 남은 조각을 치운다
        if f not in files:
            f.unlink()
    join_parts(ep, files, gaps, out)
    print(f"[나레이션] 받았습니다 → {out.name} ({out.stat().st_size/1e6:.1f} MB) · 실제 길이 {seconds(out):.1f}초 · 남은 글자 {left():,}")
    print("[나레이션] 어색한 조각만 다시: --generate --redo <조각 번호> (앞뒤 조각과 이어지게 다시 만듦)")


if __name__ == "__main__":
    main()
