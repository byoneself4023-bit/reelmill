import React from "react";
import { AbsoluteFill } from "remotion";
import {
  CAPTION_FONT,
  SAFE,
  THEMES,
  ThemeKey,
  Theme,
  loadThemeFonts,
} from "./themes";

// 스타일 시안 한 장(정지 화면). 같은 장면을 스타일만 바꿔 그려 비교한다.
// 화면은 그림 없이 글·숫자·상자·막대로만 짠다(사내 신문 지면형·실무 노트형과 같은 방식).
// 장면 종류는 Episode 와 같다 — 숫자가 없는 대본은 statement·checks 로 시안을 뽑는다.

type Span = { t: string; em?: boolean };
type Shift = { kind: "shift"; from: string; to: string; label: string };
type Parts = {
  kind: "parts";
  total: string;
  parts: { name: string; value: string; weight: number }[];
};
type Statement = { kind: "statement"; lines: (Span & { swap?: string })[][] };
type Checks = { kind: "checks"; items: { text: string }[] };

export type DraftProps = {
  theme: ThemeKey;
  masthead: string; // 맨 위 머리글
  page: string; // 오른쪽 쪽수(예: 1/6)
  headline: Span[][]; // 줄마다 조각, em 은 강조
  layout: Shift | Parts | Statement | Checks;
  box?: { title?: string; text: string } | null; // 없으면 null — 미리 정한 값이 섞이지 않게
  caption: string; // 나레이션 자막(이 장면에서 들리는 문장)
  source: string; // 출처 한 줄
};

const W = 1080 - SAFE.left - SAFE.right;
const fit = (text: string, base: number, len: number) =>
  Math.round(text.length > len ? (base * len) / text.length : base);

export const Masthead: React.FC<{ th: Theme; text: string; page: string }> = ({
  th,
  text,
  page,
}) => {
  const base: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 18,
    fontFamily: th.body,
    fontSize: 34,
    fontWeight: 700,
    color: th.sub,
  };
  if (th.masthead === "tag" && th.tag)
    return (
      <div style={base}>
        <span
          style={{
            background: th.tag.bg,
            color: th.tag.ink,
            padding: "6px 16px",
            fontWeight: 900,
          }}
        >
          {th.tag.text}
        </span>
        <span style={{ color: th.tag.bg }}>{text}</span>
        <span style={{ marginLeft: "auto" }}>{page}</span>
      </div>
    );
  if (th.masthead === "doc")
    return (
      <div
        style={{
          ...base,
          paddingBottom: 14,
          borderBottom: th.mastLine ?? `6px double ${th.rule}`,
        }}
      >
        <span style={{ color: th.ink, letterSpacing: 2 }}>
          {th.mastLabel ?? "분석 성적서"}
        </span>
        <span>{text}</span>
        <span style={{ marginLeft: "auto" }}>{page ? `No. ${page}` : ""}</span>
      </div>
    );
  if (th.masthead === "lot")
    return (
      <div
        style={{
          ...base,
          justifyContent: "center",
          fontSize: 30,
          letterSpacing: 6,
          color: th.rule,
        }}
      >
        <span style={{ flex: 1, height: 2, background: th.rule }} />
        <span>
          LOT {page} · {text}
        </span>
        <span style={{ flex: 1, height: 2, background: th.rule }} />
      </div>
    );
  if (th.masthead === "bar")
    return (
      <div
        style={{
          ...base,
          background: th.ink,
          color: "#FFFFFF",
          padding: "12px 20px",
          fontWeight: 900,
        }}
      >
        <span>{text}</span>
        <span style={{ marginLeft: "auto" }}>{page}</span>
      </div>
    );
  return (
    <div
      style={{
        ...base,
        padding: "16px 0",
        borderTop: `6px solid ${th.rule}`,
        borderBottom: `2px solid ${th.rule}`,
      }}
    >
      <span style={{ color: th.ink }}>{text}</span>
      <span style={{ marginLeft: "auto" }}>{page}</span>
    </div>
  );
};

export const Headline: React.FC<{ th: Theme; lines: Span[][] }> = ({
  th,
  lines,
}) => {
  const ink = th.headInk ?? th.ink;
  const em = th.headAccent ?? th.accent;
  return (
    <div
      style={{
        fontFamily: th.head,
        fontWeight: th.headWeight,
        fontSize: th.headSize,
        lineHeight: 1.18,
        color: ink,
        letterSpacing: -1.5,
      }}
    >
      {lines.map((line, i) => (
        <div key={i}>
          <span
            style={
              th.highlight
                ? {
                    background: `linear-gradient(transparent 58%, ${th.highlight} 58%)`,
                  }
                : undefined
            }
          >
            {line.map((s, j) => (
              <span key={j} style={{ color: s.em ? em : ink }}>
                {s.t}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
};

export const Stamp: React.FC<{ th: Theme }> = ({ th }) =>
  th.stamp ? (
    <div
      style={{
        position: "absolute",
        right: 0,
        top: -95,
        width: 170,
        height: 170,
        borderRadius: "50%",
        border: `7px solid ${th.stamp.color}`,
        color: th.stamp.color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        whiteSpace: "pre-line",
        fontFamily: th.body,
        fontWeight: 700,
        fontSize: 40,
        lineHeight: 1.1,
        rotate: "-14deg",
        opacity: 0.85,
      }}
    >
      {th.stamp.text}
    </div>
  ) : null;

const ShiftView: React.FC<{ th: Theme; l: Shift }> = ({ th, l }) => (
  <div
    style={{
      position: "relative",
      fontFamily: th.num,
      fontWeight: th.numWeight,
      display: "flex",
      alignItems: "center",
      justifyContent: th.align === "center" ? "center" : "flex-start",
      gap: 28,
    }}
  >
    <span
      style={{
        fontSize: fit(l.from, 150, 4),
        color: th.dim,
        position: "relative",
        letterSpacing: -4,
        whiteSpace: "nowrap",
      }}
    >
      {l.from}
      <span
        style={{
          position: "absolute",
          left: -8,
          right: -8,
          top: "54%",
          height: 12,
          background: th.accent,
          rotate: "-6deg",
        }}
      />
    </span>
    <span style={{ fontSize: 90, color: th.ink }}>→</span>
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: th.align === "center" ? "center" : "flex-start",
      }}
    >
      <span
        style={{
          fontSize: fit(l.to, 210, 3),
          color: th.accent,
          lineHeight: 1,
          letterSpacing: -6,
          whiteSpace: "nowrap",
        }}
      >
        {l.to}
      </span>
      <span
        style={{
          fontFamily: th.body,
          fontSize: 44,
          fontWeight: 700,
          color: th.sub,
          marginTop: 8,
        }}
      >
        {l.label}
      </span>
    </div>
    <Stamp th={th} />
  </div>
);

const PartsView: React.FC<{ th: Theme; l: Parts }> = ({ th, l }) => {
  const sum = l.parts.reduce((a, p) => a + p.weight, 0);
  const center = th.align === "center";
  return (
    <div style={{ fontFamily: th.body }}>
      <div
        style={{
          fontSize: 44,
          fontWeight: 700,
          color: th.sub,
          marginBottom: 18,
        }}
      >
        {l.total}
      </div>
      <div
        style={{
          display: "flex",
          height: 120,
          border: `${th.box.width}px solid ${th.rule}`,
          boxShadow: th.box.shadow,
        }}
      >
        {l.parts.map((p, i) => (
          <div
            key={p.name}
            style={{
              width: `${(p.weight / sum) * 100}%`,
              minWidth: i === 0 ? undefined : 26,
              background: th.parts[i],
            }}
          />
        ))}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: center ? "center" : "stretch",
          gap: 4,
          marginTop: 26,
        }}
      >
        {l.parts.map((p, i) => (
          <div
            key={p.name}
            style={{ display: "flex", alignItems: "baseline", gap: 22 }}
          >
            <span
              style={{
                width: 30,
                height: 30,
                background: th.parts[i],
                border: `3px solid ${th.rule}`,
                alignSelf: "center",
              }}
            />
            <span
              style={{
                fontSize: 50,
                fontWeight: 700,
                color: th.ink,
                width: 260,
                textAlign: "left",
              }}
            >
              {p.name}
            </span>
            <span
              style={{
                fontFamily: th.num,
                fontSize: 64,
                fontWeight: th.numWeight,
                color: i === l.parts.length - 1 ? th.accent : th.ink,
              }}
            >
              {p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// 영상의 끝 무렵 모습(낱말 바꾸기는 바뀐 뒤)으로 그린다
const StatementView: React.FC<{ th: Theme; l: Statement }> = ({ th, l }) => (
  <div
    style={{
      fontFamily: th.head,
      fontWeight: th.headWeight,
      fontSize: 132,
      lineHeight: 1.15,
      color: th.ink,
      textAlign: th.align,
      letterSpacing: -3,
    }}
  >
    {l.lines.map((line, i) => (
      <div key={i}>
        {line.map((s, j) =>
          s.swap ? (
            <span key={j} style={{ display: "inline-block" }}>
              <span
                style={{ position: "relative", color: th.dim, opacity: 0.35 }}
              >
                {s.t}
                <span
                  style={{
                    position: "absolute",
                    left: -6,
                    right: -6,
                    top: "52%",
                    height: 14,
                    background: th.accent,
                  }}
                />
              </span>
              <span style={{ marginLeft: 28, color: th.accent }}>{s.swap}</span>
            </span>
          ) : (
            <span key={j} style={{ color: s.em ? th.accent : th.ink }}>
              {s.t}
            </span>
          ),
        )}
      </div>
    ))}
  </div>
);

const ChecksView: React.FC<{ th: Theme; l: Checks }> = ({ th, l }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 26,
      fontFamily: th.body,
    }}
  >
    {l.items.map((it) => (
      <div
        key={it.text}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 26,
          borderBottom: `2px solid ${th.rule}`,
          paddingBottom: 18,
        }}
      >
        <span
          style={{
            width: 64,
            height: 64,
            border: `5px solid ${th.accent}`,
            color: th.accent,
            fontSize: 52,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ✓
        </span>
        <span
          style={{
            fontFamily: th.num,
            fontSize: 76,
            fontWeight: th.numWeight,
            color: th.ink,
          }}
        >
          {it.text}
        </span>
      </div>
    ))}
  </div>
);

export const Draft: React.FC<DraftProps> = (p) => {
  const th = THEMES[p.theme];
  loadThemeFonts(th);
  const boxTitle = th.headAccent ?? (th.tag ? th.tag.bg : th.accent);
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
            height: th.band.height,
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
          textAlign: th.align,
        }}
      >
        <Masthead th={th} text={p.masthead} page={p.page} />
        <div style={{ height: 50 }} />
        <Headline th={th} lines={p.headline} />
        <div style={{ height: th.band ? 66 : 56 }} />
        {p.layout.kind === "shift" ? <ShiftView th={th} l={p.layout} /> : null}
        {p.layout.kind === "parts" ? <PartsView th={th} l={p.layout} /> : null}
        {p.layout.kind === "statement" ? (
          <StatementView th={th} l={p.layout} />
        ) : null}
        {p.layout.kind === "checks" ? (
          <ChecksView th={th} l={p.layout} />
        ) : null}
        {p.box ? (
          <div
            style={{
              marginTop: 40,
              padding: "24px 30px",
              background: th.box.bg,
              border: `${th.box.width}px ${th.box.style ?? "solid"} ${th.box.border}`,
              boxShadow: th.box.shadow,
              fontFamily: th.body,
            }}
          >
            {p.box.title ? (
              <div
                style={{
                  fontSize: 34,
                  fontWeight: 700,
                  color: boxTitle,
                  marginBottom: 6,
                }}
              >
                {p.box.title}
              </div>
            ) : null}
            <div
              style={{
                fontSize: 46,
                fontWeight: 700,
                color: th.box.ink ?? th.ink,
              }}
            >
              {p.box.text}
            </div>
          </div>
        ) : null}
      </div>
      {/* 출처 */}
      <div
        style={{
          position: "absolute",
          left: SAFE.left,
          top: SAFE.caption - 90,
          width: W,
          textAlign: th.align,
          fontFamily: th.body,
          fontSize: 26,
          color: th.sub,
        }}
      >
        {p.source}
      </div>
      {/* 자막 — 스타일과 상관없이 고딕 */}
      <div
        style={{
          position: "absolute",
          left: SAFE.left,
          top: SAFE.caption,
          width: W,
          textAlign: "center",
          fontFamily: CAPTION_FONT,
          fontSize: 56,
          fontWeight: 900,
          color: th.ink,
          lineHeight: 1.3,
          wordBreak: "keep-all",
        }}
      >
        {p.caption}
      </div>
    </AbsoluteFill>
  );
};
