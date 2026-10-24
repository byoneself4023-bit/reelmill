// 강의용 쇼케이스(60~70대 수강생): 코드·영어·기록 숫자 없이, 한 화면에 한 문장과 큰 진행판.
// 나레이션은 문장마다 따로 읽힌 소리(voice/NN.mp3), 화면 길이는 그 소리 길이로 정한다.
// 결과 그림은 휴대폰으로 봐도 보이게 화면 대부분을 쓴다. 대화 화면은 크게 다시 그린 「예시 화면」.
// 데이터와 그림은 --public-dir(work/showcase-lecture/)에서 받는다. 회사 글자는 props 에만 있다.
import React from "react";
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Audio, Video } from "@remotion/media";
import * as Sans from "@remotion/google-fonts/NotoSansKR";

const { fontFamily } = Sans.loadFont("normal", { weights: ["400", "700", "900"], subsets: ["korean", "latin"] });

type Line = { scene: string; say: string; show?: string; step?: number; part?: string; audio: string; dur: number };
export type LectureProps = {
  lines: Line[];
  paper: string[];
  zoneName: string;
  steps: string[];
  facts: string[];
  scriptLines: string[];
  fix: { what: string; wrong: string; right: string };
  blogTitle: string;
  blogLines: string[];
  chatUser: string; // 장면 A: 사람이 쓰는 한 줄
  chatReply: string; // 장면 A: Claude 의 답
  reviewReply: string; // 장면 B: Claude 의 다 됐다는 말
  approveWord: string; // 장면 B: 사람의 「승인」
};

const FPS = 30;
const BG = "#F7F3EA";
const INK = "#1F2937";
const SUB = "#4B5563";
const GREEN = "#15803D";
const RED = "#B91C1C";
const CARD = "#FFFFFF";
const SUBTITLE_H = 180; // 아래 자막 띠
const LEAD = 0.8; // 첫 문장 앞 쉼(초)
const HOLD: Record<string, number> = { paper: 5.5, chatA: 7, board: 5, check: 6.5, chatB: 11, results: 6, end: 10 };
const TYPE = 1.6; // 타자: 글자 하나에 걸리는 프레임

// 문장마다 화면에 머무는 시간: 소리 길이 + 쉼, 장면별 최소 시간 이상
export const timeline = (lines: Line[]) => {
  let t = LEAD;
  return lines.map((l) => {
    const hold = l.part === "calc" ? 8 : (HOLD[l.scene] ?? 5);
    const len = Math.max(l.dur + 1.8, hold);
    const r = { ...l, from: Math.round(t * FPS), len: Math.round(len * FPS) };
    t += len;
    return r;
  });
};
export const lectureFrames = (lines: Line[]) => {
  const tl = timeline(lines);
  const last = tl[tl.length - 1];
  return last ? last.from + last.len : 30 * FPS;
};

// 자막 띠 위 남은 자리를 가득 쓰는 판
const Stage: React.FC<{ children: React.ReactNode; top?: number }> = ({ children, top = 30 }) => (
  <AbsoluteFill style={{ top, bottom: SUBTITLE_H + 24, height: "auto", alignItems: "center", justifyContent: "center" }}>
    {children}
  </AbsoluteFill>
);

const fit: React.CSSProperties = { maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 18, boxShadow: "0 10px 30px rgba(0,0,0,0.15)" };

// ── 대화 화면 예시(화면 가득, 글자 60px 이상, 타자 치듯) ──
const ChatWindow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      width: 1840,
      height: "100%",
      background: CARD,
      borderRadius: 28,
      boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      overflow: "hidden",
      color: INK,
      display: "flex",
      flexDirection: "column",
    }}
  >
    <div style={{ height: 76, background: "#EDE7DA", display: "flex", alignItems: "center", padding: "0 34px", gap: 14, flexShrink: 0 }}>
      {["#EF4444", "#F59E0B", "#22C55E"].map((c) => (
        <div key={c} style={{ width: 20, height: 20, borderRadius: 10, background: c }} />
      ))}
      <div style={{ fontSize: 34, fontWeight: 700, marginLeft: 20 }}>Claude</div>
      <div style={{ marginLeft: "auto", fontSize: 26, color: SUB }}>예시 화면</div>
    </div>
    <div style={{ padding: "40px 56px", display: "flex", flexDirection: "column", gap: 36 }}>{children}</div>
  </div>
);

const Bubble: React.FC<{ me?: boolean; text: string; start: number; local: number }> = ({ me, text, start, local }) => {
  const n = Math.max(0, Math.min(text.length, Math.floor((local - start) / TYPE)));
  if (n === 0) return null;
  return (
    <div
      style={{
        alignSelf: me ? "flex-end" : "flex-start",
        maxWidth: me ? 1300 : 1700,
        background: me ? "#DCFCE7" : "#F3F4F6",
        borderRadius: 32,
        padding: "28px 40px",
        fontSize: me ? 68 : 60,
        fontWeight: me ? 900 : 500,
        lineHeight: 1.45,
        wordBreak: "keep-all",
      }}
    >
      {text.slice(0, n)}
    </div>
  );
};

const typedEnd = (start: number, text: string) => start + text.length * TYPE;

const ChatA: React.FC<{ p: LectureProps; local: number }> = ({ p, local }) => {
  const u = 12;
  const r = Math.max(typedEnd(u, p.chatUser) + 25, 6.9 * FPS); // 답은 둘째 문장(「그러면 …」)과 함께
  return (
    <Stage>
      <ChatWindow>
        <Bubble me text={p.chatUser} start={u} local={local} />
        <Bubble text={p.chatReply} start={r} local={local} />
      </ChatWindow>
    </Stage>
  );
};

const ChatB: React.FC<{ p: LectureProps; local: number }> = ({ p, local }) => {
  const r = 8;
  const a = typedEnd(r, p.reviewReply) + 30;
  return (
    <Stage>
      <ChatWindow>
        <Bubble text={p.reviewReply} start={r} local={local} />
        <Bubble me text={p.approveWord} start={a} local={local} />
      </ChatWindow>
    </Stage>
  );
};

const Paper: React.FC<{ p: LectureProps; local: number }> = ({ p, local }) => {
  const s = interpolate(local, [0, 10 * FPS], [1, 1.05], { extrapolateRight: "clamp" });
  return (
    <Stage>
      <div
        style={{
          width: 1200,
          height: "100%",
          background: CARD,
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          padding: "50px 70px",
          transform: `scale(${s}) rotate(-1deg)`,
          overflow: "hidden",
          color: INK,
        }}
      >
        {p.paper.map((x, i) => (
          <div key={i} style={{ fontSize: i < 3 ? 38 : 26, fontWeight: i < 3 ? 900 : 400, lineHeight: 1.6, textAlign: i < 3 ? "center" : "left" }}>
            {x}
          </div>
        ))}
      </div>
    </Stage>
  );
};

// 진행판 아래 결과 컷: 남은 자리를 가득
const StepVisual: React.FC<{ p: LectureProps; step: number }> = ({ p, step }) => {
  const box: React.CSSProperties = { background: CARD, borderRadius: 28, padding: "40px 60px", boxShadow: "0 10px 30px rgba(0,0,0,0.10)", color: INK, width: 1600 };
  if (step === 0)
    return (
      <div style={{ ...box, height: "100%", overflow: "hidden" }}>
        {p.paper.slice(0, 8).map((x, i) => (
          <div key={i} style={{ fontSize: i < 3 ? 46 : 32, fontWeight: i < 3 ? 900 : 400, lineHeight: 1.5, textAlign: i < 3 ? "center" : "left" }}>
            {x}
          </div>
        ))}
      </div>
    );
  if (step === 1)
    return (
      <div style={box}>
        {p.facts.map((x) => (
          <div key={x} style={{ fontSize: 96, fontWeight: 900, margin: "10px 0" }}>
            <span style={{ color: GREEN }}>✓ </span>
            {x}
          </div>
        ))}
      </div>
    );
  if (step === 2)
    return (
      <div style={box}>
        {p.scriptLines.map((x) => (
          <div key={x} style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.45 }}>
            {x}
          </div>
        ))}
      </div>
    );
  if (step === 3) return <Img src={staticFile("wave.png")} style={{ width: 1700, height: 520 }} />;
  if (step === 4) return <Img src={staticFile("scene-a.png")} style={fit} />;
  if (step === 5)
    return (
      <div style={{ display: "flex", gap: 36, height: "100%" }}>
        {[1, 2, 3].map((i) => (
          <Img key={i} src={staticFile(`cover-${i}.png`)} style={fit} />
        ))}
      </div>
    );
  return (
    <div style={{ display: "flex", gap: 36, height: "100%", alignItems: "center" }}>
      <Img src={staticFile("card1.png")} style={fit} />
      <Img src={staticFile("site-calc-1.png")} style={{ ...fit, maxWidth: 1000 }} />
    </div>
  );
};

const Board: React.FC<{ p: LectureProps; step: number; local: number }> = ({ p, step, local }) => (
  <AbsoluteFill>
    <div style={{ display: "flex", gap: 12, justifyContent: "center", paddingTop: 22 }}>
      {p.steps.map((s, i) => {
        const done = i < step || (i === step && local > 20);
        const cur = i === step;
        return (
          <div
            key={s}
            style={{
              width: 250,
              height: 104,
              borderRadius: 18,
              background: done ? GREEN : "#E5E7EB",
              color: done ? "#FFFFFF" : SUB,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              border: cur ? `6px solid ${INK}` : "6px solid transparent",
              fontSize: 30,
              fontWeight: 900,
              textAlign: "center",
              lineHeight: 1.15,
            }}
          >
            <span style={{ fontSize: 40 }}>{done ? "✓" : i + 1}</span>
            <span>{s}</span>
          </div>
        );
      })}
    </div>
    <Stage top={150}>
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", opacity: interpolate(local, [0, 10], [0, 1], { extrapolateRight: "clamp" }) }}>
        <StepVisual p={p} step={step} />
      </div>
    </Stage>
  </AbsoluteFill>
);

const Check: React.FC<{ p: LectureProps; fixed: boolean }> = ({ p, fixed }) => (
  <Stage>
    <div style={{ background: CARD, borderRadius: 32, padding: "60px 80px", width: 1700, boxShadow: "0 10px 30px rgba(0,0,0,0.10)", color: INK }}>
      <div style={{ fontSize: 60, fontWeight: 700, color: SUB, marginBottom: 36 }}>{p.fix.what}</div>
      <div style={{ fontSize: 92, fontWeight: 900, color: RED, opacity: fixed ? 0.45 : 1 }}>✗ {p.fix.wrong}</div>
      {fixed ? <div style={{ fontSize: 92, fontWeight: 900, color: GREEN, marginTop: 30 }}>✓ {p.fix.right}</div> : null}
    </div>
  </Stage>
);

const Results: React.FC<{ p: LectureProps; part: string; local: number }> = ({ p, part, local }) => {
  if (part === "long")
    return (
      <Stage>
        <Video src={staticFile("longform.mp4")} muted trimBefore={150 * FPS} style={{ height: "100%", borderRadius: 20 }} />
      </Stage>
    );
  if (part === "shorts")
    return (
      <Stage top={20}>
        <div style={{ display: "flex", gap: 40, height: "100%" }}>
          {[1, 2, 3].map((i) => (
            <Video key={i} src={staticFile(`cut-${i}.mp4`)} muted trimBefore={2 * FPS} style={{ height: "100%", borderRadius: 20 }} />
          ))}
        </div>
      </Stage>
    );
  if (part === "blog")
    return (
      <Stage top={20}>
        <div style={{ display: "flex", gap: 40, height: "100%", alignItems: "stretch" }}>
          <Img src={staticFile("card1.png")} style={fit} />
          <div style={{ background: CARD, borderRadius: 28, padding: "50px 60px", width: 1060, boxShadow: "0 10px 30px rgba(0,0,0,0.10)", color: INK, overflow: "hidden" }}>
            <div style={{ fontSize: 36, color: GREEN, fontWeight: 900, marginBottom: 18 }}>블로그 글</div>
            <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1.3, marginBottom: 30, wordBreak: "keep-all" }}>{p.blogTitle}</div>
            {p.blogLines.map((x) => (
              <div key={x} style={{ fontSize: 44, lineHeight: 1.55, wordBreak: "keep-all" }}>
                {x}
              </div>
            ))}
          </div>
        </div>
      </Stage>
    );
  const after = local > 3.5 * FPS;
  return (
    <Stage top={20}>
      <div style={{ position: "relative", width: 1600, height: "100%", overflow: "hidden", borderRadius: 20, boxShadow: "0 10px 30px rgba(0,0,0,0.15)" }}>
        <Img src={staticFile("site-calc-1.png")} style={{ position: "absolute", width: "100%" }} />
        <Img src={staticFile("site-calc-2.png")} style={{ position: "absolute", width: "100%", opacity: after ? 1 : 0 }} />
      </div>
    </Stage>
  );
};

const Subtitle: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: SUBTITLE_H,
      background: "rgba(17,24,39,0.94)",
      color: "#FFFFFF",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 80px",
      fontSize: 72,
      fontWeight: 700,
      textAlign: "center",
      lineHeight: 1.25,
      wordBreak: "keep-all",
    }}
  >
    {text}
  </div>
);

export const ShowcaseLecture: React.FC<LectureProps> = (p) => {
  const f = useCurrentFrame();
  const tl = timeline(p.lines);
  const total = lectureFrames(p.lines);
  const cur = [...tl].reverse().find((l) => l.from <= f) ?? tl[0];
  const sceneStart = tl.find((l) => l.scene === cur.scene)?.from ?? 0;
  const local = f - cur.from;
  const sLocal = f - sceneStart;
  const fixed = cur.scene === "check" && tl.filter((l) => l.scene === "check").indexOf(cur) > 0;
  let body: React.ReactNode = null;
  if (cur.scene === "paper") body = <Paper p={p} local={sLocal} />;
  else if (cur.scene === "chatA") body = <ChatA p={p} local={sLocal} />;
  else if (cur.scene === "board") body = <Board p={p} step={cur.step ?? 0} local={local} />;
  else if (cur.scene === "check") body = <Check p={p} fixed={fixed} />;
  else if (cur.scene === "chatB") body = <ChatB p={p} local={sLocal} />;
  else if (cur.scene === "results") body = <Results p={p} part={cur.part ?? ""} local={local} />;
  const end = cur.scene === "end";
  return (
    <AbsoluteFill style={{ background: BG, fontFamily }}>
      {end ? (
        <AbsoluteFill style={{ background: "#111827", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          {(cur.show ?? cur.say).split("\n").map((x, i) => (
            <div key={x} style={{ fontSize: i === 0 ? 104 : 68, fontWeight: 900, color: i === 0 ? "#FACC15" : "#FFFFFF", lineHeight: 1.4 }}>
              {x}
            </div>
          ))}
        </AbsoluteFill>
      ) : (
        <>
          <Sequence key={cur.from} from={cur.from} durationInFrames={cur.len}>
            {body}
          </Sequence>
          <Subtitle text={cur.show ?? cur.say} />
        </>
      )}
      {tl.map((l) => (
        <Sequence key={l.audio} from={l.from} durationInFrames={Math.ceil((l.dur + 0.3) * FPS)}>
          <Audio src={staticFile(l.audio)} />
        </Sequence>
      ))}
      <Audio src={staticFile("bgm.mp3")} volume={(fr) => interpolate(fr, [0, 30, total - 60, total], [0, 0.12, 0.12, 0], { extrapolateRight: "clamp" })} />
    </AbsoluteFill>
  );
};
