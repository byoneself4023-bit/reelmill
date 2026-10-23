// 정지 화면 여러 장을 브라우저 하나로 뽑는다(`remotion still` 을 장마다 부르면 장마다 브라우저를 새로 띄워 느리다).
//   node scripts/stills.mjs <묶음 폴더> <Composition> <props.json> <jobs.json>
//   jobs.json = [{"frame": 120, "out": "…/01.png"}, …]
import { readFileSync } from "node:fs";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";

const [serveUrl, id, propsFile, jobsFile] = process.argv.slice(2);
const inputProps = JSON.parse(readFileSync(propsFile, "utf-8"));
const jobs = JSON.parse(readFileSync(jobsFile, "utf-8"));
const browser = await openBrowser("chrome");
try {
  const composition = await selectComposition({ serveUrl, id, inputProps, puppeteerInstance: browser });
  for (const j of jobs) {
    await renderStill({ serveUrl, composition, inputProps, frame: j.frame, output: j.out, puppeteerInstance: browser, overwrite: true });
    console.log(`[점검] ${j.label ?? j.out}`);
  }
} finally {
  await browser.close({ silent: true });
}
