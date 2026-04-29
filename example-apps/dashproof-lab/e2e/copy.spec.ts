import { createHash } from "node:crypto";
import { test, expect, gotoAnchor } from "./fixtures";

test.describe("Copy buttons", () => {
  test("anchor form copies the SHA-256 hash to clipboard", async ({
    page,
    randomFilePayload,
  }) => {
    await gotoAnchor(page);

    await page.getByLabel("Select file", { exact: true }).setInputFiles({
      name: randomFilePayload.name,
      mimeType: randomFilePayload.mimeType,
      buffer: randomFilePayload.buffer,
    });

    // Wait for hash to populate (Copy hash button enables once hashHex is set).
    const copyBtn = page.getByRole("button", { name: "Copy hash" });
    await expect(copyBtn).toBeEnabled({ timeout: 15_000 });
    await copyBtn.click();

    await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();

    const clipboardValue = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
    // The browser hashes locally with crypto.subtle; recompute the digest in
    // Node from the same input bytes and assert exact equality.
    const expected = createHash("sha256")
      .update(randomFilePayload.buffer)
      .digest("hex");
    expect(clipboardValue).toBe(expected);
  });
});
