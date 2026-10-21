# reelmill

클로드 코드로 얼굴 없는 세로 쇼츠를 만드는 단계별 스킬 모음입니다.

| 단계 | 명령 | 결과물 |
|---|---|---|
| 1 대본 | `/shorts-script` | script.md |
| 2 나레이션 | `/shorts-narration` | narration.mp3 |
| 3 문장 시각 | `/groq-timing` | sentences.json |
| 4 스타일 시안 | `/shorts-style-drafts` | drafts/ |
| 5 조립·렌더 | `/shorts-render` | video.mp4 · cover.png |
| 6 업로드 문구 | `/shorts-upload` | upload.md |
| 한 번에 | `/shorts-make` | 1~6단계를 이어서 |

## 시작하기

준비물(Claude Code · ffmpeg · uv · Node.js · Git)은 강의 노트 「준비」를 따릅니다. 파이썬은 uv 가 알아서 받습니다.

```bash
git clone <이 저장소 주소> reelmill
cd reelmill/remotion
npm install
```

`reelmill/.env.example` 을 복사해 `.env` 로 이름을 바꾸고 키를 채웁니다. 그다음 `reelmill` 폴더에서 클로드 코드를 열고 입력합니다.

```text
/shorts-make 부동산
```

결과물은 `work/episodes/<영상 이름>/` 에 생깁니다. 처음 한 번은 채널 설정 질문 다섯 개에 답하면 `channel.md` 가 생깁니다(견본: `channel.example.md`).

Remotion 은 직원 4명 이상 회사가 쓰면 유료 라이선스가 필요합니다(개인·3명 이하 무료).
