import type { FastifyError, FastifyInstance, FastifyReply } from "fastify";

export type ErrorCode = "INVALID_REQUEST" | "NOT_FOUND" | "DATABASE_UNAVAILABLE" | "INTERNAL_ERROR";

export interface ErrorBody {
  error: { code: ErrorCode; message: string };
}

export function sendError(
  reply: FastifyReply,
  status: number,
  code: ErrorCode,
  message: string,
): FastifyReply {
  const body: ErrorBody = { error: { code, message } };
  return reply.code(status).send(body);
}

export function loggableError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { type: typeof error };
  }
  const code = (error as { code?: unknown }).code;
  return {
    type: error.name,
    message: error.message,
    ...(typeof code === "string" ? { code } : {}),
    stack: error.stack,
  };
}

export function registerErrorHandlers(app: FastifyInstance): void {
  app.setNotFoundHandler((_request, reply) => sendError(reply, 404, "NOT_FOUND", "Not found"));

  app.setErrorHandler((error: FastifyError, request, reply) => {
    const status = error.statusCode;
    if (status !== undefined && status >= 400 && status < 500) {
      return sendError(reply, status, "INVALID_REQUEST", error.message);
    }
    request.log.error({ err: loggableError(error) }, "request failed");
    return sendError(reply, 500, "INTERNAL_ERROR", "Internal error");
  });
}
