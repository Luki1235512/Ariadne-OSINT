import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { acceptsGzip, gzipBuffer } from "./compression.js";

describe("acceptsGzip", () => {
  it.each([
    ["gzip, deflate, br", true],
    ["br;q=1.0, gzip;q=0.8", true],
    ["GZIP", true],
    ["*", true],
    ["br", false],
    ["gzip;q=0", false],
    ["", false],
    [undefined, false],
  ])("%s → %s", (header, expected) => {
    expect(acceptsGzip(header)).toBe(expected);
  });
});

describe("gzipBuffer", () => {
  it("compresses losslessly", async () => {
    const data = Buffer.from("tile ".repeat(1000));
    const compressed = await gzipBuffer(data);

    expect(compressed.length).toBeLessThan(data.length);
    expect(gunzipSync(compressed).equals(data)).toBe(true);
  });
});
