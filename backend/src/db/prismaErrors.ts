import { Prisma } from '@prisma/client';

/**
 * True when `error` is a Prisma unique-constraint violation (P2002).
 *
 * This is the single, documented predicate for "a row already exists with this
 * unique key". It is an `instanceof` check on `PrismaClientKnownRequestError`
 * rather than a duck-typed `code === 'P2002'` lookup, so a stray error object
 * that happens to carry a `code` field can never be misclassified, and callers
 * in tests build a real `PrismaClientKnownRequestError` double.
 */
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
