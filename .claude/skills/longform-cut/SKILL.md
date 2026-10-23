---
name: longform-cut
description: "롱폼에서 쇼츠 잘라내기. 다 만든 롱폼 에피소드(16:9)의 장 하나나 문장 범위를 골라, 같은 나레이션 구간·같은 자막 맞추기 결과·같은 장면 설계로 9:16 쇼츠 폴더를 만들고 렌더한다. 나레이션을 새로 만들지 않아 크레딧이 들지 않는다. /longform-cut 으로 부르고 롱폼 폴더 이름을 쓴다."
---

# 롱폼에서 쇼츠 잘라내기

흐름은 「롱폼 먼저, 쇼츠는 잘라서」다. 롱폼 대본을 쓸 때 장마다 「쇼츠로 잘라 쓸 구간」을 정해 두고(`shorts-script` 1-4), 롱폼 나레이션·자막 맞추기·장면 설계가 끝난 뒤 이 스킬로 잘라 낸다.

입력: `work/episodes/<롱폼 폴더>/` 의 `script.md`(`### N장.` 장 제목과 「## 쇼츠로 잘라 쓸 구간」) · `narration.mp3` · `sentences.json` · `render/plan.json`
결과: `work/episodes/<롱폼 폴더>/cuts/<이름>/` — 보통 쇼츠 에피소드와 같은 모양(`script.md` · `narration.mp3` · `sentences.json` · `render/plan.json`)이라 그다음은 `shorts-render` 그대로다.

멈추지 않는다. 영상을 보낼 때만 확인받는다.

## 1. 구간 보기

```bash
uv run .claude/skills/longform-cut/scripts/cut.py list work/episodes/<롱폼 폴더>
```

- 장마다 문장 번호·글자 수·실제 길이(나레이션 뒤면 실측), 문장마다 롱폼 안 시각, 그리고 script.md 의 「쇼츠로 잘라 쓸 구간」 표를 보여 준다.
- 구간 길이는 쓰는 목표 40~75초, 90초를 넘으면 멈춘다(유튜브 쇼츠는 3분까지 되지만 호흡이 늘어진다). 첫 문장이 앞 내용 없이 시작되는지(「그런데」「이」「그」로 시작하지 않는지) 한 번 더 본다. 걸리면 구간 시작을 한두 문장 옮긴다.

## 2. 잘라 내기

```bash
uv run .claude/skills/longform-cut/scripts/cut.py make work/episodes/<롱폼 폴더> --range 31-50 --name <영문 짧은 이름> --title "쇼츠 제목" --screen "첫 화면 문구"
uv run .claude/skills/longform-cut/scripts/cut.py make work/episodes/<롱폼 폴더> --chapter 2 --name <이름>   # 장 하나 통째로
```

- 나레이션: 롱폼 `narration.mp3` 에서 첫 문장 시작 0.15초 앞 ~ 끝 문장 끝 0.35초 뒤를 잘라 낸다(앞뒤 문장 소리는 넘지 않는다). 새로 읽히지 않으므로 목소리·억양이 롱폼과 같다.
- 자막 맞추기 결과: 롱폼 `sentences.json` 을 구간 시작 0초 기준으로 당기고 번호를 1부터 다시 매긴다(`long_no` 에 롱폼 번호).
- 장면 설계: 롱폼 `render/plan.json` 에서 구간에 걸친 장면만 잘라 옮긴다. 장면 종류·칸은 쇼츠와 같으므로 9:16 에서도 그대로 그려진다. 잘린 폴더에 plan.json 이 이미 있으면 두고(`--force` 면 새로), 다른 스타일로 하려면 `--theme`.
- `--tighten`: 구간 안 문장 사이 0.3초 넘는 무음을 0.25초로 줄여 붙인다(이음새마다 10ms 페이드, 문장별 시각·자막도 같이 당김). 쇼츠는 호흡이 빠르게, 롱폼은 그대로. 자동으로 만드는 흐름에서는 기본으로 켠다.
- 롱폼 장면 항목 중 구간 앞에서 이미 나온 것은 쇼츠 첫 문장에 바로 보이고, 구간 뒤(쇼츠에서 말하지 않는 것)의 목록 항목·상자는 빼고 `[경고]` 를 찍는다.
- **첫 장면은 꼭 다시 본다.** 롱폼에서는 앞 장면을 이어받던 제목이 쇼츠 첫 화면이 된다. 앞 내용 없이 읽히도록 `cuts/<이름>/render/plan.json` 의 첫 장면 `headline` 을 고친다.
- `--screen` 을 주지 않으면 구간 첫 장면 제목을 첫 화면 문구로 써서 커버(`cover.png`)가 늘 생긴다.
- 제목·첫 화면 문구는 쇼츠용으로 따로 쓴다(`shorts-script` 3절 기준). 업로드 문구는 `shorts-upload` 를 잘린 폴더에 그대로 쓴다.

## 3. 점검·렌더 (9:16)

```bash
uv run .claude/skills/shorts-render/scripts/make_video.py work/episodes/<롱폼 폴더>/cuts/<이름> --stills
uv run .claude/skills/shorts-render/scripts/make_video.py work/episodes/<롱폼 폴더>/cuts/<이름> --render
```

- 점검 화면 기준은 `shorts-render` 와 같다(안전 영역 위 280 · 아래 520 · 양옆 76 · 오른쪽 140, 글·상자와 출처 줄·자막 겹침).
- 소리 확인: 첫 문장 첫 음절이 잘리지 않았는지, 끝에 다음 문장 소리가 묻어나지 않았는지 처음·끝 2초를 들어 본다.

## 넘어가기 전 점검

- [ ] 구간 첫 문장이 앞 내용 없이 시작되는가
- [ ] 첫 장면 제목을 쇼츠용으로 고쳤는가
- [ ] 점검 화면을 전부 열어 겹침·잘림이 없는가
- [ ] 처음·끝 소리가 잘리거나 묻어나지 않는가
