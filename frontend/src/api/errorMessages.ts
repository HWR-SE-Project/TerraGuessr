import { ApiError } from './client';

/**
 * Shared ADR-0009 error-envelope-to-copy boilerplate (previously duplicated,
 * near-identically, across App.tsx, ChallengePanel.tsx and
 * ChallengeJoinFlow.tsx). Each call site supplies only the codes it has
 * specific user-facing copy for; anything else falls back to the server's
 * own message, then to a generic fallback for a non-ApiError failure.
 */
export function mapApiError(error: unknown, messages: Partial<Record<string, string>>): string {
  if (error instanceof ApiError) {
    return messages[error.code] ?? error.message;
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}
