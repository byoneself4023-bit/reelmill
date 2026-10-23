import React from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Audio } from "@remotion/media";
import { CAPTION_FONT, THEMES, Theme, loadThemeFonts } from "../drafts/themes";
import { Headline, Masthead } from "../drafts/Draft";
import {
  Appear,
  ChecksView,
  EpisodeProps,
  NumberView,
  PartsView,
  RowsView,
  SceneProps,
  ShiftView,
  StatementView,
} from "./Episode";
import { HeatmapView, WaterfallView } from "./Cards";

// 롱폼 한 편(1920×1080) — 쇼츠 Episode 와 같은 장면 종류·스타일을 가로 화면에 놓는다.
// 왼쪽 칸: 제목 + 상자, 오른쪽 칸: 숫자·글·체크·막대(쇼츠의 본문 폭 864 와 같아 크기를 그대로 쓴다).
// 장이 시작할 때 장 제목 카드가 잠깐 덮는다(나레이션은 계속 나온다).

export type Chapter = { no: number; title: string; start: number; end: number };
export type LongformProps = EpisodeProps & { chapters: Chapter[] };

export const LONG = {
  width: 1920,
  height: 1080,
  side: 110, // 양옆 여백
  top: 64, // 머리글
  body: 196, // 본문 시작
  leftW: 760, // 왼쪽 칸 폭
  rightX: 946, // 오른쪽 칸 시작(폭 864 → 1810)
  rightW: 864,
  source: 846, // 출처 줄
  caption: 906, // 자막
  card: 2.6, // 장 제목 카드 길이(초)
};

const LongScene: React.FC<{
  th: Theme;
  masthead: string;
  s: SceneProps;
  ch?: Chapter;
  total: number;
}> = ({ th, masthead, s, ch, total }) => {
  const t0 = s.start;
  const L = s.layout;
  const headTh = { ...th, headSize: Math.round(th.headSize * 0.88) };
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: LONG.side,
          top: LONG.top,
          width: LONG.width - LONG.side * 2,
        }}
      >
        <Masthead
          th={th}
          text={ch ? `${masthead} · ${ch.title}` : masthead}
          page={ch ? `${ch.no}/${total}` : ""}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: LONG.side,
          top: LONG.body,
          width: LONG.leftW,
          textAlign: "left",
        }}
      >
        <Appear at={0}>
          <Headline th={headTh} lines={s.headline as never} />
        </Appear>
        {s.box ? (
          <Appear
            at={s.box.at - t0}
            style={{
              marginTop: 44,
              padding: "22px 28px",
              background: th.box.bg,
              border: `${th.box.width}px ${th.box.style ?? "solid"} ${th.box.border}`,
              boxShadow: th.box.shadow,
              fontFamily: th.body,
            }}
          >
            {s.box.title ? (
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  color: th.headAccent ?? th.accent,
                  marginBottom: 6,
                }}
              >
                {s.box.title}
              </div>
            ) : null}
            <div
              style={{
                fontSize: 42,
                fontWeight: 700,
                color: th.box.ink ?? th.ink,
              }}
            >
              {s.box.text}
            </div>
          </Appear>
        ) : null}
      </div>
      <div
        style={{
          position: "absolute",
          left: LONG.rightX,
          top: LONG.body,
          width: LONG.rightW,
          height: LONG.source - LONG.body - 30,
          display: "flex",
          flexDirection: "column",
          justifyContent: "safe center", // 넘치면 위(머리글)가 아니라 아래로
          textAlign: th.align,
        }}
      >
        {L.kind === "number" ? <NumberView th={th} l={L} t0={t0} /> : null}
        {L.kind === "shift" ? <ShiftView th={th} l={L} t0={t0} /> : null}
        {L.kind === "statement" ? (
          <StatementView th={th} l={L} t0={t0} />
        ) : null}
        {L.kind === "checks" ? <ChecksView th={th} l={L} t0={t0} /> : null}
        {L.kind === "parts" ? <PartsView th={th} l={L} t0={t0} /> : null}
        {L.kind === "rows" ? <RowsView th={th} l={L} t0={t0} /> : null}
        {L.kind === "waterfall" ? (
          <WaterfallView th={th} l={L} t0={t0} />
        ) : null}
        {L.kind === "heatmap" ? <HeatmapView th={th} l={L} t0={t0} /> : null}
      </div>
      {s.source ? (
        <div
          style={{
            position: "absolute",
            left: LONG.side,
            top: LONG.source,
            width: LONG.width - LONG.side * 2,
            fontFamily: th.body,
            fontSize: 24,
            color: th.sub,
          }}
        >
          {s.source}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// 장 제목 카드 — 장 번호, 장 제목, 전체 장 목록(지금 장만 진하게)
const ChapterCard: React.FC<{
  th: Theme;
  ch: Chapter;
  chapters: Chapter[];
  len: number;
}> = ({ th, ch, chapters, len }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const k = interpolate(t, [0, 0.25, len - 0.35, len], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ink = th.band ? (th.headInk ?? th.ink) : th.ink;
  const em = th.band ? (th.headAccent ?? th.accent) : th.accent;
  return (
    <AbsoluteFill
      style={{
        opacity: k,
        background: th.band ? th.band.color : th.bg,
        backgroundImage: th.band ? undefined : th.pattern,
        backgroundSize: th.patternSize,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: LONG.side + 40,
          top: 250,
          width: LONG.width - LONG.side * 2 - 80,
        }}
      >
        <div
          style={{
            fontFamily: th.num,
            fontWeight: th.numWeight,
            fontSize: 64,
            color: em,
            letterSpacing: 2,
          }}
        >
          {ch.no}장
        </div>
        <div
          style={{
            height: th.box.width + 2,
            width: 160,
            background: em,
            margin: "22px 0 30px",
          }}
        />
        <div
          style={{
            fontFamily: th.head,
            fontWeight: th.headWeight,
            fontSize: 128,
            lineHeight: 1.12,
            letterSpacing: -2,
            color: ink,
            translate: `0px ${(1 - k) * 24}px`,
          }}
        >
          {ch.title}
        </div>
        <div
          style={{
            display: "flex",
            gap: 40,
            marginTop: 70,
            fontFamily: th.body,
            fontSize: 30,
            fontWeight: 700,
          }}
        >
          {chapters.map((c) => (
            <span
              key={c.no}
              style={{
                color: c.no === ch.no ? em : th.band ? ink : th.dim,
                opacity: c.no === ch.no ? 1 : 0.7,
              }}
            >
              {c.no}. {c.title}
            </span>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const LongCaptions: React.FC<{
  th: Theme;
  items: EpisodeProps["captions"];
}> = ({ th, items }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const c = items.find((x) => t >= x.start && t < x.end);
  return c ? (
    <div
      style={{
        position: "absolute",
        left: LONG.side,
        top: LONG.caption,
        width: LONG.width - LONG.side * 2,
        textAlign: "center",
        fontFamily: CAPTION_FONT,
        fontSize: 56,
        fontWeight: 900,
        color: th.ink,
        lineHeight: 1.3,
        wordBreak: "keep-all",
      }}
    >
      {c.text}
    </div>
  ) : null;
};

export const Longform: React.FC<LongformProps> = (p) => {
  const th = p.mastLabel
    ? { ...THEMES[p.theme], mastLabel: p.mastLabel }
    : THEMES[p.theme];
  loadThemeFonts(th);
  const { fps } = useVideoConfig();
  const chapterAt = (t: number) =>
    p.chapters.find((c) => t >= c.start - 0.01 && t < c.end);
  return (
    <AbsoluteFill
      style={{
        background: th.bg,
        backgroundImage: th.pattern,
        backgroundSize: th.patternSize,
      }}
    >
      {th.band ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: LONG.side + LONG.leftW + 40,
            height: LONG.height,
            background: th.band.color,
          }}
        />
      ) : null}
      {p.scenes.map((s, i) => (
        <Sequence
          key={i}
          from={Math.round(s.start * fps)}
          durationInFrames={Math.max(1, Math.round((s.end - s.start) * fps))}
          name={`장면 ${i + 1}`}
        >
          <LongScene
            th={th}
            masthead={p.masthead}
            s={s}
            ch={chapterAt(s.start)}
            total={p.chapters.length}
          />
        </Sequence>
      ))}
      {p.chapters.map((c) => {
        const len = Math.min(LONG.card, Math.max(1, c.end - c.start - 0.5));
        return (
          <Sequence
            key={`ch${c.no}`}
            from={Math.round(c.start * fps)}
            durationInFrames={Math.round(len * fps)}
            name={`${c.no}장 카드`}
          >
            <ChapterCard th={th} ch={c} chapters={p.chapters} len={len} />
          </Sequence>
        );
      })}
      <LongCaptions th={th} items={p.captions} />
      {p.audio ? <Audio src={staticFile(p.audio)} /> : null}
    </AbsoluteFill>
  );
};
