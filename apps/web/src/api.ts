import type { ObjectDetails } from "@ariadne/shared";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function getJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal, headers: { accept: "application/json" } });
  if (!response.ok) {
    let code = "UNKNOWN";
    let message = `Request failed with status ${String(response.status)}`;
    try {
      const body = (await response.json()) as { error?: { code?: unknown; message?: unknown } };
      if (typeof body.error?.code === "string") {
        code = body.error.code;
      }
      if (typeof body.error?.message === "string") {
        message = body.error.message;
      }
    } catch {
      // Not our JSON error format, for example a proxy error page. Keep the defaults.
    }
    throw new ApiError(response.status, code, message);
  }
  return (await response.json()) as T;
}

export function fetchObjectDetails(id: string, signal: AbortSignal): Promise<ObjectDetails> {
  return getJson<ObjectDetails>(`/api/objects/${encodeURIComponent(id)}`, signal);
}
