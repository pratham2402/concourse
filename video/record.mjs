import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const OUT = path.resolve("video/out");
const APP = "https://concourse-delta.vercel.app/";
fs.mkdirSync(OUT, { recursive: true });

const clicks = [];
const events = [];

const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"],
});

const context = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 1,
  acceptDownloads: true,
  recordVideo: { dir: OUT, size: { width: 1600, height: 900 } },
});

const page = await context.newPage();
const recordStart = Date.now();

await page.goto(APP, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForSelector(".stand-title", { timeout: 30000 });
await page.waitForTimeout(900);

await installOverlays(page);

// The first part of the recording is the page load. We trim it in post.
await page.evaluate(() => {
  const black = document.querySelector("#v-black");
  black.style.opacity = "1";
});
await page.waitForTimeout(250);
const start = Date.now();
const trim = (start - recordStart) / 1000;

const t = () => (Date.now() - start) / 1000;
const event = (name, extra = {}) => {
  events.push({ t: t(), name, ...extra });
};

async function cap(text) {
  await page.evaluate((value) => {
    const element = document.querySelector("#v-caption");
    if (!element) return;
    element.innerHTML = value;
    element.classList.add("on");
  }, text);
}

async function hideCap() {
  await page.evaluate(() => {
    document.querySelector("#v-caption")?.classList.remove("on");
  });
}

async function scrollTo(y) {
  await page.evaluate((top) => {
    window.scrollTo({ top, behavior: "smooth" });
  }, y);
  await page.waitForTimeout(750);
}

async function moveTo(locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("No bounding box for cursor target");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 24 });
  await page.waitForTimeout(260);
  return { x, y };
}

async function clickAt(locator, name) {
  const point = await moveTo(locator);
  await page.waitForTimeout(160);
  await page.mouse.down();
  await page.mouse.up();
  clicks.push({ t: t(), name });
  event("click", { name });
  await page.waitForTimeout(420);
}

async function showArch() {
  await page.evaluate(() => {
    document.querySelector("#v-cursor").style.opacity = "0";
    document.querySelector("#v-arch").classList.add("on");
  });
}

async function hideArch() {
  await page.evaluate(() => {
    document.querySelector("#v-arch").classList.remove("on");
    document.querySelector("#v-cursor").style.opacity = "1";
  });
}

async function showOutro() {
  await hideCap();
  await page.evaluate(() => {
    document.querySelector("#v-cursor").style.opacity = "0";
    document.querySelector("#v-outro").classList.add("on");
  });
}

// Fade in from black.
await page.evaluate(() => {
  const black = document.querySelector("#v-black");
  black.style.transition = "opacity 0.9s ease";
  black.style.opacity = "0";
});
await page.waitForTimeout(900);

await cap("One venue. Eight stands. Three dayparts.");
await page.waitForTimeout(2600);

await scrollTo(210);
await cap("The map shows the modeled per-fan delta for every stand.");
await page.waitForTimeout(2300);

const homePlate = page.locator(".map-stand").filter({ hasText: "Home Plate" }).first();
await clickAt(homePlate, "home-plate");
await cap("Qloo ranks the partner. The model prices the switch.");
await page.waitForTimeout(900);

const recommend = page.locator(".recommend").first();
await moveTo(recommend);
await page.waitForTimeout(1600);

await cap("Live Qloo. A transparent model. A per-fan number.");
await page.waitForTimeout(3400);
await moveTo(page.locator(".source-pill").first());
await page.waitForTimeout(800);

await hideCap();
await showArch();
await page.waitForTimeout(4200);
await hideArch();

await scrollTo(250);
await cap("An operator request runs on the filtered shortlist.");
await page.waitForTimeout(1800);

await clickAt(page.getByRole("button", { name: "Bleachers grill item", exact: true }), "bleachers-preset");
await clickAt(page.getByRole("button", { name: "Run agent", exact: true }), "bleachers-run");
await cap("The agent chooses a partner and a dish, or keeps the incumbent.");
await page.waitForSelector(".agent-review", { timeout: 35000 });
await page.waitForTimeout(600);

await cap("The deterministic check keeps the final veto.");
await page.waitForTimeout(1400);
await moveTo(page.locator(".agent-review").first());
await page.waitForTimeout(1600);

await scrollTo(470);
await cap("The agent can move past the deterministic pick when the dish fits.");
await page.waitForTimeout(3000);
await moveTo(page.locator(".why-row").filter({ hasText: /fit:/ }).first());
await page.waitForTimeout(1300);

await scrollTo(250);
await cap("Not every switch is worth it.");
await page.waitForTimeout(900);
await clickAt(page.getByRole("button", { name: "Post-Game late night", exact: true }), "postgame-preset");
await clickAt(page.getByRole("button", { name: "Run agent", exact: true }), "postgame-run");
await page.waitForSelector(".agent-review", { timeout: 35000 });
await page.waitForTimeout(600);

await cap("It can say no.");
await page.waitForTimeout(1000);
await moveTo(page.locator(".agent-review").first());
await page.waitForTimeout(1500);

await scrollTo(650);
await cap("The model shows the loss, the cap, and the constraints.");
await page.waitForTimeout(3200);
const caseNote = page.locator(".case-note").first();
if (await caseNote.count()) {
  await moveTo(caseNote);
  await page.waitForTimeout(1000);
}

await scrollTo(1300);
await cap("Every tool call is in the trace.");
await page.waitForTimeout(3000);
const llmStep = page.locator(".trace-step").filter({ hasText: "llm.review" }).first();
if (await llmStep.count()) {
  await moveTo(llmStep);
  await page.waitForTimeout(1400);
}
const decisionStep = page.locator(".trace-step").filter({ hasText: "decision.check" }).first();
if (await decisionStep.count()) {
  await moveTo(decisionStep);
  await page.waitForTimeout(900);
}

await scrollTo(1230);
await cap("Every assumption, in one brief.");
await page.waitForTimeout(900);
await clickAt(page.getByRole("button", { name: "Download brief", exact: true }), "download-brief");
await page.waitForTimeout(1300);

await scrollTo(220);
await cap("Qloo ranks. The model prices. The agent decides.");
await page.waitForTimeout(3000);

await showOutro();
await page.waitForTimeout(5000);
await page.evaluate(() => {
  const black = document.querySelector("#v-black");
  black.style.transition = "opacity 0.9s ease";
  black.style.opacity = "1";
});
await page.waitForTimeout(1000);

const end = Date.now();
const video = page.video();
const videoPath = await video.path();
await context.close();
await browser.close();

const timeline = {
  trim,
  start,
  end,
  duration: (end - start) / 1000,
  clicks,
  events,
  videoPath,
};
fs.writeFileSync(path.join(OUT, "timeline.json"), JSON.stringify(timeline, null, 2));
console.log(JSON.stringify(timeline, null, 2));

async function installOverlays(page) {
  await page.evaluate(() => {
    const style = document.createElement("style");
    style.id = "v-style";
    style.textContent = `
      #v-black { position: fixed; inset: 0; z-index: 2147483647; background: #000; opacity: 0; pointer-events: none; }
      #v-cursor { position: fixed; left: 0; top: 0; width: 18px; height: 18px; border: 2px solid #fff; border-radius: 50%; box-shadow: 0 2px 12px rgba(0,0,0,.45), 0 0 0 4px rgba(255,255,255,.08); z-index: 2147483646; pointer-events: none; transform: translate3d(-50%,-50%,0); transition: transform 70ms linear, opacity .2s ease; }
      #v-cursor::after { content: ""; position: absolute; inset: 6px; background: #f2a65a; border-radius: 50%; }
      .v-ripple { position: fixed; width: 16px; height: 16px; border: 2px solid #f2a65a; border-radius: 50%; z-index: 2147483645; pointer-events: none; transform: translate(-50%,-50%); animation: v-ripple .55s ease-out forwards; }
      @keyframes v-ripple { from { opacity: .9; width: 16px; height: 16px; } to { opacity: 0; width: 86px; height: 86px; } }
      #v-caption { position: fixed; left: 50%; bottom: 44px; transform: translate(-50%, 14px); z-index: 2147483644; pointer-events: none; opacity: 0; max-width: 1040px; padding: 13px 22px; border: 1px solid rgba(242,166,90,.3); border-radius: 12px; background: rgba(9,15,21,.9); box-shadow: 0 18px 50px rgba(0,0,0,.35); font-family: "Public Sans", sans-serif; font-size: 21px; line-height: 1.35; color: #f2f0e9; text-align: center; transition: opacity .25s ease, transform .25s ease; }
      #v-caption.on { opacity: 1; transform: translate(-50%, 0); }
      #v-caption b { color: #f2a65a; font-weight: 600; }
      #v-arch { position: fixed; inset: 0; z-index: 2147483643; display: grid; place-items: center; background: rgba(8,14,20,.95); opacity: 0; pointer-events: none; transition: opacity .35s ease; }
      #v-arch.on { opacity: 1; }
      .v-arch-inner { width: 1320px; max-width: 92vw; }
      .v-kicker { font-family: "IBM Plex Mono", monospace; font-size: 13px; letter-spacing: .18em; text-transform: uppercase; color: #f2a65a; }
      .v-arch-title { margin-top: 8px; font-family: "Archivo", sans-serif; font-size: 42px; font-weight: 700; letter-spacing: -.02em; color: #f2f0e9; }
      .v-flow { display: flex; align-items: stretch; gap: 12px; margin-top: 34px; }
      .v-box { flex: 1; padding: 20px; border: 1px solid #24313d; border-radius: 14px; background: linear-gradient(180deg,#111a22,#0f161d); }
      .v-box .n { font-family: "IBM Plex Mono", monospace; font-size: 11px; color: #f2a65a; }
      .v-box b { display: block; margin-top: 10px; font-family: "Archivo", sans-serif; font-size: 21px; color: #f2f0e9; }
      .v-box p { margin-top: 8px; font-size: 14px; line-height: 1.45; color: #9fb0bd; }
      .v-arrow { display: flex; align-items: center; color: #5ec28a; font-size: 25px; }
      .v-note { margin-top: 24px; font-family: "IBM Plex Mono", monospace; font-size: 12px; letter-spacing: .02em; color: #9fb0bd; }
      #v-outro { position: fixed; inset: 0; z-index: 2147483642; display: grid; place-items: center; background: radial-gradient(circle at 50% 42%, #12202a 0%, #0b1218 62%); opacity: 0; pointer-events: none; transition: opacity .4s ease; }
      #v-outro.on { opacity: 1; }
      .v-outro-inner { text-align: center; }
      .v-mark { width: 62px; height: 62px; margin: 0 auto; }
      .v-outro-title { margin-top: 20px; font-family: "Archivo", sans-serif; font-size: 68px; font-weight: 800; letter-spacing: -.03em; color: #f2f0e9; }
      .v-outro-tag { margin-top: 10px; font-family: "Public Sans", sans-serif; font-size: 27px; color: #f2a65a; }
      .v-outro-url { margin-top: 28px; font-family: "IBM Plex Mono", monospace; font-size: 16px; letter-spacing: .08em; color: #9fb0bd; }
    `;
    document.head.appendChild(style);

    const black = document.createElement("div");
    black.id = "v-black";
    document.body.appendChild(black);

    const cursor = document.createElement("div");
    cursor.id = "v-cursor";
    cursor.style.transform = "translate3d(800px, 450px, 0) translate(-50%,-50%)";
    document.body.appendChild(cursor);

    const caption = document.createElement("div");
    caption.id = "v-caption";
    document.body.appendChild(caption);

    const arch = document.createElement("div");
    arch.id = "v-arch";
    arch.innerHTML = `
      <div class="v-arch-inner">
        <div class="v-kicker">One request, four steps</div>
        <div class="v-arch-title">The agent has a short leash.</div>
        <div class="v-flow">
          <div class="v-box"><div class="n">01</div><b>Qloo shortlist</b><p>Local partners ranked by cultural affinity.</p></div>
          <div class="v-arrow">→</div>
          <div class="v-box"><div class="n">02</div><b>Deterministic model</b><p>Units, price, elasticity, and the throughput cap.</p></div>
          <div class="v-arrow">→</div>
          <div class="v-box"><div class="n">03</div><b>Agent review</b><p>Partner and dish, or keep the incumbent.</p></div>
          <div class="v-arrow">→</div>
          <div class="v-box"><div class="n">04</div><b>Vendor brief</b><p>Decision, constraints, and every assumption.</p></div>
        </div>
        <div class="v-note">The model sets the numbers. The agent never does.</div>
      </div>
    `;
    document.body.appendChild(arch);

    const outro = document.createElement("div");
    outro.id = "v-outro";
    outro.innerHTML = `
      <div class="v-outro-inner">
        <svg class="v-mark" viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r="17" fill="none" stroke="#f2a65a" stroke-width="1.4" />
          <circle cx="20" cy="20" r="11" fill="none" stroke="#24313d" stroke-width="1.2" />
          <path d="M20 8 L28 20 L20 32 L12 20 Z" fill="#5ec28a" opacity="0.9" />
          <circle cx="20" cy="20" r="2.2" fill="#0b1117" />
        </svg>
        <div class="v-outro-title">Concourse</div>
        <div class="v-outro-tag">The menu is the last guess.</div>
        <div class="v-outro-url">concourse-delta.vercel.app</div>
      </div>
    `;
    document.body.appendChild(outro);

    window.addEventListener("pointermove", (event) => {
      cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%,-50%)`;
    }, true);

    window.addEventListener("pointerdown", (event) => {
      const ripple = document.createElement("div");
      ripple.className = "v-ripple";
      ripple.style.left = `${event.clientX}px`;
      ripple.style.top = `${event.clientY}px`;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 700);
    }, true);
  });
}
