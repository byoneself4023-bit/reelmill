import { Composition, Still } from "remotion";
import { Episode } from "./episode/Episode";
import { Longform } from "./episode/Longform";
import { LongCover } from "./episode/LongCover";
import { Cover } from "./episode/Cover";
import { Draft } from "./drafts/Draft";
import { Board, boardSize } from "./drafts/Board";
import { Showcase, SHOWCASE_SECONDS } from "./showcase/Showcase";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Still
        id="Draft"
        component={Draft}
        width={1080}
        height={1920}
        defaultProps={{
          theme: "note",
          masthead: "2024 파리 올림픽 금메달",
          page: "1/11",
          headline: [
            [{ t: "금메달 529g," }],
            [{ t: "진짜 금은 " }, { t: "6g", em: true }, { t: "뿐" }],
          ],
          layout: { kind: "shift", from: "529g", to: "6g", label: "진짜 금" },
          box: { title: "비교", text: "500원짜리 동전 하나보다 가볍다" },
          caption: "그중 진짜 금은 6그램뿐입니다",
          source: "자료: AP·NPR (2024)",
        }}
      />
      <Still
        id="Board"
        component={Board}
        width={1350}
        height={2160}
        defaultProps={{
          dir: "",
          themes: ["assay", "auction", "poster"],
          scenes: ["s1", "s2"],
        }}
        calculateMetadata={({ props }) => boardSize(props)}
      />
      <Still
        id="Cover"
        component={Cover}
        width={1080}
        height={1920}
        defaultProps={{
          theme: "assay",
          masthead: "",
          text: "첫 화면 문구",
          title: "제목",
        }}
      />
      <Composition
        id="Episode"
        component={Episode}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={300}
        defaultProps={{
          theme: "assay",
          masthead: "",
          audio: "",
          duration: 10,
          scenes: [],
          captions: [],
        }}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.ceil(props.duration * 30),
        })}
      />
      <Still
        id="LongCover"
        component={LongCover}
        width={1280}
        height={720}
        defaultProps={{
          theme: "assay",
          masthead: "",
          title: "제목",
          text: "첫 장면 제목",
        }}
      />
      <Composition
        id="Longform"
        component={Longform}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={300}
        defaultProps={{
          theme: "assay",
          masthead: "",
          audio: "",
          duration: 10,
          scenes: [],
          captions: [],
          chapters: [],
        }}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.ceil(props.duration * 30),
        })}
      />
      <Composition
        id="Showcase"
        component={Showcase}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={SHOWCASE_SECONDS * 30}
        defaultProps={{ intro: { minutes: 0, approvals: 0, fixes: 0 }, speed: 1, replay: 124, stages: [], lines: [], notice: "",
          zoneFacts: [], scriptLines: [], blogLines: [], excelLines: [], date: "",
          title: "예시 구역 · 공고문 한 장에서 영상·블로그까지", runLabel: "zone.py 실행 기록 — 예시 구역", excelName: "예시 구역 분담금 계산기.xlsx", sourceLabel: "원문(공고문)" }}
      />
    </>
  );
};
