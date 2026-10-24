import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const OUT = path.resolve("video/out");
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 1,
  recordVideo: { dir: OUT, size: { width: 1600, height: 900 } },
});

const page = await context.newPage();
const recordStart = Date.now();
await page.goto("http://127.0.0.1:8765/title.html", {
  waitUntil: "networkidle",
  timeout: 30000,
});
await page.evaluate(async () => {
  await document.fonts.ready;
  document.body.classList.add("play");
});
const play = Date.now();
const trim = (play - recordStart) / 1000;
await page.waitForTimeout(5300);

const video = page.video();
const videoPath = await video.path();
await context.close();
await browser.close();

const timeline = { trim, play, videoPath };
fs.writeFileSync(path.join(OUT, "timeline-title.json"), JSON.stringify(timeline, null, 2));
console.log(JSON.stringify(timeline, null, 2));
