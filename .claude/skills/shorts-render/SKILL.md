---
name: shorts-render
description: "쇼츠 5단계 — 조립·렌더. 4단계에서 고른 스타일로 대본 전체의 장면을 짜고(render/plan.json), 문장 시각에 맞춰 숫자·글이 나타나게 Remotion 으로 조립해 나레이션·자막을 얹은 video.mp4 를 만든다. /shorts-render 로 부른다. 폴더 이름(예: gold-medal)은 생략하면 가장 최근 에피소드를 쓴다."
---

# 조립·렌더

입력: `work/episodes/<폴더>/` 의 `script.md`(대본·팩트체크) · `narration.mp3` · `sentences.json` · `drafts/drafts.json`(고른 스타일 `chosen`)
- 폴더 이름을 안 주면 가장 최근에 바뀐 에피소드를 고르고 한 줄로 밝힌다.

결과: `work/episodes/<폴더>/video.mp4` (1080×1920, 30fps), `cover.png`(커버 — 첫 화면 문구를 고른 스타일로, 영상에는 넣지 않고 스튜디오에서 커버로 올린다), `render/plan.json`(장면 설계), `render/props.json`(렌더에 쓴 값), `render/check/NN.png`(장면별 점검 화면)

멈추는 곳은 한 번 — 영상을 보내 확인받을 때. 렌더(약 2분)는 크레딧이 들지 않는다.

## 준비

- 4단계와 같은 Remotion 작업실 `reelmill/remotion` (Composition 「Episode」 = `src/episode/Episode.tsx`, 스타일은 `src/drafts/themes.ts`). 영상마다 생기지 않는다. 렌더할 때 `--public-dir` 로 에피소드 폴더를 열어 나레이션을 읽으므로 remotion 쪽에 파일이 쌓이지 않는다.
- Remotion 은 직원 4명 이상 회사면 유료 라이선스가 필요하다(3명까지 무료).

## 1. 장면 설계 — render/plan.json (내가 쓴다)

대본을 읽고 장면을 짠다. 기준 스타일 「신문 지면·실무 노트」처럼 **장면 종류를 고르고 칸만 채운다** — 그림은 그리지 않는다.

- 장면 하나 = 문장 1~8개, 5~10초. 문장 범위는 1번부터 끝까지 빠짐·겹침 없이 이어져야 한다(어기면 스크립트가 멈춘다).
- 장면 종류(`layout.kind`):

| 종류 | 화면 | 칸 |
|---|---|---|
| `number` | 큰 숫자 하나 + 라벨 | value · label · at |
| `shift` | 숫자가 바뀜(앞 숫자에 줄 → 새 숫자, 스타일에 도장이 있으면 찍힘) | from · to · label · at · toAt(새 숫자를 말하는 문장, 없으면 at 직후) |
| `statement` | 큰 글 두세 줄. 낱말 바꾸기 가능(`swap`·`swapAt`) | lines · at |
| `checks` | 체크 항목이 하나씩 | items[{text, at}] |
| `parts` | 전체 막대 안 몫이 하나씩 차오름 + 줄마다 이름·값·짧은 설명 | total · parts[{name, value, weight, tone, note, at, noteAt}] |

- `at`·`noteAt`·`swapAt` 은 **문장 번호**다 — 그 문장이 시작할 때 나타난다(스크립트가 초로 바꾼다).
- 장면마다 `headline`(2줄 안), 필요하면 `box`({title, text, at}), `source`(팩트체크 표의 출처, 없으면 빈 문자열).
- 화면 숫자는 팩트체크 ✓ 값만. 대본에 없는 계산값(예: 95.5%)은 넣지 않는다.
- `theme` 은 `drafts.json` 의 `chosen`. `masthead` 는 머리글 한 줄.

## 2. 점검 화면 뽑기

```bash
uv run .claude/skills/shorts-render/scripts/make_video.py work/episodes/<폴더> --stills
```

- 장면마다 끝 무렵(모든 요소가 나온 뒤) 정지 화면을 `render/check/NN.png` 로 뽑는다.
- **내가 전부 열어 본다:** 글·상자가 출처 줄·자막과 겹치는지, 줄 긋기·도장 위치, 안전 영역(위 280 · 아래 520 · 양옆 76 · 오른쪽 140). 걸리면 plan.json(내용·줄 수) 이나 `Episode.tsx`(크기·간격)를 고쳐 다시 뽑는다.

## 3. 렌더

```bash
uv run .claude/skills/shorts-render/scripts/make_video.py work/episodes/<폴더> --render
```

- 길이 = 나레이션 + 0.4초. 자막은 대본 문장 그대로 쓰되, **숫자 바로 뒤 단위는 기호로 줄인다**(그램→g · 퍼센트→% · 미터→m · 킬로그램→kg 등, 「미터기」처럼 숫자 뒤가 아니면 그대로). 대본·나레이션은 바꾸지 않는다. 문장마다 13자·4어절 안으로 나눠 글자 수 비례로 시각을 준다(문장 끝 마침표는 뺀다).
- 렌더 뒤 몇 장면 중간 프레임을 뽑아 요소가 말과 같이 나오는지, 소리가 들어갔는지(ffmpeg volumedetect) 확인한다.
- 영상을 사용자에게 보내 확인받는다. 고칠 곳은 plan.json 을 고쳐 2·3을 다시 한다.

## 결과물

```
work/episodes/<폴더>/
├─ video.mp4          ← 완성 영상
└─ render/
   ├─ plan.json       ← 장면 설계
   ├─ props.json      ← 렌더에 쓴 값(시각 포함)
   └─ check/NN.png    ← 장면별 점검 화면
```

## 넘어가기 전 점검

- [ ] 점검 화면을 전부 열어 겹침·잘림이 없는가
- [ ] 화면 숫자가 전부 팩트체크 ✓ 값인가
- [ ] 영상 길이가 나레이션과 맞고 소리가 들어갔는가
- [ ] 사용자가 영상을 보고 확인했는가
