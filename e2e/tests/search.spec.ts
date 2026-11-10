import { expect, test } from "./fixtures.js";

test("search finds a place without diacritics and selects it with the keyboard", async ({
  page,
}) => {
  await page.goto("/");
  const search = page.getByRole("combobox", { name: "Search" });

  await search.fill("bialobrz");
  await expect(page.getByRole("option", { name: /^Białobrzegi/ })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(search).toHaveAttribute("aria-activedescendant", /.+/);
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/object=pl%3Ateryt%3A/);
  await expect(page.getByRole("heading", { level: 2 }).first()).toContainText(/białobrz/i);
  await expect(search).toHaveAttribute("aria-expanded", "false");
});

test("search tolerates a typo", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("combobox", { name: "Search" }).fill("warszwa");

  await expect(page.getByRole("option", { name: /^Warszawa/ })).toBeVisible();
});

test("search says when nothing matches", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("combobox", { name: "Search" }).fill("zzzzqqq");

  await expect(page.getByRole("listbox", { name: "Search results" })).toContainText("No matches");
});
