import {
  connected,
  expect,
  expectNoHorizontalOverflow,
  gotoDiscover,
  LOAD_TIMEOUT,
  nav,
  test,
} from "./fixtures";

// The shell: navigation, keyboard order and the connection.

test("the navigation switches views by click and keyboard", async ({
  page,
}) => {
  await gotoDiscover(page);
  await expectNoHorizontalOverflow(page);
  await expect(page.getByLabel("Network")).toHaveCount(0);

  await test.step("Tab reaches the header and navigation in order", async () => {
    const order = [
      page.getByRole("link", { name: "dashapps" }),
      page.locator(".header-account").getByRole("button", { name: "Sign in" }),
      ...["Discover", "Search", "Mine", "Settings"].map((name) =>
        page
          .getByRole("navigation", { name: "App navigation" })
          .getByRole("button", { name, exact: true }),
      ),
    ];
    await expect(order[1]).toBeEnabled({ timeout: LOAD_TIMEOUT });
    for (const target of order) {
      await page.keyboard.press("Tab");
      await expect(target).toBeFocused();
    }
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Settings",
    );
  });

  for (const view of ["Search", "Mine", "Settings"]) {
    await nav(page, view);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(view);
    await expectNoHorizontalOverflow(page);
  }
  await page.getByRole("link", { name: "dashapps" }).click();
  await expect(
    page.getByRole("heading", { name: "Built on Dash Platform" }),
  ).toBeVisible();
});

test("Retry connection recovers once the network is back", async ({ page }) => {
  const offline = (url: URL) => url.hostname !== "localhost";
  await page.route(offline, (route) => route.abort());
  await page.goto("/");
  const retry = page.getByRole("button", { name: "Retry connection" });
  await expect(retry).toBeVisible({ timeout: LOAD_TIMEOUT });
  await expect(page.getByText("Connection unavailable")).toBeAttached();
  await expect(
    page.locator(".header-account").getByRole("button", { name: "Sign in" }),
  ).toBeDisabled();

  await page.unroute(offline);
  await retry.click();
  await connected(page);
  await expect(retry).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(
    page.locator(".registry-panel article.registry-entry").first(),
  ).toBeVisible({ timeout: LOAD_TIMEOUT });
});
