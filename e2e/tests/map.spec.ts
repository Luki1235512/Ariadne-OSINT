import { expect, test } from "./fixtures.js";

test("the map loads its tiles and lists the areas in view", async ({ page }) => {
  const tile = page.waitForResponse((response) => response.url().includes("/api/tiles/admin/"));
  await page.goto("/");

  expect((await tile).status()).toBeLessThan(400);
  const inView = page.getByRole("region", { name: /In view/ });
  await expect(inView.getByRole("button", { name: "mazowieckie" })).toBeVisible();
});

test("clicking the map selects the area under the pointer, clicking outside clears it", async ({
  page,
}) => {
  await page.goto("/?object=pl%3Ateryt%3A1465");
  await expect(page.getByRole("heading", { level: 2, name: "powiat Warszawa" })).toBeVisible();
  const map = page.getByRole("application", { name: "Map" });
  await expect(page.getByRole("region", { name: /In view/ })).toContainText("powiat Warszawa");

  const box = await map.boundingBox();
  if (box === null) {
    throw new Error("the map has no size");
  }

  await map.click({ position: { x: 10, y: box.height / 2 } });
  await expect(page).not.toHaveURL(/object=/);

  await map.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(page).toHaveURL(/object=pl%3Ateryt%3A1465/);
});
