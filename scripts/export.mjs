// Renders concept.html frame by frame (deterministic __step) to PNGs, then ffmpeg muxes them with music.
// node export.mjs <html> <framesDir> <music.mp3> <out.mp4> [fps]   (uses a local playwright-core, else the one in C:/Users/HP/flow-mcp)
import { createRequire } from "node:module";
let pw; try { pw = createRequire(import.meta.url)("playwright-core"); } catch { pw = createRequire("C:/Users/HP/flow-mcp/package.json")("playwright-core"); }
const { chromium } = pw;
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const [html, frames, music, out, fpsArg] = process.argv.slice(2);
const FPS = +(fpsArg || 30), TOTAL = 28, N = Math.round(TOTAL * FPS);
mkdirSync(frames, { recursive: true });

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(pathToFileURL(html).href, { waitUntil: "networkidle" });
await page.waitForFunction(() => window.__ready === true);
await page.evaluate(() => { window.__pause(true); window.__seek(0); });
for (let i = 0; i < N; i++) {
  const url = await page.evaluate(([i, dt]) => { if (i) window.__step(dt); return document.getElementById("c").toDataURL("image/png"); }, [i, 1 / FPS]);
  writeFileSync(`${frames}/${String(i).padStart(5, "0")}.png`, Buffer.from(url.split(",")[1], "base64"));
  if (i % 120 === 0) console.log(`frame ${i}/${N}`);
}
await browser.close();

execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", `${frames}/%05d.png`, "-i", music,
  "-filter_complex", `[0:v]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[v];[1:a]atrim=0:${TOTAL},asetpts=PTS-STARTPTS,afade=t=in:d=0.3,afade=t=out:st=${TOTAL - 1.5}:d=1.5[a]`,
  "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "slow", "-crf", "16",
  "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
  "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out], { stdio: "inherit" });
console.log("wrote", out);
