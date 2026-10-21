import { loadFont as loadSans } from "@remotion/google-fonts/NotoSansKR";
import { loadFont as loadSerif } from "@remotion/google-fonts/NotoSerifKR";
import { loadFont as loadPlex } from "@remotion/google-fonts/IBMPlexSansKR";
import { loadFont as loadBatang } from "@remotion/google-fonts/GowunBatang";
import { loadFont as loadBlack } from "@remotion/google-fonts/BlackHanSans";
import { loadFont as loadHahmlet } from "@remotion/google-fonts/Hahmlet";
import { loadFont as loadCoding } from "@remotion/google-fonts/NanumGothicCoding";

const sans = loadSans("normal", {
  weights: ["400", "700", "900"],
  subsets: ["korean", "latin"],
});
const serif = loadSerif("normal", {
  weights: ["400", "700", "900"],
  subsets: ["korean", "latin"],
});
const plex = loadPlex("normal", {
  weights: ["400", "700"],
  subsets: ["korean", "latin"],
});
const batang = loadBatang("normal", {
  weights: ["400", "700"],
  subsets: ["korean", "latin"],
});
const black = loadBlack("normal", {
  weights: ["400"],
  subsets: ["korean", "latin"],
});
const hahmlet = loadHahmlet("normal", {
  weights: ["400", "700", "900"],
  subsets: ["korean", "latin"],
});
const coding = loadCoding("normal", {
  weights: ["400", "700"],
  subsets: ["korean", "latin"],
});

// 쇼츠 안전 영역(1080×1920): 위 280 · 아래 520 · 왼쪽 76 · 오른쪽 140. 자막은 y≈1300.
export const SAFE = {
  top: 280,
  bottom: 520,
  left: 76,
  right: 140,
  caption: 1300,
};
export const CAPTION_FONT = sans.fontFamily; // 자막은 스타일과 상관없이 고딕 — 작은 화면에서 읽기 쉽게

export type Theme = {
  name: string;
  from: string; // 어느 기준 스타일에서 파생했나
  bg: string;
  pattern?: string; // 바탕 무늬(CSS background-image)
  patternSize?: string;
  band?: { color: string; height: number }; // 위쪽 색 띠(제목이 그 위에 놓인다)
  ink: string;
  headInk?: string; // 띠 위 제목 색
  sub: string;
  rule: string;
  accent: string;
  headAccent?: string; // 띠 위 제목의 강조 색
  dim: string;
  highlight?: string; // 형광펜
  masthead: "rules" | "tag" | "lot" | "bar" | "doc";
  mastLabel?: string; // doc 머리글 왼쪽 이름(기본 「분석 성적서」)
  mastLine?: string; // doc 머리글 아래 줄(CSS border)
  tag?: { bg: string; ink: string; text: string };
  align: "left" | "center";
  head: string;
  headWeight: number;
  headSize: number;
  body: string;
  num: string; // 큰 숫자 글꼴
  numWeight: number;
  stamp?: { text: string; color: string }; // 도장
  box: {
    bg: string;
    border: string;
    shadow: string;
    ink?: string;
    width: number;
    style?: "solid" | "dashed";
  };
  parts: string[];
};

// ── 기준 스타일(사내) — 그대로 쓰지 않고 파생의 출발점으로만 둔다 ──
export const paper: Theme = {
  name: "신문 지면(기준)",
  from: "기준",
  bg: "#F1EEE5",
  ink: "#1C1B19",
  sub: "#6B675F",
  rule: "#1C1B19",
  accent: "#B3261E",
  dim: "#A8A399",
  masthead: "rules",
  align: "left",
  head: serif.fontFamily,
  headWeight: 900,
  headSize: 84,
  body: serif.fontFamily,
  num: serif.fontFamily,
  numWeight: 900,
  box: { bg: "transparent", border: "#1C1B19", shadow: "none", width: 4 },
  parts: ["#8E8A82", "#5B4636", "#C9A227"],
};
export const note: Theme = {
  name: "실무 노트(기준)",
  from: "기준",
  bg: "#FAF8F2",
  pattern:
    "linear-gradient(rgba(60,90,70,0.10) 2px, transparent 2px), linear-gradient(90deg, rgba(60,90,70,0.10) 2px, transparent 2px)",
  patternSize: "54px 54px",
  ink: "#171717",
  sub: "#6A6A6A",
  rule: "#171717",
  accent: "#C8352B",
  dim: "#9A9A9A",
  highlight: "#FFE34D",
  masthead: "tag",
  tag: { bg: "#1E6E54", ink: "#FFFFFF", text: "금메달 해부" },
  align: "left",
  head: sans.fontFamily,
  headWeight: 900,
  headSize: 84,
  body: sans.fontFamily,
  num: sans.fontFamily,
  numWeight: 900,
  box: {
    bg: "#FFFFFF",
    border: "#171717",
    shadow: "8px 8px 0 #171717",
    width: 4,
  },
  parts: ["#B8B8B8", "#4A4A4A", "#E0B020"],
};

// ── 파생 시안 ──
// 성적서 — 실무 노트의 「모눈·꼬리표·상자」를 「분석 성적서」로: 흰 서류, 가는 표 줄, 붉은 도장
export const assay: Theme = {
  name: "성적서",
  from: "실무 노트",
  bg: "#FCFCFA",
  pattern: "linear-gradient(rgba(0,0,0,0.07) 2px, transparent 2px)",
  patternSize: "100% 96px",
  ink: "#141414",
  sub: "#5E5E5E",
  rule: "#141414",
  accent: "#C62828",
  dim: "#A3A3A3",
  masthead: "doc",
  align: "left",
  head: plex.fontFamily,
  headWeight: 700,
  headSize: 80,
  body: plex.fontFamily,
  num: plex.fontFamily,
  numWeight: 700,
  stamp: { text: "검사\n완료", color: "#C62828" },
  box: { bg: "#FFFFFF", border: "#141414", shadow: "none", width: 2 },
  parts: ["#C9C9C9", "#6B6B6B", "#C9A227"],
};

// 경매 도록 — 신문 지면의 「명조·가는 줄」을 「고급 경매 도록」으로: 숯색 바탕, 금색 명조, 가운데 정렬
export const auction: Theme = {
  name: "경매 도록",
  from: "신문 지면",
  bg: "#1B1A17",
  pattern:
    "radial-gradient(circle at 50% 42%, rgba(201,165,90,0.13), transparent 62%)",
  patternSize: "100% 100%",
  ink: "#EDE6D6",
  sub: "#9C9384",
  rule: "#C9A55A",
  accent: "#D9B464",
  dim: "#5E584D",
  masthead: "lot",
  align: "center",
  head: batang.fontFamily,
  headWeight: 700,
  headSize: 82,
  body: batang.fontFamily,
  num: batang.fontFamily,
  numWeight: 700,
  box: { bg: "transparent", border: "#C9A55A", shadow: "none", width: 2 },
  parts: ["#8C8A85", "#6E4B3A", "#D9B464"],
};

// 포스터 — 신문 지면의 「격자·굵은 제목」을 「스위스 포스터」로: 크림 바탕 위 빨간 띠, 아주 굵은 고딕, 검은 상자
export const poster: Theme = {
  name: "포스터",
  from: "신문 지면",
  bg: "#EFE9DD",
  band: { color: "#D7261E", height: 660 },
  ink: "#111111",
  headInk: "#FFFFFF",
  headAccent: "#FFD23F",
  sub: "#5B5650",
  rule: "#111111",
  accent: "#D7261E",
  dim: "#B3ACA0",
  masthead: "bar",
  align: "left",
  head: black.fontFamily,
  headWeight: 400,
  headSize: 104,
  body: sans.fontFamily,
  num: black.fontFamily,
  numWeight: 400,
  box: {
    bg: "#111111",
    border: "#111111",
    shadow: "none",
    ink: "#FFFFFF",
    width: 4,
  },
  parts: ["#B3ACA0", "#5C4033", "#E3B21C"],
};

// 공고문 — 신문 지면의 「명조·가는 줄」을 「입주자 모집공고」로: 미색 종이, 남색 명조, 공문 머리글
export const notice: Theme = {
  name: "공고문",
  from: "신문 지면",
  bg: "#F4F1EA",
  ink: "#1D2B3E",
  sub: "#5F6773",
  rule: "#1D2B3E",
  accent: "#1F4FA0",
  dim: "#A7A39B",
  masthead: "doc",
  mastLabel: "입주자 모집공고",
  mastLine: "3px solid #1D2B3E",
  align: "left",
  head: hahmlet.fontFamily,
  headWeight: 700,
  headSize: 84,
  body: hahmlet.fontFamily,
  num: hahmlet.fontFamily,
  numWeight: 900,
  box: { bg: "#FFFFFF", border: "#1D2B3E", shadow: "none", width: 3 },
  parts: ["#B9C3D1", "#1F4FA0", "#D9A21B"],
};

// 영수증 — 실무 노트의 「모눈·상자·숫자 강조」를 「영수증」으로: 흰 종이, 고정폭 글꼴, 점선, 합계 빨강
export const receipt: Theme = {
  name: "영수증",
  from: "실무 노트",
  bg: "#FBFAF6",
  pattern:
    "repeating-linear-gradient(90deg, rgba(0,0,0,0.035) 0 2px, transparent 2px 36px)",
  patternSize: "100% 100%",
  ink: "#1A1A1A",
  sub: "#6B6B6B",
  rule: "#1A1A1A",
  accent: "#D23B2E",
  dim: "#A6A6A6",
  masthead: "doc",
  mastLabel: "영수증",
  mastLine: "3px dashed #1A1A1A",
  align: "left",
  head: coding.fontFamily,
  headWeight: 700,
  headSize: 78,
  body: coding.fontFamily,
  num: coding.fontFamily,
  numWeight: 700,
  box: {
    bg: "transparent",
    border: "#1A1A1A",
    shadow: "none",
    width: 3,
    style: "dashed",
  },
  parts: ["#BDBDBD", "#D23B2E", "#3A3A3A"],
};

// 복권 — 신문 지면의 「굵은 제목·빨간 숫자」를 「복권 용지」로: 노란 바탕, 아주 굵은 고딕, 은박 긁는 칸
export const lottery: Theme = {
  name: "복권",
  from: "신문 지면",
  bg: "#FFD21F",
  pattern: "radial-gradient(rgba(0,0,0,0.06) 2px, transparent 2px)",
  patternSize: "28px 28px",
  ink: "#111111",
  sub: "#4A3F10",
  rule: "#111111",
  accent: "#C8102E",
  dim: "#8A7A2E",
  masthead: "bar",
  align: "left",
  head: black.fontFamily,
  headWeight: 400,
  headSize: 100,
  body: sans.fontFamily,
  num: black.fontFamily,
  numWeight: 400,
  box: {
    bg: "#C9CDD2",
    border: "#111111",
    shadow: "6px 6px 0 #111111",
    width: 4,
  },
  parts: ["#FFFFFF", "#C8102E", "#111111"],
};

// 승차권 — 실무 노트의 「모눈·상자·도장」을 「옛 승차권」으로: 연녹색 빗금 종이, 점선 칸, 붉은 검표 도장
export const ticket: Theme = {
  name: "승차권",
  from: "실무 노트",
  bg: "#EAF3EE",
  pattern:
    "repeating-linear-gradient(45deg, rgba(30,110,84,0.07) 0 2px, transparent 2px 16px)",
  patternSize: "100% 100%",
  ink: "#14261F",
  sub: "#4F6A5F",
  rule: "#14261F",
  accent: "#C8352B",
  dim: "#9DB3A9",
  masthead: "doc",
  mastLabel: "승차권",
  mastLine: "3px dashed #14261F",
  align: "left",
  head: plex.fontFamily,
  headWeight: 700,
  headSize: 80,
  body: plex.fontFamily,
  num: plex.fontFamily,
  numWeight: 700,
  stamp: { text: "검표", color: "#C8352B" },
  box: {
    bg: "#FFFFFF",
    border: "#14261F",
    shadow: "none",
    width: 3,
    style: "dashed",
  },
  parts: ["#9DB3A9", "#1E6E54", "#C8352B"],
};

// 발차 시각표 — 신문 지면의 「가는 줄·표」를 「역 발차 시각표」로: 검은 판, 호박색 고정폭 글자, 가로줄
export const timetable: Theme = {
  name: "발차 시각표",
  from: "신문 지면",
  bg: "#15171A",
  pattern: "linear-gradient(rgba(255,255,255,0.05) 2px, transparent 2px)",
  patternSize: "100% 110px",
  ink: "#F2F2EE",
  sub: "#9A9C9F",
  rule: "#F2B33D",
  accent: "#F2B33D",
  dim: "#55585C",
  masthead: "rules",
  align: "left",
  head: coding.fontFamily,
  headWeight: 700,
  headSize: 84,
  body: coding.fontFamily,
  num: coding.fontFamily,
  numWeight: 700,
  box: {
    bg: "#22252A",
    border: "#F2B33D",
    shadow: "none",
    ink: "#F2F2EE",
    width: 3,
  },
  parts: ["#55585C", "#9A9C9F", "#F2B33D"],
};

// 역 표지판 — 신문 지면의 「굵은 제목·띠」를 「역 이름 표지판」으로: 흰 바탕 위 남색 띠, 아주 굵은 고딕, 초록 강조
export const signage: Theme = {
  name: "역 표지판",
  from: "신문 지면",
  bg: "#FFFFFF",
  band: { color: "#1F3A68", height: 665 },
  ink: "#111111",
  headInk: "#FFFFFF",
  headAccent: "#7FD1AE",
  sub: "#555A61",
  rule: "#1F3A68",
  accent: "#0A7F55",
  dim: "#B8BEC8",
  masthead: "bar",
  align: "left",
  head: sans.fontFamily,
  headWeight: 900,
  headSize: 96,
  body: sans.fontFamily,
  num: sans.fontFamily,
  numWeight: 900,
  box: {
    bg: "#1F3A68",
    border: "#1F3A68",
    shadow: "none",
    ink: "#FFFFFF",
    width: 4,
  },
  parts: ["#B8BEC8", "#1F3A68", "#0A7F55"],
};

export const THEMES = {
  paper,
  note,
  assay,
  auction,
  poster,
  notice,
  receipt,
  lottery,
  ticket,
  timetable,
  signage,
} as const;
export type ThemeKey = keyof typeof THEMES;
