import { expect, test } from "@playwright/test";

test("the page is served with its security headers", async ({ request }) => {
  const response = await request.get("/");

  expect(response.status()).toBe(200);
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["strict-transport-security"]).toMatch(/max-age=\d+/);
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["cache-control"]).toBe("no-cache");
});

test("the API reaches the database", async ({ request }) => {
  const response = await request.get("/api/ready");

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});

test("map tiles arrive compressed", async ({ request }) => {
  const response = await request.get("/api/tiles/admin/5/17/10", {
    headers: { "accept-encoding": "gzip" },
  });

  expect(response.status()).toBe(200);
  expect(response.headers()["content-encoding"]).toBe("gzip");
});

test("the map lists the areas in view, and search finds a place", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });

  await page.goto("/");
  const inView = page.getByRole("region", { name: /In view/ });
  await expect(inView.getByRole("button", { name: "mazowieckie" })).toBeVisible();
  await page.getByRole("combobox", { name: "Search" }).fill("warsz");
  await expect(page.getByRole("option", { name: /^Warszawa/ }).first()).toBeVisible();

  expect(errors, "errors in the browser console").toEqual([]);
});
