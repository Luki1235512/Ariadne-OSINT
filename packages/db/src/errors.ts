export type DbErrorCode =
  | "INVALID_INPUT"
  | "NO_SOURCES"
  | "UNKNOWN_SOURCE"
  | "OBJECT_TYPE_MISMATCH"
  | "LINK_TYPE_MISMATCH"
  | "MISSING_OBJECT"
  | "LINK_ENDPOINT_NOT_ALLOWED";

export class DbWriteError extends Error {
  override readonly name = "DbWriteError";

  constructor(
    readonly code: DbErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}
