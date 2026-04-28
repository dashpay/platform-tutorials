import { test, expect } from "./fixtures";

test("Mint tab shows the login overlay when not logged in", async ({
  page,
}) => {
  // Sidebar nav buttons are labelled "✦ Mint" / "▤ Collection" etc. — match
  // by regex (or filter to navigation) rather than exact, which would only
  // hit the bare text "Mint".
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /mint/i })
    .click();
  await expect(
    page.getByText(/login as contract owner to access this feature/i),
  ).toBeVisible();
});

test.skip(
  "non-owner sees the contract-owner gating overlay (write tier — needs login)",
  async () => {
    /* TODO: implement when login fixture lands. */
  },
);

test.skip(
  "contract owner can access the Mint form (write tier — needs login)",
  async () => {
    /* TODO: implement when login fixture lands. */
  },
);
