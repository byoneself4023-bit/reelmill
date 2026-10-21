import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Audio } from "@remotion/media";
import { CAPTION_FONT, SAFE, THEMES, Theme, ThemeKey } from "../drafts/themes";
import { Headline, Masthead, Stamp } from "../drafts/Draft";

// 영상 한 편 — 4단계에서 고른 스타일로 장면을 이어 붙이고 나레이션·자막을 얹는다.
// 시각은 모두 초 단위로 받는다(3단계 sentences.json 에서 make_video.py 가 계산해 넣는다).
// 요소는 「그 숫자를 말하는 문장」이 시작될 때 나타난다.

type Span = { t: string; em?: boolean; swap?: string; swapAt?: number };
type Layout =
  | { kind: "number"; value: string; label: string; at: number }
  | {
      kind: "shift";
      from: string;
      to: string;
      label: string;
      at: number;
      toAt?: number;
    }
  | { kind: "statement"; lines: Span[][]; at: number }
  | { kind: "checks"; items: { text: string; at: number }[] }
  | {
      kind: "parts";
      total: string;
      parts: {
        name: string;
        value: string;
        weight: number;
        tone?: number;
        note?: string;
        at: number;
        noteAt?: number;
      }[];
    };

export type SceneProps = {
  start: number;
  end: number;
  page: string;
  headline: Span[][];
  layout: Layout;
  box?: { title?: string; text: string; at: number } | null;
  source: string;
};

export type EpisodeProps = {
  theme: ThemeKey;
  masthead: string;
  audio: string; // 에피소드 폴더 안 파일 이름(렌더할 때 --public-dir 로 에피소드 폴더를 연다)
  duration: number; // 초
  scenes: SceneProps[];
  captions: { start: number; end: number; text: string }[];
};

const W = 1080 - SAFE.left - SAFE.right;
const fit = (text: string, base: number, len: number) =>
  Math.round(text.length > len ? (base * len) / text.length : base);
const EASE = Easing.bezier(0.16, 1, 0.3, 1);

// 장면 안 시각(초) → 나타나기 0→1
const useShow = (sec: number, len = 0.35) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return interpolate(frame, [sec * fps, (sec + len) * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
};

const Appear: React.FC<{
  at: number;
  children: React.ReactNode;
  rise?: number;
  style?: React.CSSProperties;
}> = ({ at, children, rise = 30, style }) => {
  const k = useShow(at);
  return (
    <div style={{ ...style, opacity: k, translate: `0px ${(1 - k) * rise}px` }}>
      {children}
    </div>
  );
};

const Pop: React.FC<{
  at: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ at, children, style }) => {
  const k = useShow(at, 0.45);
  return (
    <div
      style={{ ...style, opacity: k, scale: interpolate(k, [0, 1], [0.82, 1]) }}
    >
      {children}
    </div>
  );
};

const NumberView: React.FC<{
  th: Theme;
  l: Extract<Layout, { kind: "number" }>;
  t0: number;
}> = ({ th, l, t0 }) => (
  <Pop
    at={l.at - t0}
    style={{
      fontFamily: th.num,
      fontWeight: th.numWeight,
      textAlign: th.align,
    }}
  >
    <div
      style={{
        fontSize: fit(l.value, 210, 4),
        lineHeight: 1,
        color: th.accent,
        letterSpacing: -6,
        whiteSpace: "nowrap",
      }}
    >
      {l.value}
    </div>
    <div
      style={{
        fontFamily: th.body,
        fontSize: 46,
        fontWeight: 700,
        color: th.sub,
        marginTop: 14,
      }}
    >
      {l.label}
    </div>
  </Pop>
);

const ShiftView: React.FC<{
  th: Theme;
  l: Extract<Layout, { kind: "shift" }>;
  t0: number;
}> = ({ th, l, t0 }) => {
  const go = (l.toAt ?? l.at) - t0 + (l.toAt ? 0 : 0.5); // 새 숫자를 말하는 문장(toAt)이 있으면 그때 바뀐다
  const strike = useShow(go, 0.3);
  return (
    <div
      style={{
        position: "relative",
        fontFamily: th.num,
        fontWeight: th.numWeight,
        display: "flex",
        alignItems: "center",
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
            scale: `${strike} 1`,
            transformOrigin: "left",
          }}
        />
      </span>
      <Appear at={go + 0.2} rise={0} style={{ fontSize: 90, color: th.ink }}>
        →
      </Appear>
      <Pop at={go + 0.4} style={{ display: "flex", flexDirection: "column" }}>
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
      </Pop>
      <Pop at={go + 1.0} style={{ position: "absolute", right: 0, top: 0 }}>
        <Stamp th={th} />
      </Pop>
    </div>
  );
};

const StatementView: React.FC<{
  th: Theme;
  l: Extract<Layout, { kind: "statement" }>;
  t0: number;
}> = ({ th, l, t0 }) => (
  <Appear
    at={l.at - t0}
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
            <Swap key={j} th={th} s={s} t0={t0} />
          ) : (
            <span key={j} style={{ color: s.em ? th.accent : th.ink }}>
              {s.t}
            </span>
          ),
        )}
      </div>
    ))}
  </Appear>
);

const Swap: React.FC<{ th: Theme; s: Span; t0: number }> = ({ th, s, t0 }) => {
  const k = useShow((s.swapAt ?? 0) - t0, 0.4);
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span
        style={{ position: "relative", color: th.dim, opacity: 1 - k * 0.65 }}
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
            scale: `${k} 1`,
            transformOrigin: "left",
          }}
        />
      </span>
      <span style={{ marginLeft: 28, color: th.accent, opacity: k }}>
        {s.swap}
      </span>
    </span>
  );
};

const ChecksView: React.FC<{
  th: Theme;
  l: Extract<Layout, { kind: "checks" }>;
  t0: number;
}> = ({ th, l, t0 }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 26,
      fontFamily: th.body,
    }}
  >
    {l.items.map((it) => (
      <Appear
        key={it.text}
        at={it.at - t0}
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
      </Appear>
    ))}
  </div>
);

const PartsView: React.FC<{
  th: Theme;
  l: Extract<Layout, { kind: "parts" }>;
  t0: number;
}> = ({ th, l, t0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sum = l.parts.reduce((a, p) => a + p.weight, 0);
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
          height: 96,
          border: `${th.box.width}px solid ${th.rule}`,
          background: th.bg,
        }}
      >
        {l.parts.map((p, i) => {
          const k = interpolate(
            frame,
            [(p.at - t0) * fps, (p.at - t0 + 0.6) * fps],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: EASE,
            },
          );
          return (
            <div
              key={p.name}
              style={{
                width: `${(p.weight / sum) * 100 * k}%`,
                minWidth: k > 0 ? Math.min(26, 26 * k * 3) : 0,
                background: th.parts[p.tone ?? i],
              }}
            />
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          marginTop: 26,
        }}
      >
        {l.parts.map((p, i) => (
          <Appear key={p.name} at={p.at - t0}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
              <span
                style={{
                  width: 30,
                  height: 30,
                  background: th.parts[p.tone ?? i],
                  border: `3px solid ${th.rule}`,
                  alignSelf: "center",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 48,
                  fontWeight: 700,
                  color: th.ink,
                  width: 230,
                  flexShrink: 0,
                }}
              >
                {p.name}
              </span>
              <span
                style={{
                  fontFamily: th.num,
                  fontSize: 62,
                  fontWeight: th.numWeight,
                  color: p.tone === 2 ? th.accent : th.ink,
                  minWidth: 170,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {p.value}
              </span>
              {p.note ? (
                <Appear
                  at={(p.noteAt ?? p.at) - t0}
                  rise={10}
                  style={{ fontSize: 32, color: th.sub }}
                >
                  {p.note}
                </Appear>
              ) : null}
            </div>
          </Appear>
        ))}
      </div>
    </div>
  );
};

const Scene: React.FC<{ th: Theme; masthead: string; s: SceneProps }> = ({
  th,
  masthead,
  s,
}) => {
  const t0 = s.start;
  const L = s.layout;
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: SAFE.left,
          top: SAFE.top,
          width: W,
          textAlign: th.align,
        }}
      >
        <Masthead th={th} text={masthead} page={s.page} />
        <div style={{ height: 50 }} />
        <Appear at={0}>
          <Headline th={th} lines={s.headline as never} />
        </Appear>
        <div style={{ height: 50 }} />
        {L.kind === "number" ? <NumberView th={th} l={L} t0={t0} /> : null}
        {L.kind === "shift" ? <ShiftView th={th} l={L} t0={t0} /> : null}
        {L.kind === "statement" ? (
          <StatementView th={th} l={L} t0={t0} />
        ) : null}
        {L.kind === "checks" ? <ChecksView th={th} l={L} t0={t0} /> : null}
        {L.kind === "parts" ? <PartsView th={th} l={L} t0={t0} /> : null}
        {s.box ? (
          <Appear
            at={s.box.at - t0}
            style={{
              marginTop: 34,
              padding: "24px 30px",
              background: th.box.bg,
              border: `${th.box.width}px ${th.box.style ?? "solid"} ${th.box.border}`,
              boxShadow: th.box.shadow,
              fontFamily: th.body,
              textAlign: "left",
            }}
          >
            {s.box.title ? (
              <div
                style={{
                  fontSize: 34,
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
                fontSize: 46,
                fontWeight: 700,
                color: th.box.ink ?? th.ink,
              }}
            >
              {s.box.text}
            </div>
          </Appear>
        ) : null}
      </div>
      {s.source ? (
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
          {s.source}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const Captions: React.FC<{ th: Theme; items: EpisodeProps["captions"] }> = ({
  th,
  items,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const c = items.find((x) => t >= x.start && t < x.end);
  return c ? (
    <div
      style={{
        position: "absolute",
        left: SAFE.left,
        top: SAFE.caption,
        width: W,
        textAlign: "center",
        fontFamily: CAPTION_FONT,
        fontSize: 60,
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

export const Episode: React.FC<EpisodeProps> = (p) => {
  const th = THEMES[p.theme];
  const { fps } = useVideoConfig();
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
      {p.scenes.map((s, i) => (
        <Sequence
          key={i}
          from={Math.round(s.start * fps)}
          durationInFrames={Math.max(1, Math.round((s.end - s.start) * fps))}
          name={`장면 ${i + 1}`}
        >
          <Scene th={th} masthead={p.masthead} s={s} />
        </Sequence>
      ))}
      <Captions th={th} items={p.captions} />
      {p.audio ? <Audio src={staticFile(p.audio)} /> : null}
    </AbsoluteFill>
  );
};
