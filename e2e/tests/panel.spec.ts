import { expect, test } from "./fixtures.js";

test("a shared link opens the object's details, links and sources", async ({ page }) => {
  await page.goto("/?object=pl%3Ateryt%3A1465");

  await expect(page.getByRole("heading", { level: 2, name: "powiat Warszawa" })).toBeVisible();
  const panel = page.getByRole("complementary", { name: "Side panel" });
  await expect(panel.getByRole("button", { name: "mazowieckie" }).first()).toBeVisible();
  await expect(panel).toContainText("Located in");
  await expect(panel).toContainText("Contains");
  await expect(panel.getByRole("link", { name: "Synthetic e2e data" })).toBeVisible();
});

test("choosing a linked object selects it and moves keyboard focus to its title", async ({
  page,
}) => {
  await page.goto("/?object=pl%3Ateryt%3A1465");
  const panel = page.getByRole("complementary", { name: "Side panel" });
  const link = panel.getByRole("button", { name: "Warszawa", exact: true }).first();

  await link.focus();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/object=pl%3Ateryt%3A146501/);
  await expect(
    page.getByRole("heading", { level: 2, name: "Warszawa", exact: true }),
  ).toBeFocused();
});

test("an unknown object shows a clear message", async ({ page, consoleErrors }) => {
  await page.goto("/?object=pl%3Ateryt%3A99");

  await expect(page.getByRole("alert")).toHaveText(
    "This object does not exist, or it has been removed.",
  );
  expect(consoleErrors).toEqual([expect.stringContaining("404")]);
  consoleErrors.length = 0;
});

test("the browser's back button returns to the previous selection", async ({ page }) => {
  await page.goto("/?object=pl%3Ateryt%3A1465");
  await page
    .getByRole("complementary", { name: "Side panel" })
    .getByRole("button", { name: "Warszawa", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/object=pl%3Ateryt%3A146501/);

  await page.goBack();

  await expect(page).toHaveURL(/object=pl%3Ateryt%3A1465$/);
  await expect(page.getByRole("heading", { level: 2, name: "powiat Warszawa" })).toBeVisible();
});
