import { test, expect, gotoVerify } from "./fixtures";

test.describe("Verify panel", () => {
  test("computes hash and finds matching proof for a known fixture", async ({
    page,
    fixtureFile,
  }) => {
    await gotoVerify(page);

    const fixture = fixtureFile("proof-fixture-01.txt");
    // Known SHA-256 from src/data/exampleFiles.ts (proof-fixture-01).
    const expectedHashHex =
      "02e4e7cd6b6c73ec895e82d5e59065f30ffbb70f03fdd7d2a575ffd0c333d414";

    await page.getByLabel("Select file", { exact: true }).setInputFiles({
      name: fixture.name,
      mimeType: fixture.mimeType,
      buffer: fixture.buffer,
    });

    // Hash populated → Copy hash enables. (formatHashBlocks inserts spaces
    // and newlines between 8-char blocks, so a substring match doesn't work
    // directly — read the container's textContent and strip whitespace.)
    await expect(page.getByRole("button", { name: "Copy hash" })).toBeEnabled();
    const hashContainer = page.locator("div.font-mono.whitespace-pre-wrap");
    await expect(hashContainer).toBeVisible();
    const renderedHash = (await hashContainer.textContent()) ?? "";
    expect(renderedHash.replace(/\s+/g, "")).toBe(expectedHashHex);

    // Network round-trip to testnet — generous wait. "Proof found" notice
    // confirms findAnchorByHash returned a record.
    await expect(page.getByText("Proof found")).toBeVisible();
    await expect(
      page.getByText("Matching proof", { exact: true }),
    ).toBeVisible();

    // The chainId for this fixture is stable (see exampleFiles.ts).
    await expect(
      page.getByRole("button", { name: "demo-proof-fixture-01" }).first(),
    ).toBeVisible();
  });

  test("shows not-found notice for a random unknown file", async ({
    page,
    randomFilePayload,
  }) => {
    await gotoVerify(page);

    await page.getByLabel("Select file", { exact: true }).setInputFiles({
      name: randomFilePayload.name,
      mimeType: randomFilePayload.mimeType,
      buffer: randomFilePayload.buffer,
    });

    await expect(page.getByText("No matching proof found")).toBeVisible({
      timeout: 60_000,
    });
  });
});
