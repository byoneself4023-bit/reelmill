---
name: shorts-style-drafts
description: "쇼츠 4단계 — 스타일 시안. 대본에 어울리는 화면 스타일 3개를 골라, 같은 장면 2개를 스타일만 바꿔 정지 화면 6장과 비교판(board.png)으로 보여 주고 하나를 고르게 한다. /shorts-style-drafts 로 부른다. 폴더 이름(예: gold-medal)은 생략하면 가장 최근 에피소드를 쓴다."
---

# 스타일 시안

입력: `work/episodes/<폴더>/script.md` (대본·팩트체크)
- 폴더 이름을 안 주면 `work/episodes/` 에서 가장 최근에 바뀐 폴더를 고르고 한 줄로 밝힌다.

결과: `work/episodes/<폴더>/drafts/` — `drafts.json`(시안 설계 + 고른 스타일), `<스타일>-<장면>.png` 6장, `board.png`(비교판)

멈추는 곳은 한 번 — 비교판을 보여 주고 고르게 할 때.

## 준비 (처음 한 번)

- Remotion 작업실 `reelmill/remotion` 이 있어야 한다. 모든 영상이 함께 쓰는 폴더 하나다(영상마다 생기지 않는다). 4단계 시안과 5단계 렌더가 같이 쓴다.
  - 없으면: `npx create-video@latest --yes --blank --no-tailwind remotion` → `cd remotion && npm i && npx remotion add @remotion/google-fonts`, 그리고 `src/drafts/`(themes.ts · Draft.tsx · Board.tsx)와 `src/Root.tsx` 를 넣는다.
- 그림 파일은 에피소드 폴더에만 생긴다. 비교판도 `--public-dir` 로 에피소드 `drafts` 폴더를 바로 읽으므로 remotion 쪽에는 아무것도 쌓이지 않는다.

## 화면 원칙 (모든 스타일 공통)

- **그림 없이 글·숫자·상자·막대로만 짠다.** 사내 「신문 지면형」·「실무 노트형」과 같은 방식이다. 실사가 꼭 필요하면 나중에 구글 플로우로 따로 넣는다.
- 쇼츠 안전 영역(1080×1920): 위 280 · 아래 520 · 왼쪽 76 · 오른쪽 140. 자막은 y≈1300, 스타일과 상관없이 굵은 고딕.
- 화면에 나오는 숫자는 팩트체크 ✓ 값만. 큰 숫자는 한 장면에 하나만.

## 1. 스타일 3개 고르기

- **기준 스타일 두 개(신문 지면 `paper`, 실무 노트 `note`)는 그대로 쓰지 않는다.** 파생의 출발점이다 — 머리글·제목·강조 숫자·상자·자막 자리 같은 뼈대는 이어받고, 겉모습(바탕·글꼴·색·무늬·정렬·은유)을 새로 만든다.
- 3개는 서로, 그리고 기준과도 세 가지 이상 다르게: 밝기, 글꼴 계열(고딕·명조·굵은 고딕), 바탕 무늬, 정렬, 은유.
- 대본 주제에 어울리는 은유를 고른다. 금메달 예: 성적서(금 함량 검사) · 경매 도록(값어치) · 포스터(숫자 한 방).
- 스타일은 `remotion/src/drafts/themes.ts` 의 `THEMES` 에 있다. 맞는 게 없으면 새 스타일 객체를 더한다(글꼴은 `@remotion/google-fonts` 의 한글 글꼴: NotoSansKR · NotoSerifKR · IBMPlexSansKR · GowunBatang · BlackHanSans · DoHyeon · Hahmlet · NanumMyeongjo …). 지금 있는 파생 스타일: `assay`(성적서) · `auction`(경매 도록) · `poster`(포스터).
- 고른 3개와 각각의 은유를 한 줄씩 밝힌다.

## 2. 비교할 장면 2개 정하기

- 대본에서 성격이 다른 장면 2개 — 숫자가 바뀌는 장면(`shift`) 하나, 구성·비교 장면(`parts`) 하나가 기본.
- `drafts/drafts.json` 을 쓴다:

```json
{
  "chosen": null,
  "themes": ["assay", "auction", "poster"],
  "scenes": {
    "s1": {"sentences": [1, 4], "masthead": "…", "page": "1/6",
           "headline": [[{"t": "금메달 529g,"}], [{"t": "진짜 금은 "}, {"t": "6g", "em": true}, {"t": "뿐"}]],
           "layout": {"kind": "shift", "from": "529g", "to": "6g", "label": "진짜 금"},
           "box": {"title": "비교", "text": "…"},
           "caption": "그 장면에서 들리는 대본 문장", "source": "자료: …"},
    "s2": {"sentences": [7, 14], "layout": {"kind": "parts", "total": "529g",
           "parts": [{"name": "은", "value": "505g", "weight": 505}, …]}, …}
  }
}
```

- `headline` 은 2줄 안. `box` 는 넣을 게 없으면 뺀다. `caption` 은 대본 문장 그대로, `source` 는 팩트체크 표의 출처.

## 3. 그리기

```bash
uv run .claude/skills/shorts-style-drafts/scripts/make_drafts.py work/episodes/<폴더>
```

- 6장(1080×1920)과 비교판(스타일 가로 × 장면 세로)을 만든다.
- **보여 주기 전에 내가 비교판을 직접 열어 본다.** 글·상자가 겹치는지, 출처 줄·자막과 부딪히는지, 안전 영역을 넘는지. 걸리면 간격·크기·장면 내용을 고쳐 다시 그린다.

## 4. 고르게 하기

비교판을 보내고 스타일별 은유를 한 줄씩 적어 고르게 한다. 고르면 `drafts.json` 의 `chosen` 에 스타일 키를 적고, script.md 머리말 「상태」 줄에 남긴다. 다른 방향을 원하면 1로 돌아간다.

## 결과물

```
work/episodes/<폴더>/drafts/
├─ drafts.json        ← 시안 설계 + 고른 스타일(chosen)
├─ <스타일>-s1.png …   ← 정지 화면 6장
└─ board.png          ← 비교판
```

## 넘어가기 전 점검

- [ ] 기준 스타일을 그대로 쓰지 않고 파생 3개를 그렸는가
- [ ] 겹침·잘림 없이 안전 영역 안에 들어오는가(내가 비교판을 열어 봤는가)
- [ ] 화면 숫자가 전부 팩트체크 ✓ 값인가
- [ ] 고른 스타일이 drafts.json `chosen` 에 적혔는가

통과하면 `/shorts-render` 로 넘어간다.
