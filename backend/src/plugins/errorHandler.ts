import type {
  FastifyError,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';

import { AppError } from './errors.js';

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
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
  500: 'INTERNAL_ERROR',
};

const DEFAULT_CLIENT_MESSAGES: Record<number, string> = {
  400: 'Bad request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not found',
  409: 'Conflict',
  413: 'Payload too large',
  415: 'Unsupported media type',
  429: 'Too many requests',
};

interface ResolvedError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

function resolveError(error: FastifyError): ResolvedError {
  if (error.validation) {
    return {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: error.message || 'Validation failed',
      details: error.validation,
    };
  }

  // Deliberate domain errors (`AppError` subclasses such as AuthError,
  // PanoramaError, LobbyConflictError) own their HTTP status, stable code,
  // and user-safe message (including actionable 503 messages per R13).
  if (error instanceof AppError) {
    const statusCode = error.statusCode;
    const code =
      typeof error.code === 'string' && error.code.length > 0
        ? error.code
        : (STATUS_CODE_MAP[statusCode] ?? 'INTERNAL_ERROR');
    return {
      statusCode,
      code,
      message: error.message || 'Request failed',
    };
  }

  // Framework-generated 4xx errors (e.g., @fastify/rate-limit 429 or Fastify's
  // malformed-JSON 400) keep their 4xx status, but never leak internal error
  // codes (like FST_ERR_*) or raw exception text.
  const rawStatus = error.statusCode;
  if (typeof rawStatus === 'number' && rawStatus >= 400 && rawStatus < 500) {
    return {
      statusCode: rawStatus,
      code: STATUS_CODE_MAP[rawStatus] ?? 'REQUEST_ERROR',
      message: DEFAULT_CLIENT_MESSAGES[rawStatus] ?? 'Request failed',
    };
  }

  // All other errors (unhandled Prisma P* errors, Node ECONNREFUSED, Fastify
  // 5xx, upstream 502/504) are masked uniformly as 500 INTERNAL_ERROR.
  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
  };
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
      const { statusCode, code, message, details } = resolveError(error);

      const envelope: ErrorEnvelope = {
        error: {
          code,
          message,
          ...(details !== undefined ? { details } : {}),
        },
      };

      if (statusCode >= 500) {
        request.log.error({ err: error, statusCode, code }, 'request failed');
      } else {
        request.log.warn({ err: error, statusCode, code }, 'request failed');
      }

      reply.status(statusCode).send(envelope);
    },
  );
}
