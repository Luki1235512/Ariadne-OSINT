import { describe, expect, it } from "vitest";
import { requestLogFields } from "./request-log.js";

describe("requestLogFields", () => {
  it("logs the path without the query string, which can contain search terms", () => {
    const fields = requestLogFields({ method: "GET", url: "/api/search?q=kowalski", headers: {} });

    expect(fields).toEqual({ method: "GET", path: "/api/search", forwardedHops: 0 });
  });

  it("counts the X-Forwarded-For entries without logging the addresses", () => {
    const fields = requestLogFields({
      method: "GET",
      url: "/",
      headers: { "x-forwarded-for": "203.0.113.7, 198.51.100.2" },
    });

    expect(fields.forwardedHops).toBe(2);
    expect(JSON.stringify(fields)).not.toContain("203.0.113.7");
  });
});
