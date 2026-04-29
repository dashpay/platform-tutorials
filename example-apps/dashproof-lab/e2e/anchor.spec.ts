import { test, expect, gotoAnchor, HAS_MNEMONIC } from "./fixtures";

test.describe("Anchor flow (requires PLATFORM_MNEMONIC)", () => {
  // Anchor writes share a single testnet identity; running them in parallel
  // would race the identity nonce. Keep this describe serial even when the
  // global config enables parallelism.
  test.describe.configure({ mode: "serial" });

  test.skip(
    !HAS_MNEMONIC,
    "PLATFORM_MNEMONIC not set — skipping anchor write tests",
  );

  test("logs in, hashes a unique file, and submits a proof", async ({
    page,
    randomFilePayload,
  }) => {
    await gotoAnchor(page);

    // Open login modal via the in-form CTA when not authenticated.
    await page
      .getByRole("button", { name: "Login to create proof" })
      .click();

    const mnemonicInput = page.getByPlaceholder("mnemonic phrase");
    await expect(mnemonicInput).toBeVisible();
    await mnemonicInput.fill(process.env.PLATFORM_MNEMONIC!);
    await page.getByRole("button", { name: /Login and continue/ }).click();

    // Modal closes and the form swaps to the authenticated submit button.
    // Scope to the form to avoid collision with the sidebar "Create proof" nav.
    const submit = page
      .locator("form")
      .getByRole("button", { name: /Create proof|Submitting/ });
    await expect(submit).toBeVisible();

    // Upload a file with random bytes — guarantees a unique hash so the
    // unique entryHash index won't reject the second test run.
    await page.getByLabel("Select file", { exact: true }).setInputFiles({
      name: randomFilePayload.name,
      mimeType: randomFilePayload.mimeType,
      buffer: randomFilePayload.buffer,
    });

    await expect(page.getByRole("button", { name: "Copy hash" })).toBeEnabled();
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(
      page.getByText("Proof created and anchored on Dash Platform", {
        exact: false,
      }),
    ).toBeVisible();
  });
});
