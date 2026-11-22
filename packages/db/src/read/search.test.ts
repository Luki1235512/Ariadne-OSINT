import { describe, expect, it } from "vitest";
import { escapeLike } from "./search.js";

describe("escapeLike", () => {
  it("escapes the LIKE wildcards and the escape character", () => {
    expect(escapeLike("100%")).toBe("100\\%");
    expect(escapeLike("a_b")).toBe("a\\_b");
    expect(escapeLike("c:\\x")).toBe("c:\\\\x");
  });

  it("leaves ordinary text alone", () => {
    expect(escapeLike("Łódź")).toBe("Łódź");
  });
});
