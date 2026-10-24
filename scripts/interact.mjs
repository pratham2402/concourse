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

await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForSelector(".stand-title", { timeout: 30000 });

await page.getByRole("button", { name: "Post-game", exact: true }).click();
await page.waitForTimeout(1000);
const postMenu = await page.locator(".recommend-title").innerText();
const postPartner = await page.locator(".recommend-partner").innerText();
await page.getByRole("button", { name: "Mid-game", exact: true }).click();
await page.waitForTimeout(1000);

const before = await page.locator(".source-pill").innerText();
await page.locator(".live-btn").click();
try {
  await page.waitForFunction(
    () => {
      const pill = document.querySelector(".source-pill")?.textContent ?? "";
      const error = document.querySelector(".error-banner")?.textContent ?? "";
      return pill.includes("Live Qloo") || error.length > 0;
    },
    { timeout: 20000 },
  );
} catch {
  // The snapshot remains; capture the state below.
}
const after = await page.locator(".source-pill").innerText();
const errorCount = await page.locator(".error-banner").count();
const errorText = errorCount ? await page.locator(".error-banner").innerText() : "";
await page.screenshot({ path: path.join("shots", "live-panel.png"), fullPage: false });

await page.locator("details summary", { hasText: "Switch case" }).scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join("shots", "switch-case.png"), fullPage: false });

await page.getByRole("button", { name: /Right Field/ }).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join("shots", "right-field.png"), fullPage: false });

console.log(`postgame: ${postMenu} / ${postPartner}`);
console.log(`source before: ${before}`);
console.log(`source after: ${after}`);
console.log(`error: ${errorText || "none"}`);
console.log(`console errors: ${errors.length ? errors.join(" | ") : "none"}`);
await browser.close();
