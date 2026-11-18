/**
 * Cold-load timing of the production build.
 * Vite preview on 127.0.0.1:4173. Headless Chromium.
 * Cache off, CPU 4x, latency 400ms, 400 kibibytes/s up and down (51200 bytes/s).
 * This is not a phone and not the VPS.
 */
import { chromium } from "@playwright/test";

const origin = process.env.KOINON_PREVIEW ?? "http://127.0.0.1:4173";
const routes = [
  { path: "/", ready: "a[href='/app']" },
  { path: "/app", ready: "text=/8-digit code|Choose a code|demo server is not answering/" },
  { path: "/fonds/00000000-0000-4000-8000-000000000000", ready: "text=/Fund not found|Read only/" },
];

const browser = await chromium.launch();
const results = [];
for (const route of routes) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => localStorage.setItem("koinon.lang", "en"));
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send("Network.enable");
  await client.send("Network.setCacheDisabled", { cacheDisabled: true });
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 400,
    downloadThroughput: (400 * 1024) / 8,
    uploadThroughput: (400 * 1024) / 8,
  });
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const started = Date.now();
  await page.goto(origin + route.path, { waitUntil: "commit", timeout: 180_000 });
  await page.waitForSelector(route.ready, { timeout: 180_000 });
  const visibleMs = Date.now() - started;
  const timing = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const resources = performance.getEntriesByType("resource").map((entry) => ({
      name: entry.name.split("/").pop(),
      transfer: entry.transferSize,
      encoded: entry.encodedBodySize,
      endMs: Math.round(entry.responseEnd),
    }));
    return {
      domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
      loadMs: Math.round(nav.loadEventEnd),
      documentTransfer: nav.transferSize,
      resources,
    };
  });
  const transfer = timing.documentTransfer + timing.resources.reduce((sum, entry) => sum + entry.transfer, 0);
  results.push({ route: route.path, visibleMs, transfer, ...timing });
  await context.close();
}
await browser.close();
console.log(JSON.stringify(results, null, 2));
