---
name: groq-timing
description: "쇼츠 3단계 — 문장 시각. 2단계 narration.mp3 를 Groq 로 받아 적고 소리 구간과 맞춰, 대본 문장마다 시작·끝 시각(초)을 sentences.json 에 적는다. 화면 전환·자막이 이 시각을 따른다. /groq-timing 으로 부른다. 폴더 이름(예: gold-medal)은 생략하면 가장 최근 에피소드를 쓴다."
---

# 문장 시각

입력: `work/episodes/<폴더>/` 의 `script.md`(대본) · `narration.mp3`(나레이션) · `reading.txt`(Typecast 로 만들었을 때만)
- 폴더 이름을 안 주면 `work/episodes/` 에서 narration.mp3 가 가장 최근에 바뀐 폴더를 고르고 한 줄로 밝힌다.

결과: 같은 폴더에 `sentences.json`

멈추지 않고 끝까지 돌린다(크레딧 없음 — Groq 받아 적기는 아주 적은 요금이고, 같은 나레이션은 캐시해 다시 받지 않는다).

## 준비 (처음 한 번)

- `reelmill/.env` 에 `GROQ_API_KEY` (키 값은 화면에 찍지 않는다).
- `uv`, `ffmpeg` (필요한 파이썬 패키지는 uv 가 알아서 받는다).
- 코드는 스킬 안 `scripts/timing.py` 하나다. 받아 적기 결과는 `~/.cache/reelmill/transcripts` 에 캐시한다.

## 1. 재기

```bash
uv run .claude/skills/groq-timing/scripts/timing.py work/episodes/<폴더>
```

- Groq 받아 적기(whisper-large-v3)의 단어 시각으로 문장이 어디서 시작하는지 찾고, 소리로 잰 말 구간(쉼)이 0.35초 안에 있으면 그쪽으로 당겨 붙인다.
- 받아 적은 글은 실제로 읽힌 글과 맞춘다 — 대본 원문(일레븐랩스)이나 읽기본(Typecast) 중 받아 적은 글과 더 닮은 쪽을 고른다. 금메달에서는 두 나레이션 모두 대본 원문 쪽이 골라졌고, Typecast 결과 시각은 읽기본으로 맞췄을 때와 같았다. 문장 수·순서는 대본과 같아야 한다(다르면 멈춘다).
- 결과 표(번호 · 시작~끝 · 쉼 뒤/이어 읽음 · 대본 문장)를 사용자에게 보여 준다.
- 「이어 읽음」은 앞 문장과 쉼 없이 붙은 자리다. 시각이 ±0.4초쯤 흔들릴 수 있다.

## sentences.json

```json
{"audio": "narration.mp3", "audio_hash": "…",
 "sentences": [{"no": 1, "text": "대본 문장(숫자 그대로)",
                "start": 0.04, "end": 4.18, "after": "쉼 뒤|이어 읽음"}]}
```

- `audio_hash` 로 어느 나레이션으로 잰 값인지 남긴다. 나레이션을 다시 만들면 다시 잰다.

## 넘어가기 전 점검

- [ ] 못 찾은 문장이 0개인가(있으면 그 문장 받아 적기를 보고 원인을 밝힌다)
- [ ] 마지막 문장 끝이 나레이션 길이 안에 있는가

통과하면 `/shorts-style-drafts` 로 넘어간다.
