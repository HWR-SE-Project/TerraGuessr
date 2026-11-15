import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import type { PrismaClient, User } from '@prisma/client';

const SCRYPT_N = 1 << 17;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_BYTES = 64;
const SCRYPT_MAXMEM = 256 * 1024 * 1024;
export const AUTH_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

export class AuthError extends Error {
  public constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

function scrypt(password: string, salt: Buffer, length: number, n: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, length, { N: n, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/** OWASP-recommended scrypt profile when Argon2id is unavailable. */
export async function hashPassword(password: string): Promise<string> {
  if (Buffer.byteLength(password, 'utf8') < 12 || Buffer.byteLength(password, 'utf8') > 256) {
    throw new AuthError(400, 'Password must be between 12 and 256 UTF-8 bytes');
  }
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT_KEY_BYTES, SCRYPT_N);
  return `scrypt$${SCRYPT_N}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

const DUMMY_SALT = Buffer.from('terraguessr-auth-dummy-salt');
export async function verifyPassword(password: string, storedHash: string | null): Promise<boolean> {
  const parts = storedHash?.split('$') ?? [];
  const n = Number(parts[1]);
  const salt = parts[2] ? Buffer.from(parts[2], 'base64url') : DUMMY_SALT;
  const expected = parts[3] ? Buffer.from(parts[3], 'base64url') : Buffer.alloc(SCRYPT_KEY_BYTES);
  const validFormat = parts[0] === 'scrypt' && n === SCRYPT_N && salt.length === 16 && expected.length === SCRYPT_KEY_BYTES;
  const actual = await scrypt(password, salt, SCRYPT_KEY_BYTES, validFormat ? n : SCRYPT_N);
  return Boolean(validFormat && timingSafeEqual(actual, expected));
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashSecret(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function createOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export type PublicUser = Pick<User, 'id' | 'email' | 'displayName' | 'emailVerifiedAt' | 'createdAt'> & {
  hasPassword: boolean;
  hasGoogle: boolean;
};

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
    hasPassword: user.passwordHash !== null,
    hasGoogle: user.googleSub !== null,
  };
}

export async function createUserSession(db: PrismaClient, userId: string): Promise<string> {
  const token = createOpaqueToken();
  await db.authSession.create({
    data: {
      userId,
      tokenHash: hashSecret(token),
      expiresAt: new Date(Date.now() + AUTH_SESSION_TTL_MS),
    },
  });
  return token;
}

export async function registerWithEmail(
  db: PrismaClient,
  input: { email: string; password: string; displayName: string },
): Promise<{ user: User; sessionToken: string }> {
  const email = normalizeEmail(input.email);
  const displayName = input.displayName.trim();
  if (displayName.length < 2 || displayName.length > 40) throw new AuthError(400, 'Display name must be 2–40 characters');
  const passwordHash = await hashPassword(input.password);
  const sessionToken = createOpaqueToken();
  try {
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { email, passwordHash, displayName } });
      await tx.authSession.create({ data: {
        userId: created.id,
        tokenHash: hashSecret(sessionToken),
        expiresAt: new Date(Date.now() + AUTH_SESSION_TTL_MS),
      } });
      return created;
    });
    return { user, sessionToken };
  } catch (cause) {
    if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 'P2002') {
      throw new AuthError(409, 'An account with this email already exists');
    }
    throw cause;
  }
}

export async function loginWithEmail(
  db: PrismaClient,
  input: { email: string; password: string },
): Promise<{ user: User; sessionToken: string }> {
  const user = await db.user.findUnique({ where: { email: normalizeEmail(input.email) } });
  if (!(await verifyPassword(input.password, user?.passwordHash ?? null)) || !user) {
    throw new AuthError(401, 'Email or password is incorrect');
  }
  return { user, sessionToken: await createUserSession(db, user.id) };
}

export async function findSessionUser(db: PrismaClient, rawToken: string | undefined): Promise<User | null> {
  if (!rawToken) return null;
  const session = await db.authSession.findUnique({
    where: { tokenHash: hashSecret(rawToken) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await db.authSession.deleteMany({ where: { id: session.id } });
    return null;
  }
  return session.user;
}

export async function revokeSession(db: PrismaClient, rawToken: string | undefined): Promise<void> {
  if (rawToken) await db.authSession.deleteMany({ where: { tokenHash: hashSecret(rawToken) } });
}

export async function issuePasswordReset(db: PrismaClient, user: User): Promise<string> {
  const token = createOpaqueToken();
  await db.passwordResetToken.create({ data: {
    userId: user.id,
    tokenHash: hashSecret(token),
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
  } });
  return token;
}

export async function consumePasswordReset(db: PrismaClient, token: string, password: string): Promise<void> {
  const passwordHash = await hashPassword(password);
  await db.$transaction(async (tx) => {
    const row = await tx.passwordResetToken.findUnique({ where: { tokenHash: hashSecret(token) } });
    if (!row || row.consumedAt || row.expiresAt.getTime() <= Date.now()) {
      throw new AuthError(400, 'Reset link is invalid or expired');
    }
    const consumed = await tx.passwordResetToken.updateMany({
      where: { id: row.id, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) throw new AuthError(400, 'Reset link is invalid or expired');
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
    await tx.authSession.deleteMany({ where: { userId: row.userId } });
  });
}
