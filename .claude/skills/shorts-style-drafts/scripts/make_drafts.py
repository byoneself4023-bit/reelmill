# /// script
# requires-python = ">=3.10"
# ///
"""스타일 시안 정지 화면과 비교판을 만든다(Remotion).

  uv run make_drafts.py <에피소드 폴더>

읽는 것: <에피소드>/drafts/drafts.json — {"themes": [...], "scenes": {"s1": {Draft props…}, …}}
만드는 것: <에피소드>/drafts/<theme>-<scene>.png (1080×1920) · <에피소드>/drafts/board.png (비교판)
Remotion 프로젝트: reelmill/remotion (Still 「Draft」·「Board」)
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[4]
STUDIO = ROOT / "remotion"
NPX = "npx.cmd" if sys.platform == "win32" else "npx"


def still(comp: str, props: dict, out: Path, public: Path | None = None) -> None:
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump(props, f, ensure_ascii=False)
    extra = [f"--public-dir={public}"] if public else []
    r = subprocess.run([NPX, "remotion", "still", comp, str(out), f"--props={f.name}", "--log=error", *extra],
                       cwd=STUDIO, capture_output=True, text=True, encoding="utf-8")
    Path(f.name).unlink(missing_ok=True)
    if r.returncode != 0 or not out.exists():
        sys.exit(f"[중단] {comp} 렌더 실패\n{(r.stdout + r.stderr)[-1500:]}")


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("사용: uv run make_drafts.py <에피소드 폴더>")
    ep = Path(sys.argv[1]).resolve()
    d = ep / "drafts"
    spec = json.loads((d / "drafts.json").read_text(encoding="utf-8"))
    themes, scenes = spec["themes"], spec["scenes"]
    for t in themes:
        for name, sc in scenes.items():
            props = {"box": None} | {k: v for k, v in sc.items() if k != "sentences"} | {"theme": t}  # 빠진 칸은 비워 둔다(기본값이 섞이지 않게)
            out = d / f"{t}-{name}.png"
            print(f"[시안] {t} · {name} …", flush=True)
            still("Draft", props, out)
    # 비교판은 에피소드 drafts 폴더를 그대로 그림 폴더로 쓴다 — remotion 쪽에 편마다 파일이 쌓이지 않게
    still("Board", {"dir": "", "themes": themes, "scenes": list(scenes)}, d / "board.png", public=d)
    print(f"→ {d / 'board.png'} (시안 {len(themes) * len(scenes)}장)")


if __name__ == "__main__":
    main()
