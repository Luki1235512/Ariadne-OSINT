import { test as base, expect } from "@playwright/test";

export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") {
          errors.push(message.text());
        }
      });
      page.on("pageerror", (error) => {
        errors.push(error.message);
      });
      await page.route("https://tiles.openfreemap.org/**", (route) =>
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            version: 8,
            sources: {},
            layers: [
              { id: "background", type: "background", paint: { "background-color": "#111" } },
            ],
          }),
        }),
      );
      await use(errors);
      expect(errors, "errors in the browser console").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
