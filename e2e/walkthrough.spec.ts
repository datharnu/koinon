import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const CODE = "13572468";

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    localStorage.setItem("koinon.lang", "en");
  });
});

test("member can check a real spend, and Bitcoin refuses the two attacks", async ({ page, context }) => {
  test.setTimeout(720_000);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Open the app" }).first().click();
  await expect(page).toHaveURL(/\/app$/);

  const start = page.getByRole("button", { name: /Use an 8-digit code|Choose a code/ });
  await expect(start).toBeEnabled({ timeout: 60_000 });
  await start.click();
  await expect(page.getByRole("heading", { name: "Choose a code" })).toBeVisible();
  await page.keyboard.type(CODE);
  await expect(page.getByRole("heading", { name: "Confirm the code" })).toBeVisible();
  await page.keyboard.type(CODE);
  const home = page.getByRole("button", { name: "Spend" });
  const failed = page.getByText(/Creation failed/);
  await expect(home.or(failed)).toBeVisible({ timeout: 240_000 });
  if (await failed.isVisible()) throw new Error((await failed.textContent()) ?? "creation failed");

  await dismissToasts(page);
  await page.getByRole("button", { name: "Test network" }).click();
  await attack(page, "Ibou spends alone", /NULLFAIL|Signature must be zero|mandatory-script-verify-flag/i);
  await attack(page, "The server swaps the recipient", /PSBT_MISMATCH/);
  await page.getByRole("dialog").getByRole("button", { name: /Fermer|Close/ }).click();

  await page.getByRole("button", { name: "Spend" }).click();
  await page.getByRole("button", { name: "Review" }).click();
  await page.getByRole("button", { name: "Sign and send" }).click();
  await expect(page.getByRole("heading", { name: "Request sent" })).toBeVisible({ timeout: 60_000 });

  await page.getByRole("tab", { name: "Coumba" }).click();
  const incoming = page.getByRole("button", { name: /Hall rental/ });
  await expect(incoming).toBeVisible({ timeout: 30_000 });
  await incoming.click();
  await page.getByRole("button", { name: "Approve" }).click();
  await page.getByRole("tab", { name: "Ibou" }).click();
  const view = page.getByRole("button", { name: "View the request" });
  if (await view.isVisible()) await view.click();
  await expect(page.getByRole("button", { name: "Send the transaction" })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Send the transaction" }).click();
  await expect(visibleText(page, "Sent. It confirms with the next block.")).toBeVisible({ timeout: 60_000 });
  await dismissToasts(page);

  await page.getByRole("button", { name: "Test network" }).click();
  await expect(page.getByRole("heading", { name: "Test network" })).toBeVisible();
  await page.getByRole("button", { name: "Mine a block" }).click();
  await expect(visibleText(page, "Paid. The transaction is in a block.")).toBeVisible({ timeout: 90_000 });
  await page.getByRole("dialog").getByRole("button", { name: /Fermer|Close/ }).click();

  await backToHome(page);
  const member = await openMember(page, context);
  await expect(member.getByTestId("member-proof")).toContainText(/Verified on this phone: \d+\/\d+/, { timeout: 60_000 });
  await expect(member.getByText("Keys match this link")).toBeVisible();
  const spend = member.getByRole("button", { name: /Hall rental/ });
  await expect(spend).toContainText(/Ibou \+ Coumba/, { timeout: 60_000 });
  await spend.click();
  const sheet = member.getByRole("dialog");
  await expect(sheet.getByTestId("proof-verdict")).toContainText("Checked on this phone from Bitcoin bytes");
  await expect(sheet.getByText("Ibou + Coumba", { exact: true })).toBeVisible();
  await expect(sheet.getByText("P2WSH 2-of-3 + CSV")).toBeVisible();
  await member.close();
  await page.getByRole("dialog").getByRole("button", { name: /Fermer|Close/ }).click();
  await dismissToasts(page);

  await page.getByRole("button", { name: "Test network" }).click();
  const early = page.locator("article").filter({ hasText: "Recover too early" });
  await early.getByRole("button", { name: "Try it" }).click();
  await expect(early.getByText("Blocked")).toBeVisible({ timeout: 180_000 });
  await early.getByRole("button", { name: "See the raw answer" }).click();
  await expect(early.getByText(/non-BIP68-final/)).toBeVisible();
  await early.getByRole("button", { name: "Mine 10 blocks and retry" }).click();
  await expect(early.getByText("As designed")).toBeVisible({ timeout: 180_000 });
  await page.getByRole("dialog").getByRole("button", { name: /Fermer|Close/ }).click();

  await backToHome(page);
  const recovery = page.getByRole("button", { name: /Awa · recovery/ });
  if (!(await recovery.isVisible())) await page.getByRole("button", { name: "See all" }).click();
  await expect(page.getByRole("button", { name: /Awa · recovery/ })).toBeVisible({ timeout: 30_000 });
});

function visibleText(page: Page, text: string) {
  return page.getByText(text, { exact: true }).filter({ visible: true });
}

async function dismissToasts(page: Page) {
  const close = page.getByRole("status").getByRole("button", { name: /Fermer|Close/ });
  while ((await close.count()) > 0) {
    await close.first().click();
  }
}

async function attack(page: Page, title: string, raw: RegExp) {
  const card = page.locator("article").filter({ hasText: title });
  await card.getByRole("button", { name: /Try it|Try again/ }).click();
  await expect(card.getByText("Blocked")).toBeVisible({ timeout: 120_000 });
  await card.getByRole("button", { name: "See the raw answer" }).click();
  await expect(card.getByText(raw)).toBeVisible();
}

async function openMember(page: Page, context: BrowserContext) {
  await page.getByRole("button", { name: "Invite" }).click();
  const link = page.getByRole("link", { name: "Open the member view" });
  await expect(link).toHaveAttribute("href", /\/fonds\/[0-9a-f-]+#[0-9a-f]{64}$/i);
  const [member] = await Promise.all([context.waitForEvent("page"), link.click()]);
  await member.waitForLoadState("domcontentloaded");
  return member;
}

async function backToHome(page: Page) {
  for (let step = 0; step < 5; step += 1) {
    if (await page.getByRole("button", { name: "Spend" }).isVisible()) return;
    const back = page.getByRole("button", { name: /Retour|Back/ });
    if (await back.isVisible()) await back.click();
    else break;
  }
  await expect(page.getByRole("button", { name: "Spend" })).toBeVisible();
}
