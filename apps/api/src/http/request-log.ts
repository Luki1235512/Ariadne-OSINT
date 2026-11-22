export interface LoggedRequest {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
}

export function requestLogFields(request: LoggedRequest): Record<string, string | number> {
  const header = request.headers["x-forwarded-for"];
  const forwarded = Array.isArray(header) ? header.join(",") : (header ?? "");
  return {
    method: request.method,
    path: request.url.split("?", 1)[0] ?? "",
    forwardedHops: forwarded.split(",").filter((entry) => entry.trim() !== "").length,
  };
}
