import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Theme } from "../drafts/themes";
import { Appear, EASE } from "./Episode";

// 카드형 장면 두 가지 — 값·라벨은 모두 plan.json 이 준다(이 파일에 숫자를 적지 않는다).
// 폭은 쇼츠 본문·롱폼 오른쪽 칸과 같은 864, 높이는 약 560 안.

export type WaterfallLayout = {
  kind: "waterfall";
  title?: string;
  // 시작 → 곱하기 → 목표, 세 막대는 0부터 amount 까지
  bars: {
    label: string;
    note?: string;
    value: string;
    amount: number;
    at: number;
  }[];
  // 차이 막대: 둘째 막대 높이와 셋째 막대 높이 사이. 셋째가 크면(더 냄) 빨강, 작으면(돌려받음) 초록
  diff: { label: string; note?: string; value: string; at: number };
  foot?: string;
};

export type HeatmapLayout = {
  kind: "heatmap";
  colLabel: string; // 가로 머리 이름(단위 포함)
  rowLabel: string; // 세로 머리 이름(단위 포함)
  cols: string[];
  rows: string[];
  // 칸마다 큰 글자(text)와 작은 글자(note). v 는 색 구간을 정하는 값(예: 비율)
  cells: { v: number; text: string; note?: string }[][];
  base?: [number, number]; // 노란 테두리 칸 [행, 열]
  bands?: { min: number; label: string }[]; // 위에서부터 큰 값 → 작은 값. 색은 순서대로
  baseLabel?: string; // 범례의 노란 테두리 설명
  at: number;
  // 쇼츠 줌인: 그 문장에서 그 칸으로 다가간다(첫 항목에서 확대, 다음 항목들은 옆으로 이동)
  focus?: { at: number; cell: [number, number] }[];
};

const PAY = "#C0392B";
const REFUND = "#1E8E5A";
const BAND_COLORS = ["#0B7A6C", "#1D4ED8", "#B45309", "#BE123C"];
const KEY = "#F5C518";
const TAG: React.CSSProperties = {
  position: "absolute",
  zIndex: 2,
  padding: "4px 10px",
  borderRadius: 6,
  background: "rgba(20, 24, 33, 0.88)",
  color: "#FFFFFF",
  fontSize: 22,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const useK = (sec: number, len = 0.6) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return interpolate(frame, [sec * fps, (sec + len) * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
};

const Bar: React.FC<{
  lo: number;
  hi: number;
  top: number;
  color: string;
  k: number;
  h: number;
}> = ({ lo, hi, top, color, k, h }) => {
  const y0 = (lo / top) * h;
  const full = ((hi - lo) / top) * h;
  return (
    <div
      style={{
        position: "absolute",
        left: 14,
        right: 14,
        bottom: y0,
        height: full * k,
        background: color,
        borderRadius: 4,
      }}
    />
  );
};

export const WaterfallView: React.FC<{
  th: Theme;
  l: WaterfallLayout;
  t0: number;
}> = ({ th, l, t0 }) => {
  const H = 260; // 막대 영역 높이(9:16 본문 칸에도 들어가게)
  const [b1, b2, b3] = l.bars;
  const top = Math.max(...l.bars.map((b) => b.amount)) * 1.25;
  const pay = b3.amount >= b2.amount;
  const k = [useK(b1.at - t0), useK(b2.at - t0), useK(b3.at - t0)];
  const kd = useK(l.diff.at - t0);
  const cols = [
    { ...b1, lo: 0, hi: b1.amount, color: th.dim, k: k[0] },
    { ...b2, lo: 0, hi: b2.amount, color: th.accent, k: k[1] },
    { ...b3, lo: 0, hi: b3.amount, color: th.sub, k: k[2] },
    {
      ...l.diff,
      lo: Math.min(b2.amount, b3.amount),
      hi: Math.max(b2.amount, b3.amount),
      color: pay ? PAY : REFUND,
      k: kd,
    },
  ];
  return (
    <div style={{ fontFamily: th.body, textAlign: "left", width: 864 }}>
      {l.title ? (
        <div
          style={{
            fontSize: 34,
            fontWeight: 700,
            color: th.sub,
            paddingBottom: 10,
            borderBottom: `${th.box.width + 1}px solid ${th.rule}`,
          }}
        >
          {l.title}
        </div>
      ) : null}
      <div
        style={{
          position: "relative",
          height: H + 92,
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          marginTop: 10,
        }}
      >
        {/* 둘째 막대 높이 점선 — 차이 막대가 거기서 시작한다 */}
        <div
          style={{
            position: "absolute",
            left: "25%",
            right: 0,
            bottom: (b2.amount / top) * H,
            borderTop: `3px dashed ${th.accent}`,
            opacity: 0.55 * k[1],
          }}
        />
        {cols.map((c, i) => (
          <div key={i} style={{ position: "relative", height: H + 92 }}>
            <Bar lo={c.lo} hi={c.hi} top={top} color={c.color} k={c.k} h={H} />
            <div
              style={{
                position: "absolute",
                left: -6,
                right: -6,
                // 차이 막대가 위로 붙으면(더 냄) 위 끝이 셋째 막대와 같은 높이라 값이 겹친다 → 막대 아래에 쓴다
                bottom:
                  i === 3 && pay ? (c.lo / top) * H - 44 : (c.hi / top) * H + 8,
                textAlign: "center",
                opacity: c.k,
                fontFamily: th.num,
                fontWeight: th.numWeight,
                fontSize: 30,
                lineHeight: 1.05,
                letterSpacing: -1,
                color: i === 3 ? c.color : th.ink,
                whiteSpace: "nowrap",
              }}
            >
              {c.value}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          borderTop: `2px solid ${th.rule}`,
          paddingTop: 10,
          textAlign: "center",
        }}
      >
        {cols.map((c, i) => (
          <div
            key={i}
            style={{ opacity: Math.max(0.25, c.k), padding: "0 4px" }}
          >
            <div
              style={{
                fontSize: 27,
                fontWeight: 700,
                color: th.ink,
                lineHeight: 1.15,
              }}
            >
              {c.label}
            </div>
            {c.note ? (
              <div style={{ fontSize: 22, color: th.sub, marginTop: 4 }}>
                {c.note}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      {l.foot ? (
        <Appear
          at={l.diff.at - t0}
          rise={10}
          style={{ fontSize: 26, color: th.sub, marginTop: 14 }}
        >
          {l.foot}
        </Appear>
      ) : null}
    </div>
  );
};

const bandIndex = (v: number, bands?: HeatmapLayout["bands"]) => {
  if (!bands || !bands.length) return 1;
  const i = bands.findIndex((b) => v >= b.min);
  return i < 0 ? bands.length - 1 : i;
};

export const HeatmapView: React.FC<{
  th: Theme;
  l: HeatmapLayout;
  t0: number;
}> = ({ th, l, t0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps + t0;
  const show = useK(l.at - t0, 0.5);
  const W = 864;
  const HEAD_W = 150;
  const HEAD_H = 46;
  const nC = l.cols.length;
  const nR = l.rows.length;
  const cw = (W - HEAD_W) / nC;
  const ch = Math.min(74, 370 / nR); // 9:16 본문 칸에도 범례까지 들어가게
  const gridH = HEAD_H + ch * nR;

  // 줌: 초점 목록을 시간순으로 이어 간다. 첫 초점 전에는 표 전체(배율 1)
  const center = (cell: [number, number]) => [
    HEAD_W + cw * (cell[1] + 0.5),
    HEAD_H + ch * (cell[0] + 0.5),
  ];
  let scale = 1;
  let cx = W / 2;
  let cy = gridH / 2;
  const focus = l.focus ?? [];
  if (focus.length) {
    const Z = 1.8; // 초점 칸 둘레 칸까지 통째로 들어오게
    const ease = (a: number) =>
      interpolate(t, [a, a + 0.7], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: EASE,
      });
    const k0 = ease(focus[0].at);
    const [fx, fy] = center(focus[0].cell);
    scale = 1 + (Z - 1) * k0;
    cx = W / 2 + (fx - W / 2) * k0;
    cy = gridH / 2 + (fy - gridH / 2) * k0;
    for (let i = 1; i < focus.length; i++) {
      const ki = ease(focus[i].at);
      const [px, py] = center(focus[i - 1].cell);
      const [nx, ny] = center(focus[i].cell);
      cx += (nx - px) * ki;
      cy += (ny - py) * ki;
    }
  }
  const tx = W / 2 - cx * scale;
  const ty = gridH / 2 - cy * scale;
  const cur = focus.filter((f) => t >= f.at).slice(-1)[0];
  // 초점 칸 꼬리표: 지금 초점 칸의 화면 위치(카메라를 따라 움직인다)
  const colName = l.colLabel.replace(/\(.*\)/, "").trim();
  const rowName = l.rowLabel.replace(/\(.*\)/, "").trim();
  const headK = interpolate(scale, [1, 1.3], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tag =
    cur && scale > 1.05
      ? {
          i: cur.cell[0],
          j: cur.cell[1],
          x: (HEAD_W + cw * cur.cell[1]) * scale + tx,
          y: (HEAD_H + ch * cur.cell[0]) * scale + ty,
          w: cw * scale,
          h: ch * scale,
          k: interpolate(scale, [1.05, 1.6], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }
      : null;

  return (
    <div
      style={{
        fontFamily: th.body,
        textAlign: "left",
        width: W,
        opacity: show,
      }}
    >
      <div style={{ fontSize: 26, color: th.sub, marginBottom: 10 }}>
        가로 <b style={{ color: th.ink }}>{l.colLabel}</b> · 세로{" "}
        <b style={{ color: th.ink }}>{l.rowLabel}</b>
      </div>
      <div
        style={{
          position: "relative",
          width: W,
          height: gridH,
          overflow: "hidden",
          borderRadius: 8,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: W,
            height: gridH,
            transformOrigin: "0 0",
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          }}
        >
          {l.cols.map((c, j) => (
            <div
              key={c}
              style={{
                position: "absolute",
                left: HEAD_W + cw * j,
                top: 0,
                width: cw,
                height: HEAD_H,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                fontWeight: 700,
                color: l.base && l.base[1] === j ? th.accent : th.sub,
                opacity: headK,
              }}
            >
              {c}
            </div>
          ))}
          {l.rows.map((r, i) => (
            <React.Fragment key={r}>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: HEAD_H + ch * i,
                  width: HEAD_W - 10,
                  height: ch,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  fontSize: 24,
                  fontWeight: 700,
                  color: l.base && l.base[0] === i ? th.accent : th.sub,
                  opacity: headK,
                }}
              >
                {r}
              </div>
              {l.cells[i].map((c, j) => {
                const isBase = !!l.base && l.base[0] === i && l.base[1] === j;
                const isCur =
                  !!cur && cur.cell[0] === i && cur.cell[1] === j && !isBase;
                // 확대 중 화면에 반쯤만 걸친 칸은 흐리게(잘린 숫자가 눈에 띄지 않게)
                const sx = (HEAD_W + cw * j) * scale + tx;
                const sy = (HEAD_H + ch * i) * scale + ty;
                const inside =
                  sx >= -2 &&
                  sy >= -2 &&
                  sx + cw * scale <= W + 2 &&
                  sy + ch * scale <= gridH + 2;
                return (
                  <div
                    key={j}
                    style={{
                      position: "absolute",
                      left: HEAD_W + cw * j + 3,
                      top: HEAD_H + ch * i + 3,
                      width: cw - 6,
                      height: ch - 6,
                      borderRadius: 6,
                      background:
                        BAND_COLORS[
                          bandIndex(c.v, l.bands) % BAND_COLORS.length
                        ],
                      outline: isBase
                        ? `5px solid ${KEY}`
                        : isCur
                          ? "5px solid #FFFFFF"
                          : undefined,
                      outlineOffset: -5,
                      opacity: scale > 1.05 && !inside ? 0.3 : 1,
                      color: "#FFFFFF",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      lineHeight: 1.05,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: th.num,
                        fontWeight: 800,
                        fontSize: 27,
                        letterSpacing: -1,
                      }}
                    >
                      {c.text}
                    </span>
                    {c.note ? (
                      <span
                        style={{ fontSize: 17, opacity: 0.9, marginTop: 4 }}
                      >
                        {c.note}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
        {/* 확대 중에는 초점 칸의 열·행 머리를 칸 바로 위·왼쪽에 꼬리표로 붙인다(머리 줄이 화면 밖으로 나가도 보이게) */}
        {tag ? (
          <div
            style={{
              ...TAG,
              left: Math.min(Math.max(tag.x + tag.w / 2 - 280, 4), W - 564),
              top: tag.y - 46 >= 4 ? tag.y - 46 : tag.y + tag.h + 8,
              width: 560,
              textAlign: "center",
              opacity: tag.k,
            }}
          >
            {colName} {l.cols[tag.j]} · {rowName} {l.rows[tag.i]}
          </div>
        ) : null}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px 18px",
          marginTop: 12,
          fontSize: 22,
          color: th.sub,
        }}
      >
        {(l.bands ?? []).map((b, i) => (
          <span
            key={b.label}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 3,
                background: BAND_COLORS[i % BAND_COLORS.length],
              }}
            />
            {b.label}
          </span>
        ))}
        {l.base && l.baseLabel ? (
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: 3,
                outline: `3px solid ${KEY}`,
                outlineOffset: -3,
              }}
            />
            {l.baseLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
};
