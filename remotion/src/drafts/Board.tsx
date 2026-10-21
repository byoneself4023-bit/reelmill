import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { THEMES, ThemeKey } from "./themes";

// 비교판 — 스타일(가로) × 장면(세로) 정지 화면을 한 장에 모은다.
export type BoardProps = {
  dir: string; // 그림이 있는 폴더 안 하위 경로. 보통 "" — 렌더할 때 --public-dir 로 에피소드 drafts 폴더를 바로 가리킨다
  themes: ThemeKey[];
  scenes: string[]; // 장면 이름(파일: <dir>/<theme>-<scene>.png)
};

const CELL_W = 400;
const CELL_H = Math.round((CELL_W * 1920) / 1080);

export const boardSize = (p: BoardProps) => ({
  width: 60 + p.themes.length * (CELL_W + 30),
  height: 130 + p.scenes.length * (CELL_H + 30),
});

export const Board: React.FC<BoardProps> = ({ dir, themes, scenes }) => (
  <AbsoluteFill
    style={{ background: "#2A2A2A", padding: 30, fontFamily: THEMES.note.body }}
  >
    <div style={{ display: "flex", gap: 30, marginLeft: 0 }}>
      {themes.map((t, i) => (
        <div
          key={t}
          style={{
            width: CELL_W,
            color: "#FFF",
            fontSize: 40,
            fontWeight: 900,
          }}
        >
          {String.fromCharCode(65 + i)}. {THEMES[t].name}
        </div>
      ))}
    </div>
    {scenes.map((s) => (
      <div key={s} style={{ display: "flex", gap: 30, marginTop: 30 }}>
        {themes.map((t) => (
          <Img
            key={t}
            src={staticFile(`${dir ? dir + "/" : ""}${t}-${s}.png`)}
            style={{ width: CELL_W, height: CELL_H }}
          />
        ))}
      </div>
    ))}
  </AbsoluteFill>
);
