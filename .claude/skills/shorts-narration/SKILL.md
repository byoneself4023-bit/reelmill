---
name: shorts-narration
description: "쇼츠 2단계 — 나레이션. 1단계 script.md 의 대본을 일레븐랩스 API(기본, 대본 원문 그대로) 또는 Typecast(강사용, 숫자를 소리대로 바꾼 읽기본)로 읽혀 narration.mp3 로 받는다. /shorts-narration 으로 부른다. 폴더 이름(예: gold-medal)은 생략하면 가장 최근 에피소드를 쓴다."
---

# 나레이션

**멈추는 곳은 한 번 — 글자·크레딧이 드는 생성 직전.** 읽기본 만들기와 확인(글자 안 씀)은 이어서 하고, 결과를 한 번에 보여 주며 생성 허락을 묻는다.

입력: `work/episodes/<폴더>/script.md` (1단계 결과물)
- 폴더 이름을 안 주면 `work/episodes/` 에서 script.md 가 가장 최근에 바뀐 폴더를 고르고, 「○○ 영상으로 나레이션을 만듭니다」 한 줄로 밝힌다.

결과: 같은 폴더에 `narration.mp3` (Typecast 일 때만 `reading.txt` 도)

## 엔진 고르기

- **기본: 일레븐랩스 API.** 크롬이 필요 없고 수강생 컴퓨터에서도 그대로 돈다. 요금은 따로 청구되지 않고 요금제의 남은 글자에서 빠진다.
  - **대본 원문을 그대로 넣는다(읽기본 안 씀).** 일레븐랩스가 숫자·단위를 스스로 한국어로 읽는다(`language_code=ko`). 읽기본으로 바꿔 넣으면 「오백이십구 그램」처럼 끊어 읽어 오히려 부자연스럽다(금메달 시험에서 확인).
  - 모델 `eleven_v4`(가장 최신·최고 품질), 속도 1.0. 목소리에 저장된 속도(예: 1.15)는 쓰지 않는다.
  - 보낼 때만 다듬는다(`for_voice`, script.md 는 그대로): 「~다/요」로 끝나지 않는 토막 문장은 마침표를 쉼표로 바꿔 다음 문장과 잇고, 문단 자리에 줄표(—)를 넣는다. 토막 잇기는 효과가 있었고, 줄표로는 쉼이 길어지지 않았다(eleven_v4 는 문장 끝 쉼이 0.2~0.35초로 거의 같다). 강의용으로는 이대로 쓴다(사용자 결정 2026-10-21).
- **Typecast(강사용):** `reelmill/.env` 에 `NARRATION_ENGINE=typecast` 가 있을 때만, 또는 사용자가 「Typecast로」라고 할 때만 쓴다. 맥에서 사내 `~/Documents/Shorts_Automation` 의 자동화 크롬·저장된 프로젝트(필재 · 1.1배속)를 쓰는 시험판이다.

## 준비 (처음 한 번)

`reelmill/.env` 에 (키 값은 화면에 찍지 않는다)
- `ELEVENLABS_API_KEY` — 일레븐랩스 키
- `ELEVENLABS_VOICE_ID` — 쓸 목소리 ID. 모르면 `uv run .claude/skills/shorts-narration/scripts/elevenlabs.py work/episodes/<폴더> --voices` 로 내 계정 목소리 목록을 보여 주고 고르게 한다.

## 1. 읽기본 만들기 — Typecast 일 때만 (글자 안 씀)

```bash
uv run .claude/skills/shorts-narration/scripts/make_reading.py work/episodes/<폴더>
```

- script.md 의 「## 대본」 절을 읽어 숫자·기호를 소리 나는 대로 바꾼다(「529그램」→「오백이십구 그램」). script.md 는 그대로 둔다 — 자막에는 숫자가 보여야 한다.
- 규칙은 `rules/reading-rules.md`(단위·기호·약어·낱말 목록), 엔진은 `scripts/readingform.py`. 읽기가 틀리면 규칙 파일에 한 줄 고친다.
- 한 줄로 저장한다. 어색한 읽기(예: 「3시간」→「삼 시간」, 영어 약어)가 눈에 띄면 내가 먼저 reading.txt 를 고치고 고친 자리를 밝힌다.

## 2. 확인 (글자 안 씀)

- 일레븐랩스: `uv run .claude/skills/shorts-narration/scripts/elevenlabs.py work/episodes/<폴더> --check` — 들 글자·남은 글자
- Typecast: `uv run .claude/skills/shorts-narration/scripts/typecast_web.py work/episodes/<폴더> --dry-run` — 입력칸에 넣어 글자 대조 후 비움, 목소리·속도·남은 크레딧

**여기서 한 번 멈춘다.** (Typecast 면 바뀐 자리 목록) · 들 글자 · 남은 글자(크레딧) · 목소리를 보여 주고 생성 허락을 묻는다. 사용자가 읽기를 고치라고 하면 reading.txt 를 고치고 2를 다시 한다.

## 3. 생성하고 받기 (글자·크레딧 씀)

- 일레븐랩스: `uv run .claude/skills/shorts-narration/scripts/elevenlabs.py work/episodes/<폴더> --generate` (모델 eleven_v4 · 보낸 글을 화면에 보여 준다)
- Typecast: `uv run .claude/skills/shorts-narration/scripts/typecast_web.py work/episodes/<폴더> --generate`
- `narration.mp3` 로 저장하고 실제 길이(초)를 잰다. 결과를 사용자에게 보내 듣게 하고, 실제 길이를 script.md 머리말 「상태」 줄에 적는다.
- 금메달 실측: Typecast 필재 1.1배(읽기본 543자) 61.6초 · 일레븐랩스 우동탄 한국어 버전 차분, eleven_v4, 속도 1.0(530자) 66.1초.

## 결과물

```
work/episodes/<폴더>/
├─ script.md       ← 1단계
├─ reading.txt     ← 읽기본 (Typecast 일 때만)
└─ narration.mp3   ← 나레이션
```

## 넘어가기 전 점검

- [ ] 생성 전에 사용자에게 글자·크레딧(Typecast 면 바뀐 자리도)을 보여 주고 허락을 받았는가
- [ ] 사용자가 나레이션을 들어 보고 어색한 읽기가 없다고 했는가
- [ ] 실제 길이를 script.md 에 적었는가

통과하면 `/groq-timing` 으로 넘어간다.
