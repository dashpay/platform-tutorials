import { test, expect, HAS_MNEMONIC, loginAs } from "./fixtures";

test.describe("Report submission (auth-gated)", () => {
  test.describe.configure({ mode: "serial" });

  test.skip(
    !HAS_MNEMONIC,
    "PLATFORM_MNEMONIC not set — skipping auth-gated specs",
  );

  test("Submit tab shows the researcher's credit balance once signed in", async ({
    page,
  }) => {
    await loginAs(page, 0);
    await page.getByRole("button", { name: "Submit report" }).click();
    await expect(page.getByText(/Researcher Credit balance/)).toBeVisible({
      timeout: 30_000,
    });
  });

  // Genuine write: files one real report, spending 1 Researcher Credit.
  // Reports can't be deleted (canBeDeleted: false), so this isn't
  // reversible — matches dashproof-lab's anchor spec, which accepts the
  // same trade-off for the same reason (immutable-by-design record).
  test("files a report and it appears under My reports", async ({ page }) => {
    await loginAs(page, 0);
    await page.getByRole("button", { name: "Submit report" }).click();

    const balanceText = await page
      .getByText(/Researcher Credit balance/)
      .textContent({ timeout: 30_000 });
    if (/balance:\s*0\b/i.test(balanceText ?? "")) {
      test.skip(true, "Researcher identity has no credits left to spend.");
    }

    const title = `E2E test report ${Date.now()}`;
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Affected component").fill("E2E");
    await page
      .getByLabel("Description")
      .fill("Filed by the DashBounty Playwright suite.");
    await page.getByRole("button", { name: /File report/ }).click();

    await expect(page.getByText("Report filed.")).toBeVisible({
      timeout: 60_000,
    });

    await page.getByRole("button", { name: "My reports" }).click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 30_000 });
  });
});
