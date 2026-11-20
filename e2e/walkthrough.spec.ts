import { expect, test, type Page } from "@playwright/test";

const CODE = "13572468";

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    localStorage.setItem("koinon.lang", "en");
  });
});

test("one 15,000 F hall rental: refused with one signature, approved by Coumba, confirmed, checked by a member", async ({ page, context }) => {
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
  await page.getByRole("button", { name: "Spend" }).click();
  await page.getByRole("button", { name: "Review" }).click();
  await page.getByRole("button", { name: "Sign and send" }).click();
  await expect(page.getByRole("heading", { name: "Request sent" })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "View the request" }).click();
  await expect(visibleText(page, "1 of 2 approvals. No money has moved.")).toBeVisible({ timeout: 30_000 });

  const next = page.getByRole("region", { name: "Next step" }).filter({ visible: true });
  await next.getByRole("button", { name: "Send with only Ibou's signature" }).click();
  await expect(next.getByText("Blocked")).toBeVisible({ timeout: 120_000 });
  await expect(next.getByText("This request is unchanged: 1 of 2 approvals, no money has moved.")).toBeVisible();
  await next.getByRole("button", { name: "See the raw answer" }).click();
  await expect(next.getByText(/NULLFAIL|Signature must be zero|mandatory-script-verify-flag/i)).toBeVisible();

  await dismissToasts(page);
  await page.getByRole("button", { name: "Test network" }).click();
  const swapped = await attack(page, "The server swaps the recipient", /PSBT_MISMATCH/);
  await expect(swapped.getByText(/On the 15,000 F request "Hall rental for the general assembly"\. It is unchanged/)).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: /Fermer|Close/ }).click();

  await next.getByRole("button", { name: "Switch to Coumba to approve" }).click();
  await expect(page.getByRole("tab", { name: "Coumba" })).toHaveAttribute("aria-selected", "true");
  await expect(visibleText(page, "Hall rental for the general assembly", true)).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Approve" }).filter({ visible: true }).click();
  await expect(visibleText(page, "2 of 2 approvals.")).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Send the transaction" }).filter({ visible: true }).click();
  await expect(visibleText(page, "Sent. Waiting for a block, not confirmed yet.")).toBeVisible({ timeout: 60_000 });
  await dismissToasts(page);

  await page.getByRole("button", { name: "Mine a block to confirm (test network)" }).filter({ visible: true }).click();
  await expect(visibleText(page, "Paid. The transaction is in a block.")).toBeVisible({ timeout: 90_000 });
  const receipt = page.getByRole("link", { name: "Open the member receipt" }).filter({ visible: true });
  await expect(receipt).toHaveAttribute("href", /\/fonds\/[0-9a-f-]+\?tx=[0-9a-f]{64}#[0-9a-f]{64}$/i);
  const [member] = await Promise.all([context.waitForEvent("page"), receipt.click()]);
  await member.waitForLoadState("domcontentloaded");
  const sheet = member.getByRole("dialog");
  await expect(sheet.getByTestId("proof-verdict")).toContainText("Checked on this phone from Bitcoin bytes", { timeout: 60_000 });
  await expect(sheet.getByText("Ibou + Coumba", { exact: true })).toBeVisible();
  await expect(sheet.getByText("P2WSH 2-of-3 + CSV")).toBeVisible();
  await sheet.getByRole("button", { name: /Fermer|Close/ }).first().click();
  await expect(member.getByTestId("member-proof")).toContainText(/Verified on this phone: \d+\/\d+/, { timeout: 60_000 });
  await expect(member.getByText("Keys match this link")).toBeVisible();
  await expect(member.getByRole("button", { name: /Hall rental/ })).toContainText(/Ibou \+ Coumba/, { timeout: 60_000 });
  await member.close();
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

function visibleText(page: Page, text: string, partial = false) {
  return page.getByText(text, { exact: !partial }).filter({ visible: true }).first();
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
  return card;
}

async function backToHome(page: Page) {
  for (let step = 0; step < 5; step += 1) {
    if (await page.getByRole("button", { name: "Spend" }).isVisible()) return;
    const back = page.getByRole("button", { name: /Retour|Back/ });
    const tab = page.getByRole("navigation", { name: "Navigation" }).getByRole("button", { name: "Home" });
    if (await back.isVisible()) await back.click();
    else if (await tab.isVisible()) await tab.click();
    else break;
  }
  await expect(page.getByRole("button", { name: "Spend" })).toBeVisible();
}
