import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the app title", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain("<h1>Ariadne</h1>");
  });

  it("renders the map area and an open side panel", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('aria-label="Map"');
    expect(html).toContain('aria-label="Side panel"');
    expect(html).toContain('aria-expanded="true"');
  });
});