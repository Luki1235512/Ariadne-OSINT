import { promisify } from "node:util";
import { gzip } from "node:zlib";

export const gzipBuffer = promisify(gzip);

export function acceptsGzip(header: string | string[] | undefined): boolean {
  const value = Array.isArray(header) ? header.join(",") : (header ?? "");
  return value.split(",").some((entry) => {
    const [name = "", ...params] = entry.split(";").map((part) => part.trim().toLowerCase());
    if (name !== "gzip" && name !== "*") {
      return false;
    }
    const quality = params.find((param) => param.startsWith("q="));
    return quality === undefined || Number(quality.slice(2)) > 0;
  });
}
