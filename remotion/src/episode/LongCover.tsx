import React from "react";
import { AbsoluteFill } from "remotion";
import { THEMES, ThemeKey, loadThemeFonts } from "../drafts/themes";
import { Masthead } from "../drafts/Draft";

// 롱폼 썸네일(1280×720) — 고른 제목을 크게, 첫 장면 제목을 작게. 영상에는 넣지 않고 미리보기 이미지로 올린다.
export type LongCoverProps = {
  theme: ThemeKey;
  masthead: string;
  mastLabel?: string;
  title: string; // 고른 제목(크게)
  text: string; // 첫 장면 제목(작게)
};

const SIDE = 72;

export const LongCover: React.FC<LongCoverProps> = ({
  theme,
  masthead,
  mastLabel,
  title,
  text,
}) => {
  const th = mastLabel ? { ...THEMES[theme], mastLabel } : THEMES[theme];
  loadThemeFonts(th);
  const n = title.replace(/\s/g, "").length;
  const size = n <= 14 ? 96 : n <= 22 ? 80 : 66;
  return (
    <AbsoluteFill
      style={{
        background: th.band ? th.band.color : th.bg,
        backgroundImage: th.band ? undefined : th.pattern,
        backgroundSize: th.patternSize,
      }}
    >
      <div style={{ position: "absolute", left: SIDE, right: SIDE, top: 48 }}>
        <Masthead th={th} text={masthead} page="" />
      </div>
      <div
        style={{
          position: "absolute",
          left: SIDE,
          right: SIDE,
          top: 170,
          fontFamily: th.head,
          fontWeight: th.headWeight,
          fontSize: size,
          lineHeight: 1.15,
          letterSpacing: -2,
          color: th.band ? (th.headInk ?? th.ink) : th.ink,
          wordBreak: "keep-all",
          textWrap: "balance",
        }}
      >
        {title}
      </div>
      <div
        style={{
          position: "absolute",
          left: SIDE,
          right: SIDE,
          bottom: 64,
          fontFamily: th.body,
          fontSize: 44,
          fontWeight: 700,
          color: th.band ? (th.headAccent ?? th.accent) : th.accent,
          wordBreak: "keep-all",
          borderTop: `${th.box.width + 1}px solid ${th.rule}`,
          paddingTop: 22,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
