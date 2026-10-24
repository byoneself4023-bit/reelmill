// 3분 쇼케이스: 실제 실행 기록(state.json·full-run.log)을 단계 시간에 비례해 다시 그리고, 결과물을 몰아 본다.
// 데이터와 그림은 --public-dir(work/showcase/)에서 받는다. 회사 자료는 저장소에 넣지 않는다.
import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Audio, Video } from "@remotion/media";
import * as Sans from "@remotion/google-fonts/NotoSansKR";

const { fontFamily } = Sans.loadFont("normal", { weights: ["400", "700", "900"], subsets: ["korean", "latin"] });

type Line = { t: number; step: string; kind: "start" | "done" | "fix"; text?: string; stage?: number; dur?: number };
export type ShowcaseProps = {
  intro: { minutes: number; approvals: number; fixes: number };
  speed: number;
  replay: number;
  stages: string[];
  lines: Line[];
  notice: string;
  zoneFacts: string[];
  scriptLines: string[];
  blogLines: string[];
  excelLines: string[];
  date: string;
  title: string; // 인트로 윗줄(구역 이름 등)
  runLabel: string; // 실행 기록 창 머리글
  excelName: string; // 엑셀 카드 파일 이름
  sourceLabel: string; // ① 단계 카드 머리글
};

const FPS = 30;
const INTRO = 6 * FPS;
const BG = "#0F172A";
const INK = "#E2E8F0";
const DIM = "#94A3B8";
const GOLD = "#FACC15";
const GREEN = "#4ADE80";
const PANEL = "#1E293B";

const fade = (f: number, a: number, b: number) =>
  interpolate(f, [a, a + 12, b - 12, b], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

const Badge: React.FC<{ date: string; speed?: number }> = ({ date, speed }) => (
  <div style={{ position: "absolute", right: 36, bottom: 26, fontSize: 22, color: DIM, letterSpacing: 0.5, zIndex: 5 }}>
    실제 실행 기록({date}) 재생{speed ? ` · ×${speed} 배속` : ""}
  </div>
);

const Intro: React.FC<{ p: ShowcaseProps }> = ({ p }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const items = [
    [`${p.intro.minutes}분`, "작업"],
    [`${p.intro.approvals}번`, "사람 승인"],
    [`${p.intro.fixes}번`, "자동 고침"],
  ];
  return (
    <AbsoluteFill style={{ background: BG, justifyContent: "center", alignItems: "center", opacity: fade(f, 0, INTRO + 12) }}>
      <div style={{ fontSize: 44, color: DIM, marginBottom: 40 }}>{p.title}</div>
      <div style={{ display: "flex", gap: 90 }}>
        {items.map(([n, label], i) => {
          const s = spring({ frame: f - 10 - i * 8, fps, config: { damping: 14 } });
          return (
            <div key={label} style={{ textAlign: "center", transform: `translateY(${(1 - s) * 40}px)`, opacity: s }}>
              <div style={{ fontSize: 150, fontWeight: 900, color: GOLD, lineHeight: 1.05 }}>{n}</div>
              <div style={{ fontSize: 46, color: INK, fontWeight: 700 }}>{label}</div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 26, color: DIM, marginTop: 50 }}>
        작업 = 단계별 실제 실행 시간 합 · 사람 승인 = 검토지 승인 · 자동 고침 = 관문에서 스스로 고친 횟수
      </div>
      <Badge date={p.date} />
    </AbsoluteFill>
  );
};

const Card: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ background: PANEL, borderRadius: 24, padding: "30px 36px", color: INK }}>
    {title ? <div style={{ fontSize: 26, color: DIM, marginBottom: 16 }}>{title}</div> : null}
    {children}
  </div>
);

const StageResult: React.FC<{ p: ShowcaseProps; stage: number; local: number }> = ({ p, stage, local }) => {
  const imgs = ["scene-a.png", "scene-b.png", "scene-c.png", "scene-d.png"];
  if (stage === 0)
    return (
      <Card title={p.sourceLabel}>
        <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.4 }}>{p.notice}</div>
        <div style={{ fontSize: 30, color: DIM, marginTop: 18 }}>원문에 있는 숫자만 쓴다</div>
      </Card>
    );
  if (stage === 1)
    return (
      <Card title="자료 파일 — 원문 쪽 번호와 함께">
        {p.zoneFacts.map((x) => (
          <div key={x} style={{ fontSize: 40, fontWeight: 700, margin: "12px 0" }}>
            <span style={{ color: GREEN }}>✓ </span>
            {x}
          </div>
        ))}
      </Card>
    );
  if (stage === 2)
    return (
      <Card title="롱폼 대본 · 사실 확인 숫자 ✗0">
        {p.scriptLines.map((x, i) => (
          <div key={x} style={{ fontSize: i === 0 ? 38 : 30, fontWeight: i === 0 ? 900 : 400, lineHeight: 1.5, marginBottom: 10 }}>
            {x}
          </div>
        ))}
      </Card>
    );
  if (stage === 3)
    return (
      <Card title="일레븐랩스 목소리 → 문장마다 자막 시각">
        <Img src={staticFile("wave.png")} style={{ width: "100%", marginTop: 10 }} />
        <div style={{ fontSize: 32, marginTop: 20 }}>숫자를 다르게 읽은 문장 <b style={{ color: GREEN }}>0곳</b></div>
      </Card>
    );
  if (stage === 4) {
    const k = Math.min(imgs.length - 1, Math.floor(local / 75) % imgs.length);
    return <Img src={staticFile(imgs[k])} style={{ width: "100%", borderRadius: 18 }} />;
  }
  if (stage === 5)
    return (
      <div style={{ display: "flex", gap: 18 }}>
        {[1, 2, 3].map((i) => (
          <Img key={i} src={staticFile(`cover-${i}.png`)} style={{ width: "32%", borderRadius: 14 }} />
        ))}
      </div>
    );
  return (
    <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
      <Img src={staticFile("card1.png")} style={{ width: "48%", borderRadius: 14 }} />
      <Card title="네이버 블로그 글">
        {p.blogLines.slice(0, 3).map((x) => (
          <div key={x} style={{ fontSize: 24, lineHeight: 1.45, marginBottom: 10 }}>
            {x}
          </div>
        ))}
      </Card>
    </div>
  );
};

const Replay: React.FC<{ p: ShowcaseProps }> = ({ p }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const starts = p.lines.filter((l) => l.kind === "start");
  const cur = [...starts].reverse().find((l) => l.t <= t) ?? starts[0];
  const stage = cur.stage ?? 0;
  const stageStart = starts.find((l) => l.stage === stage)?.t ?? 0;
  const shown = p.lines.filter((l) => l.kind !== "start" && l.t <= t);
  const last = shown.slice(-15);
  const elapsed = Math.min(p.intro.minutes * 60, (t / p.replay) * p.intro.minutes * 60);
  const mm = Math.floor(elapsed / 60);
  const ss = Math.floor(elapsed % 60);
  return (
    <AbsoluteFill style={{ background: BG, padding: "36px 48px", color: INK }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={{ fontSize: 76, fontWeight: 900, color: GOLD }}>{p.stages[stage]}</div>
        <div style={{ fontSize: 34, color: DIM, fontVariantNumeric: "tabular-nums" }}>
          실행 시간 {mm}분 {String(ss).padStart(2, "0")}초 / {p.intro.minutes}분
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, margin: "14px 0 26px" }}>
        {p.stages.map((s, i) => (
          <div key={s} style={{ flex: 1, height: 10, borderRadius: 5, background: i < stage ? GREEN : i === stage ? GOLD : "#334155" }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 36, flex: 1 }}>
        <div style={{ flex: 1.25, background: "#020617", borderRadius: 20, padding: "22px 26px", overflow: "hidden" }}>
          <div style={{ fontSize: 22, color: DIM, marginBottom: 12 }}>{p.runLabel}</div>
          {last.map((l) => {
            const a = interpolate(f, [l.t * FPS, l.t * FPS + 8], [0, 1], { extrapolateRight: "clamp" });
            return (
              <div
                key={`${l.t}-${l.text}`}
                style={{
                  fontSize: 23,
                  lineHeight: 1.55,
                  opacity: a,
                  color: l.kind === "fix" ? GOLD : INK,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                <span style={{ color: l.kind === "fix" ? GOLD : GREEN }}>{l.kind === "fix" ? "↻ " : "✓ "}</span>
                {l.text}
              </div>
            );
          })}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ opacity: interpolate(f - stageStart * FPS, [0, 10], [0, 1], { extrapolateRight: "clamp" }) }}>
            <StageResult p={p} stage={stage} local={f - stageStart * FPS} />
          </div>
        </div>
      </div>
      <Badge date={p.date} speed={p.speed} />
    </AbsoluteFill>
  );
};

const Title: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ position: "absolute", top: 34, left: 0, right: 0, textAlign: "center", fontSize: 60, fontWeight: 900, color: GOLD }}>
    {text}
  </div>
);

const Results: React.FC<{ p: ShowcaseProps }> = ({ p }) => {
  const f = useCurrentFrame();
  const seg = (a: number, b: number) => ({ from: a * FPS, durationInFrames: (b - a) * FPS });
  return (
    <AbsoluteFill style={{ background: BG, color: INK }}>
      <Sequence {...seg(0, 9)}>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <Title text="롱폼 1편 · 9분 30초" />
          <Video src={staticFile("longform.mp4")} muted trimBefore={150 * FPS} style={{ width: 1280, borderRadius: 18, marginTop: 10 }} />
        </AbsoluteFill>
      </Sequence>
      <Sequence {...seg(9, 20)}>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <Title text="쇼츠 3편 · 롱폼에서 잘라 냄" />
          <div style={{ display: "flex", gap: 40, marginTop: 40 }}>
            {[1, 2, 3].map((i) => (
              <Video key={i} src={staticFile(`cut-${i}.mp4`)} muted style={{ height: 720, borderRadius: 18 }} />
            ))}
          </div>
        </AbsoluteFill>
      </Sequence>
      <Sequence {...seg(20, 28)}>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <Title text="블로그 · 카드 2장" />
          <div style={{ display: "flex", gap: 30, marginTop: 40, alignItems: "flex-start", width: 1780 }}>
            <Img src={staticFile("card1.png")} style={{ height: 700, borderRadius: 14 }} />
            <Img src={staticFile("card2.png")} style={{ height: 700, borderRadius: 14 }} />
            <Card title="네이버 블로그 글">
              {p.blogLines.map((x, i) => (
                <div key={x} style={{ fontSize: i === 0 ? 30 : 25, fontWeight: i === 0 ? 900 : 400, lineHeight: 1.5, marginBottom: 12 }}>
                  {x}
                </div>
              ))}
            </Card>
          </div>
        </AbsoluteFill>
      </Sequence>
      <Sequence {...seg(28, 33)}>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <Title text="엑셀 분담금 계산기" />
          <div style={{ width: 1300, marginTop: 60 }}>
            <Card title={p.excelName}>
              {p.excelLines.map((x) => (
                <div key={x} style={{ fontSize: 40, margin: "18px 0", fontWeight: 700 }}>
                  <span style={{ color: GREEN }}>✓ </span>
                  {x}
                </div>
              ))}
            </Card>
          </div>
        </AbsoluteFill>
      </Sequence>
      <Sequence {...seg(33, 42)}>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <Title text="구역 페이지 · 평형을 누르면 분담금이 바뀝니다" />
          <div style={{ position: "relative", width: 1280, height: 740, marginTop: 40, overflow: "hidden", borderRadius: 18 }}>
            <Img src={staticFile("site-calc-1.png")} style={{ position: "absolute", width: "100%", borderRadius: 18 }} />
            <Img
              src={staticFile("site-calc-2.png")}
              style={{
                position: "absolute",
                width: "100%",
                borderRadius: 18,
                opacity: interpolate(f, [(33 + 4) * FPS, (33 + 4.5) * FPS], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              }}
            />
          </div>
        </AbsoluteFill>
      </Sequence>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 96, background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 42, fontWeight: 700, opacity: fade(f, 0, 42 * FPS) }}>
        이게 전부 한 번에 나왔습니다
      </div>
      <Badge date={p.date} />
    </AbsoluteFill>
  );
};

const Outro: React.FC<{ p: ShowcaseProps }> = ({ p }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: BG, justifyContent: "center", alignItems: "center", opacity: fade(f, 0, 8 * FPS + 12) }}>
      <div style={{ fontSize: 96, fontWeight: 900, color: GOLD }}>여러분들도 클릭 4번이면</div>
      <div style={{ fontSize: 48, color: INK, marginTop: 30 }}>이런 영상이랑 이런 걸 만들 수 있습니다</div>
      <Badge date={p.date} />
    </AbsoluteFill>
  );
};

export const SHOWCASE_SECONDS = 180;

export const Showcase: React.FC<ShowcaseProps> = (p) => {
  const replayEnd = INTRO + p.replay * FPS;
  const total = SHOWCASE_SECONDS * FPS;
  return (
    <AbsoluteFill style={{ fontFamily, background: BG }}>
      <Sequence durationInFrames={INTRO}>
        <Intro p={p} />
      </Sequence>
      <Sequence from={INTRO} durationInFrames={p.replay * FPS}>
        <Replay p={p} />
      </Sequence>
      <Sequence from={replayEnd} durationInFrames={42 * FPS}>
        <Results p={p} />
      </Sequence>
      <Sequence from={replayEnd + 42 * FPS} durationInFrames={total - replayEnd - 42 * FPS}>
        <Outro p={p} />
      </Sequence>
      <Audio
        src={staticFile("bgm.mp3")}
        volume={(fr) => interpolate(fr, [0, 30, total - 90, total], [0, 0.8, 0.8, 0], { extrapolateRight: "clamp" })}
      />
    </AbsoluteFill>
  );
};
