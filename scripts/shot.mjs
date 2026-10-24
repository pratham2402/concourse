import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const base = "http://localhost:3000";
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

let loaded = false;
for (let attempt = 0; attempt < 30; attempt += 1) {
  try {
    await page.goto(base, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForSelector(".stand-title", { timeout: 15000 });
    loaded = true;
    break;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

if (!loaded) {
  console.error("page did not load");
  console.error(errors.join("\n"));
  await browser.close();
  process.exit(1);
}

await page.screenshot({ path: path.join("shots", "concourse-home.png"), fullPage: true });
await page.screenshot({ path: path.join("shots", "concourse-viewport.png"), fullPage: false });

console.log(`title: ${await page.title()}`);
console.log(`errors: ${errors.length ? errors.join(" | ") : "none"}`);
await browser.close();
