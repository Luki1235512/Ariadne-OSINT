import { expect, test } from "./fixtures.js";

test("the list of areas in view selects an area without the map", async ({ page }) => {
  await page.goto("/");
  const inView = page.getByRole("region", { name: /In view/ });
  const entry = inView.getByRole("button", { name: "mazowieckie" });

  await entry.focus();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/object=pl%3Ateryt%3A14$/);
  await expect(page.getByRole("heading", { level: 2, name: "mazowieckie" })).toBeFocused();
  await expect(entry).toHaveAttribute("aria-current", "true");
});

test("at county zoom the list shows counties, not the voivodeship", async ({ page }) => {
  await page.goto("/?object=pl%3Ateryt%3A1465");
  const inView = page.getByRole("region", { name: /In view/ });

  await expect(inView.getByRole("button", { name: "powiat Warszawa" })).toBeVisible();
  await expect(inView.getByRole("button", { name: "mazowieckie" })).toHaveCount(0);
});
