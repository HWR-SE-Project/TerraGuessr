import { ApiError } from './client'

/**
 * Maps an ApiError's code to call-site-specific copy; falls back to the
 * server's own message, then to a generic fallback for a non-ApiError failure.
 */
export function mapApiError(error: unknown, messages: Partial<Record<string, string>> = {}): string {
  if (error instanceof ApiError) {
    return messages[error.code] ?? error.message
  }
  return error instanceof Error ? error.message : 'Something went wrong.'
}
