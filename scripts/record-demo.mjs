// Records the demo video takes against the running local stack. Nothing here is mocked:
// every frame is the real homepage, the real app, the real README, or real `pnpm e2e` output.
//
//   pnpm exec node scripts/record-demo.mjs [--web http://127.0.0.1:5173] [--e2e .video/e2e.txt]
//
// Writes .video/takes/<take>.webm and .video/marks.json (seconds from the start of each take).
import { chromium } from "@playwright/test";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index > -1 ? process.argv[index + 1] : fallback;
};
const WEB = arg("--web", "http://127.0.0.1:5173");
const E2E = arg("--e2e", ".video/e2e.txt");
const REPO = "https://github.com/datharnu/koinon";
const OUT = path.resolve(".video");
const TAKES = path.join(OUT, "takes");
const CODE = "13572468";
const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

const ONLY = arg("--only", "");
const want = (name) => !ONLY || ONLY.split(",").includes(name);
const marksFile = path.join(OUT, "marks.json");
const marks = ONLY ? JSON.parse(await readFile(marksFile, "utf8").catch(() => "{}")) : {};
const browser = await chromium.launch();

/** A visible cursor: headless Chromium draws none, and a viewer needs to see what was tapped. */
const CURSOR = `
  addEventListener("DOMContentLoaded", () => {
    const dot = document.createElement("div");
    dot.style.cssText = "position:fixed;z-index:2147483647;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgb(109 74 255/.28);border:2px solid rgb(109 74 255/.9);pointer-events:none;transition:transform .35s cubic-bezier(.2,.8,.2,1),opacity .2s;transform:translate(-40px,-40px)";
    document.body.appendChild(dot);
    addEventListener("mousemove", (e) => { dot.style.transform = "translate(" + e.clientX + "px," + e.clientY + "px)"; }, true);
    addEventListener("mousedown", () => { dot.style.background = "rgb(109 74 255/.6)"; }, true);
    addEventListener("mouseup", () => { dot.style.background = "rgb(109 74 255/.28)"; }, true);
  });`;

async function take(name, viewport, run, { lang = "en", theme = "light", scale = 1 } = {}) {
  if (!want(name)) return;
  const dir = path.join(TAKES, `${name}-raw`);
  const context = await browser.newContext({ viewport, deviceScaleFactor: scale, recordVideo: { dir, size: viewport } });
  await context.addInitScript(
    ([l, th]) => {
      if (sessionStorage.getItem("koinon.video")) return;
      localStorage.clear();
      localStorage.setItem("koinon.lang", l);
      localStorage.setItem("koinon.theme", th);
      sessionStorage.setItem("koinon.video", "1");
    },
    [lang, theme],
  );
  await context.addInitScript(CURSOR);
  const page = await context.newPage();
  const start = Date.now();
  const list = (marks[name] = []);
  const mark = (label) => {
    list.push({ label, at: (Date.now() - start) / 1000 });
    console.log(`${name.padEnd(8)} ${((Date.now() - start) / 1000).toFixed(1).padStart(6)}s  ${label}`);
  };
  try {
    await run(page, mark, context);
  } finally {
    await context.close();
    const [file] = await readdir(dir);
    if (file) await rename(path.join(dir, file), path.join(TAKES, `${name}.webm`));
    await rm(dir, { recursive: true, force: true });
  }
}

const pause = (page, ms) => page.waitForTimeout(ms);

async function tap(page, locator, wait = 450) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
  await pause(page, wait);
  await locator.click();
}

async function scrollTo(page, selector, settle = 900) {
  await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ behavior: "smooth", block: "start" }), selector);
  await pause(page, settle);
}

async function closeSheet(page) {
  await closeToasts(page);
  await page.keyboard.press("Escape");
  await pause(page, 500);
  const dialog = page.getByRole("dialog");
  if (await dialog.isVisible().catch(() => false)) await dialog.getByRole("button", { name: /Close|Fermer/ }).first().click({ force: true });
  await pause(page, 600);
}

async function closeToasts(page) {
  const close = page.getByRole("status").getByRole("button", { name: /Close|Fermer/ });
  while ((await close.count()) > 0) await close.first().click().catch(() => {});
}

if (!ONLY) await rm(TAKES, { recursive: true, force: true });
await mkdir(TAKES, { recursive: true });

/* 1. Homepage: the problem, the user, the rule. */
await take("home", DESKTOP, async (page, mark) => {
  await page.goto(`${WEB}/`, { waitUntil: "networkidle" });
  mark("hero");
  await pause(page, 5000);
  await scrollTo(page, "#probleme");
  mark("problem");
  await pause(page, 7000);
  await scrollTo(page, "#questions");
  mark("questions");
  await pause(page, 8000);
  mark("end");
});

/* 2. The real `pnpm e2e` output from this machine, replayed as text. */
await take("terminal", DESKTOP, async (page, mark) => {
  const lines = (await readFile(E2E, "utf8")).trimEnd().split("\n");
  const head = lines.slice(0, 8);
  const tail = lines.slice(-14);
  const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const rows = [...head, "  …", ...tail]
    .map((line) => {
      const tone = line.startsWith("[x]") ? "#4ade80" : /REFUS|REQUEST_EXPIRED|non-BIP68/.test(line) ? "#f87171" : "#d4d4d8";
      return `<div class="l" style="color:${tone}">${escape(line) || "&nbsp;"}</div>`;
    })
    .join("");
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#0b0b0d;font:15px/1.55 ui-monospace,Menlo,monospace">
    <div style="margin:36px auto;width:1160px;border-radius:14px;background:#141416;box-shadow:0 0 0 1px #27272a">
      <div style="display:flex;gap:8px;padding:14px 18px;border-bottom:1px solid #27272a">
        <span style="width:12px;height:12px;border-radius:50%;background:#3f3f46"></span><span style="width:12px;height:12px;border-radius:50%;background:#3f3f46"></span><span style="width:12px;height:12px;border-radius:50%;background:#3f3f46"></span>
        <span style="margin-left:12px;color:#71717a">koinon — real output of pnpm e2e, 18 Nov 2026 (excerpt)</span></div>
      <div style="padding:18px 22px"><div style="color:#a78bfa">$ pnpm e2e</div>${rows}</div></div>
    <style>.l{opacity:0;transition:opacity .25s}.l.on{opacity:1}</style></body></html>`);
  mark("start");
  const count = await page.locator(".l").count();
  for (let index = 0; index < count; index += 1) {
    await page.locator(".l").nth(index).evaluate((node) => node.classList.add("on"));
    await pause(page, index < 9 ? 260 : 420);
  }
  mark("checklist");
  await pause(page, 4000);
  mark("end");
});

/* 3. The app on a laptop: two officers, the attacks, the honest spend, the recovery. */
let memberUrl = "";
let memberFinished;
const memberDone = new Promise((resolve) => {
  memberFinished = resolve;
});
let resume;
const resumed = new Promise((resolve) => {
  resume = resolve;
});
const appTake = take("app", DESKTOP, async (page, mark, context) => {
  await page.goto(`${WEB}/app`, { waitUntil: "networkidle" });
  mark("welcome");
  await pause(page, 1500);
  await tap(page, page.getByRole("button", { name: /Use an 8-digit code|Choose a code/ }));
  await pause(page, 600);
  await page.keyboard.type(CODE, { delay: 110 });
  await pause(page, 500);
  await page.keyboard.type(CODE, { delay: 110 });
  mark("creating");
  await page.getByRole("button", { name: "Spend" }).first().waitFor({ timeout: 240_000 });
  await pause(page, 4000);
  await closeToasts(page);
  mark("home");
  await pause(page, 4500);

  await tap(page, page.getByRole("button", { name: "Try to cheat" }));
  await pause(page, 1200);
  mark("cheat-open");
  for (const [title, raw] of [
    ["Ibou spends alone", "attack1"],
    ["The server swaps the recipient", "attack2"],
  ]) {
    const card = page.locator("article").filter({ hasText: title });
    await card.scrollIntoViewIfNeeded();
    mark(`${raw}-try`);
    await tap(page, card.getByRole("button", { name: /Try it|Try again/ }));
    await card.getByText("Blocked").waitFor({ timeout: 120_000 });
    mark(`${raw}-blocked`);
    await pause(page, 1400);
    await closeToasts(page);
    await tap(page, card.getByRole("button", { name: "See the raw answer" }));
    mark(`${raw}-raw`);
    await pause(page, 3200);
  }
  await closeSheet(page);

  mark("spend-start");
  await tap(page, page.getByRole("button", { name: "Spend" }).first());
  await pause(page, 1500);
  await tap(page, page.getByRole("button", { name: "Review" }));
  await pause(page, 2600);
  mark("review");
  await tap(page, page.getByRole("button", { name: "Sign and send" }));
  await page.getByRole("heading", { name: "Request sent" }).waitFor({ timeout: 60_000 });
  mark("sent");
  await pause(page, 1500);
  const ibou = page.locator("figure").first();
  const coumba = page.locator("figure").nth(1);
  const incoming = coumba.getByRole("button", { name: /Hall rental/ });
  await incoming.first().waitFor({ timeout: 30_000 });
  mark("coumba-inbox");
  await pause(page, 1200);
  await tap(page, incoming.first());
  await pause(page, 2400);
  mark("coumba-review");
  await tap(page, coumba.getByRole("button", { name: "Approve" }));
  mark("approved");
  const view = ibou.getByRole("button", { name: "View the request" }).first();
  const send = ibou.getByRole("button", { name: "Send the transaction" }).first();
  await view.or(send).first().waitFor({ timeout: 60_000 });
  if (await view.isVisible()) await tap(page, view);
  await send.waitFor({ timeout: 60_000 });
  await pause(page, 1000);
  await tap(page, send);
  await page.getByText("Sent. Waiting for a block, not confirmed yet.", { exact: true }).filter({ visible: true }).first().waitFor({ timeout: 60_000 });
  mark("broadcast");
  await pause(page, 1200);
  await closeToasts(page);
  await tap(page, page.getByRole("toolbar").getByRole("button", { name: "Mine a block" }));
  await page.getByText("Paid. The transaction is in a block.", { exact: true }).filter({ visible: true }).first().waitFor({ timeout: 90_000 });
  mark("paid");
  await pause(page, 2500);
  await closeToasts(page);
  for (let step = 0; step < 4; step += 1) {
    const back = ibou.getByRole("button", { name: /^Back$/ }).first();
    if (!(await back.isVisible().catch(() => false))) break;
    await back.click();
    await pause(page, 400);
  }
  await pause(page, 2500);
  mark("home-after");
  await pause(page, 3000);

  await tap(page, page.getByRole("button", { name: "Invite" }).first());
  const link = page.getByRole("link", { name: "Open the member view" });
  memberUrl = (await link.getAttribute("href")) ?? "";
  mark("invite");
  await pause(page, 2500);
  await closeSheet(page);
  mark("pause-for-member");
  resume?.("ready");
  await memberDone;
  mark("resume");

  await tap(page, page.getByRole("button", { name: "Try to cheat" }));
  await pause(page, 1000);
  const early = page.locator("article").filter({ hasText: "Recover too early" });
  await early.scrollIntoViewIfNeeded();
  mark("recover-try");
  await tap(page, early.getByRole("button", { name: /Try it|Try again/ }));
  await early.getByText("Blocked").waitFor({ timeout: 180_000 });
  mark("recover-blocked");
  await pause(page, 1400);
  await closeToasts(page);
  await tap(page, early.getByRole("button", { name: "See the raw answer" }));
  mark("recover-raw");
  await pause(page, 3000);
  await tap(page, early.getByRole("button", { name: "Mine 10 blocks and retry" }));
  await early.getByText("As designed").waitFor({ timeout: 180_000 });
  mark("recovered");
  await pause(page, 4000);
  mark("end");
});

/* 4. The member view on a phone-sized screen, from the invite link. */
if (want("app")) await resumed;
await take(
  "member",
  PHONE,
  async (page, mark) => {
    await page.goto(memberUrl, { waitUntil: "domcontentloaded" });
    mark("open");
    await page.getByTestId("member-proof").filter({ hasText: /Verified on this phone: \d+\/\d+/ }).waitFor({ timeout: 60_000 });
    mark("verified");
    await pause(page, 4500);
    const spend = page.getByRole("button", { name: /Hall rental/ });
    await spend.filter({ hasText: /Ibou \+ Coumba/ }).waitFor({ timeout: 60_000 });
    await spend.scrollIntoViewIfNeeded();
    await pause(page, 1500);
    mark("spend-row");
    await tap(page, spend);
    await page.getByRole("dialog").getByTestId("proof-verdict").waitFor({ timeout: 30_000 });
    mark("proof-sheet");
    await pause(page, 5500);
    await page.getByRole("dialog").evaluate((node) => {
      const scroller = [...node.querySelectorAll("*")].find((el) => el.scrollHeight > el.clientHeight + 20);
      scroller?.scrollBy({ top: 420, behavior: "smooth" });
    });
    await pause(page, 3000);
    mark("proof-detail");
    await closeSheet(page);
    const fr = page.getByRole("button", { name: "fr", exact: true });
    if (await fr.first().isVisible().catch(() => false)) await tap(page, fr.first());
    else await page.getByRole("button", { name: /Passer en français/ }).first().click().catch(() => {});
    mark("french");
    await pause(page, 3500);
    mark("end");
  },
  { scale: 2 },
).finally(() => memberFinished?.());

await appTake;

/* 5. The README: first screen, architecture, limits, next. "local" renders the working-copy
   README.md through GitHub's own markdown API, so unpushed edits are what the video shows. */
const README = arg("--readme", "local");
await take("readme", DESKTOP, async (page, mark) => {
  if (README === "github") {
    await page.goto(REPO, { waitUntil: "networkidle" });
  } else {
    const body = execFileSync("gh", ["api", "markdown", "-f", "mode=gfm", "-f", "context=datharnu/koinon", "-F", "text=@README.md"], { encoding: "utf8" });
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css@5/github-markdown-light.css">
      <style>body{margin:0;background:#fff;font-family:-apple-system,"Segoe UI",Helvetica,Arial,sans-serif}
        .bar{position:sticky;top:0;z-index:2;display:flex;gap:10px;align-items:center;padding:14px 32px;background:#f6f8fa;border-bottom:1px solid #d1d9e0;font-size:14px;color:#59636e}
        .bar b{color:#1f2328}.markdown-body{box-sizing:border-box;max-width:980px;margin:0 auto;padding:32px 45px 120px}
        pre.mermaid{background:none;text-align:center}</style></head>
      <body><div class="bar"><b>datharnu/koinon</b> / README.md · working copy, rendered by the GitHub markdown API</div>
      <article class="markdown-body">${body}</article>
      <script type="module">import m from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";for(const s of document.querySelectorAll('section[data-type="mermaid"]')){const p=document.createElement("pre");p.className="mermaid";p.textContent=s.querySelector("pre").textContent;s.replaceWith(p);}m.initialize({startOnLoad:false,theme:"neutral"});await m.run();document.body.dataset.ready="1";</script>
      </body></html>`, { waitUntil: "networkidle" });
    await page.waitForSelector("body[data-ready]", { timeout: 60_000 });
  }
  const heading = async (text, offset = 0) => {
    await page.evaluate(
      ([t, dy]) => {
        const node = [...document.querySelectorAll(".markdown-body h2")].find((h) => h.textContent?.includes(t));
        if (node) window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - 70 + dy, behavior: "smooth" });
      },
      [text, offset],
    );
    await pause(page, 1500);
  };
  await pause(page, 600);
  mark("top");
  await pause(page, 5000);
  await heading("How it works", 300);
  mark("diagram");
  await pause(page, 6000);
  await heading("What this does not claim");
  mark("limits");
  await pause(page, 6000);
  await heading("13. Next");
  mark("next");
  await pause(page, 6000);
  mark("end");
});

await browser.close();
await writeFile(marksFile, JSON.stringify(marks, null, 2));
console.log(`\nTakes in ${TAKES}. Marks in ${path.join(OUT, "marks.json")}.`);
