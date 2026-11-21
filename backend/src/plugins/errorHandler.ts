import type {
  FastifyError,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';

interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

const STATUS_CODE_MAP: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
  500: 'INTERNAL_ERROR',
};

function resolveCode(error: FastifyError): string {
  if (error.validation) {
    return 'VALIDATION_ERROR';
  }
  // Domain errors may set a stable app-level code (e.g. EMAIL_NOT_VERIFIED or
  // MISSING_SERVER_KEY). Legacy errors used `appCode`; `AppError` uses `code`.
  // Read both so the envelope stays uniform across modules.
  const code = (error as FastifyError & { code?: unknown }).code;
  const appCode = (error as FastifyError & { appCode?: unknown }).appCode;
  const resolved = typeof code === 'string' && code.length > 0
    ? code
    : typeof appCode === 'string' && appCode.length > 0
      ? appCode
      : undefined;
  if (resolved !== undefined) {
    return resolved;
  }
  const statusCode = error.statusCode ?? 500;
  return STATUS_CODE_MAP[statusCode] ?? 'INTERNAL_ERROR';
}

function resolveMessage(error: FastifyError): string {
  const statusCode = error.statusCode ?? 500;
  if (statusCode >= 500) {
    return 'Internal server error';
  }
  return error.message || 'Request failed';
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
      const statusCode = error.statusCode ?? 500;
      const code = resolveCode(error);

      const envelope: ErrorEnvelope = {
        error: {
          code,
          message: resolveMessage(error),
        },
      };

      if (error.validation) {
        envelope.error.details = error.validation;
      }

      request.log.error({ err: error, statusCode, code }, 'request failed');

      reply.status(statusCode).send(envelope);
    },
  );
}
