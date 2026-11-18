import { defineConfig } from "@playwright/test";

const baseURL = process.env.KOINON_WEB ?? "http://127.0.0.1:8000";

export default defineConfig({
  testDir: ".",
  timeout: 480_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "390", use: { browserName: "chromium", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
    { name: "360", use: { browserName: "chromium", viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  ],
});
