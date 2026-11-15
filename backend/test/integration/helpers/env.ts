/**
 * Sets `DATABASE_URL` before anything transitively imports `db/prisma.ts`
 * (whose module body constructs a PrismaClient). Must be the FIRST import of
 * every integration test file, and is imported first by `database.ts` too.
 *
 * The value mirrors docker-compose.test.yml / CI: a disposable test database.
 * It is a default only — a real `DATABASE_URL` from the environment always wins.
 */

export const TEST_DEFAULT_DATABASE_URL =
  'postgresql://terraguessr:terraguessr@localhost:5432/terraguessr_test';

process.env.DATABASE_URL ??= TEST_DEFAULT_DATABASE_URL;
