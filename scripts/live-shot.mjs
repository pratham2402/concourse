import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 2,
});
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(error.message));

await page.goto("https://concourse-delta.vercel.app/", {
  waitUntil: "domcontentloaded",
  timeout: 30000,
});
await page.waitForSelector(".stand-title", { timeout: 30000 });
await page.waitForTimeout(1200);

const source = await page.locator(".source-pill").innerText();
await page.screenshot({ path: path.join("shots", "deployed-home.png"), fullPage: true });
await page.screenshot({ path: path.join("shots", "deployed-viewport.png"), fullPage: false });

console.log(`title: ${await page.title()}`);
console.log(`source: ${source}`);
console.log(`errors: ${errors.length ? errors.join(" | ") : "none"}`);
await browser.close();
