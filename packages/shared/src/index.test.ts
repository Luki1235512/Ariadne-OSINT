import { describe, expect, it } from "vitest";
import { SHARED_PACKAGE } from "./index.js";

describe("shared package", () => {
  it("exports its package name", () => {
    expect(SHARED_PACKAGE).toBe("@ariadne/shared");
  });
});
