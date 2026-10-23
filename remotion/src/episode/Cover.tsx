import React from "react";
import { AbsoluteFill } from "remotion";
import { SAFE, THEMES, ThemeKey, loadThemeFonts } from "../drafts/themes";
import { Masthead } from "../drafts/Draft";

// 커버(썸네일) 한 장 — 첫 화면 문구를 고른 스타일로 크게. 영상에는 넣지 않고 스튜디오에서 커버로 올린다(9:16).
export type CoverProps = {
  theme: ThemeKey;
  masthead: string;
  mastLabel?: string; // 스타일 머리글 이름을 이 영상에서만 바꿀 때
  text: string; // 첫 화면 문구
  title: string; // 고른 제목(작게)
};

const W = 1080 - SAFE.left - SAFE.right;

export const Cover: React.FC<CoverProps> = ({
  theme,
  masthead,
  mastLabel,
  text,
  title,
}) => {
  const th = mastLabel ? { ...THEMES[theme], mastLabel } : THEMES[theme];
  loadThemeFonts(th);
  const n = text.replace(/\s/g, "").length;
  const size = n <= 6 ? 190 : n <= 9 ? 160 : 130;
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
            width: 1080,
            height: 1920 * 0.55,
            background: th.band.color,
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          left: SAFE.left,
          top: SAFE.top,
          width: W,
        }}
      >
        <Masthead th={th} text={masthead} page="" />
      </div>
      <div
        style={{
          position: "absolute",
          left: SAFE.left,
          top: 520,
          width: W,
          textAlign: th.align,
          fontFamily: th.head,
          fontWeight: th.headWeight,
          fontSize: size,
          lineHeight: 1.12,
          letterSpacing: -4,
          color: th.band ? (th.headInk ?? th.ink) : th.accent,
          wordBreak: "keep-all",
          textWrap: "balance",
        }}
      >
        {text}
      </div>
      <div
        style={{
          position: "absolute",
          left: SAFE.left,
          top: 1180,
          width: W,
          textAlign: th.align,
          fontFamily: th.body,
          fontSize: 52,
          fontWeight: 700,
          color: th.ink,
          lineHeight: 1.3,
          wordBreak: "keep-all",
        }}
      >
        {title}
      </div>
    </AbsoluteFill>
  );
};
