import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import type { PrismaClient, User } from '@prisma/client';

import { AppError } from '../../plugins/errors.js';
import { isUniqueConstraintError } from '../../db/prismaErrors.js';
import { randomToken, sha256Hex, timingSafeEquals } from '../../lib/crypto.js';
import { isValidDisplayName, normalizeDisplayName } from '../../domain/identity.js';

const SCRYPT_N = 1 << 17;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_BYTES = 64;
const SCRYPT_MAXMEM = 256 * 1024 * 1024;
/**
 * One scrypt call needs ~128 MB. Bound concurrent hashes and queue depth so a
 * burst of login or registration requests cannot exhaust heap or sockets.
 */
export const MAX_CONCURRENT_SCRYPT = 2;
export const MAX_SCRYPT_QUEUE = 20;
export const SCRYPT_QUEUE_TIMEOUT_MS = 2_000;
export const AUTH_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const AUTH_SESSION_IDLE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
export const EMAIL_CHANGE_TTL_MS = 60 * 60 * 1000;
export const LOGIN_MAX_FAILURES = 10;
export const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;
/** Only refresh `lastUsedAt` occasionally; session reads should not write on every request. */
const SESSION_LAST_USED_WRITE_INTERVAL_MS = 60 * 1000;

export class AuthError extends AppError {
  public constructor(
    statusCode: number,
    message: string,
    /** Stable machine-readable code surfaced in the API error envelope. */
    appCode?: string,
  ) {
    super(statusCode, message, appCode);
  }
}

interface ScryptWaiter {
  grant: () => void;
  settled: boolean;
}

let activeScryptCalls = 0;
const scryptWaiters: ScryptWaiter[] = [];

export async function acquireScryptSlot(
  options: { maxQueue?: number; timeoutMs?: number } = {},
): Promise<void> {
  const maxQueue = options.maxQueue ?? MAX_SCRYPT_QUEUE;
  const timeoutMs = options.timeoutMs ?? SCRYPT_QUEUE_TIMEOUT_MS;

  if (activeScryptCalls < MAX_CONCURRENT_SCRYPT) {
    activeScryptCalls += 1;
    return;
  }
  if (scryptWaiters.length >= maxQueue) {
    throw new AuthError(
      503,
      'Authentication service is busy. Please retry shortly.',
      'AUTH_BUSY',
    );
  }

  await new Promise<void>((resolve, reject) => {
    const waiter: ScryptWaiter = {
      settled: false,
      grant: () => {
        if (waiter.settled) return;
        waiter.settled = true;
        clearTimeout(timer);
        resolve();
      },
    };

    const timer = setTimeout(() => {
      if (waiter.settled) return;
      waiter.settled = true;
      const index = scryptWaiters.indexOf(waiter);
      if (index >= 0) scryptWaiters.splice(index, 1);
      reject(
        new AuthError(
          503,
          'Authentication service is busy. Please retry shortly.',
          'AUTH_BUSY',
        ),
      );
    }, timeoutMs);
    timer.unref();

    scryptWaiters.push(waiter);
  });
}

export function releaseScryptSlot(): void {
  while (scryptWaiters.length > 0) {
    const next = scryptWaiters.shift()!;
    if (!next.settled) {
      // Transfer the active slot directly so no concurrent caller can jump
      // ahead and exceed MAX_CONCURRENT_SCRYPT before the microtask resumes.
      next.grant();
      return;
    }
  }
  activeScryptCalls = Math.max(0, activeScryptCalls - 1);
}

async function scrypt(password: string, salt: Buffer, length: number, n: number): Promise<Buffer> {
  await acquireScryptSlot();
  try {
    return await new Promise((resolve, reject) => {
      scryptCallback(password, salt, length, { N: n, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAXMEM }, (error, key) => {
        if (error) reject(error);
        else resolve(key);
      });
    });
  } finally {
    releaseScryptSlot();
  }
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
  return Boolean(validFormat && timingSafeEquals(actual, expected));
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** SHA-256 hex digest (ADR-0011: store/compare hashes only). */
export const hashSecret = sha256Hex;

/** A 256-bit opaque token (base64url). */
export const createOpaqueToken = randomToken;

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

/**
 * Creates an unverified email/password account. Sign-in is blocked until the
 * address is proven through `consumeEmailVerification`; callers send the link.
 */
export async function registerWithEmail(
  db: PrismaClient,
  input: { email: string; password: string; displayName: string },
): Promise<User> {
  const email = normalizeEmail(input.email);
  const displayName = normalizeDisplayName(input.displayName);
  if (displayName === null || !isValidDisplayName(displayName))
    throw new AuthError(400, 'Display name must be 2–40 characters');
  // Check before the expensive hash; the unique constraint below still handles races.
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw new AuthError(409, 'An account with this email already exists');
  const passwordHash = await hashPassword(input.password);
  try {
    return await db.user.create({ data: { email, passwordHash, displayName } });
  } catch (cause) {
    if (isUniqueConstraintError(cause)) {
      throw new AuthError(409, 'An account with this email already exists');
    }
    throw cause;
  }
}

/** Issues a single-use verification token, invalidating any outstanding ones. */
export async function issueEmailVerification(db: PrismaClient, userId: string): Promise<string> {
  const token = createOpaqueToken();
  await db.$transaction(async (tx) => {
    await tx.emailVerificationToken.deleteMany({ where: { userId, consumedAt: null } });
    await tx.emailVerificationToken.create({ data: {
      userId,
      tokenHash: hashSecret(token),
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    } });
  });
  return token;
}

export async function consumeEmailVerification(db: PrismaClient, token: string): Promise<User> {
  return db.$transaction(async (tx) => {
    const row = await tx.emailVerificationToken.findUnique({ where: { tokenHash: hashSecret(token) } });
    if (!row || row.consumedAt || row.expiresAt.getTime() <= Date.now()) {
      throw new AuthError(400, 'Verification link is invalid or expired', 'INVALID_VERIFICATION_TOKEN');
    }
    const consumed = await tx.emailVerificationToken.updateMany({
      where: { id: row.id, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) {
      throw new AuthError(400, 'Verification link is invalid or expired', 'INVALID_VERIFICATION_TOKEN');
    }
    return tx.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date() } });
  });
}

export interface EmailChangeRequestTokens {
  requestId: string;
  newEmail: string;
  oldToken: string;
  newToken: string;
}

/**
 * Starts a double-confirmation address change. Nothing on `User` changes until
 * both the current inbox (a veto) and the proposed inbox (proof of control)
 * confirm. Requiring the current password raises the bar for session hijacks.
 */
export async function requestEmailChange(
  db: PrismaClient,
  user: User,
  input: { newEmail: string; currentPassword?: string },
): Promise<EmailChangeRequestTokens> {
  const newEmail = normalizeEmail(input.newEmail);
  if (newEmail === user.email) {
    throw new AuthError(400, 'Choose a different email address', 'EMAIL_UNCHANGED');
  }
  if (user.passwordHash && !(await verifyPassword(input.currentPassword ?? '', user.passwordHash))) {
    throw new AuthError(401, 'Current password is incorrect');
  }
  const existing = await db.user.findUnique({ where: { email: newEmail } });
  if (existing) throw new AuthError(409, 'An account with this email already exists', 'EMAIL_IN_USE');

  const oldToken = createOpaqueToken();
  const newToken = createOpaqueToken();
  const requestId = await db.$transaction(async (tx) => {
    // Only the newest request is valid, so stale links cannot resurface later.
    await tx.emailChangeRequest.deleteMany({ where: { userId: user.id, completedAt: null } });
    const request = await tx.emailChangeRequest.create({ data: {
      userId: user.id,
      oldEmail: user.email,
      newEmail,
      oldTokenHash: hashSecret(oldToken),
      newTokenHash: hashSecret(newToken),
      expiresAt: new Date(Date.now() + EMAIL_CHANGE_TTL_MS),
    } });
    return request.id;
  });
  return { requestId, newEmail, oldToken, newToken };
}

export interface EmailChangeConfirmation {
  /** Which inbox link was just opened. */
  side: 'old' | 'new';
  /** True only when this confirmation completed the change. */
  changed: boolean;
  email?: string;
  /** The inbox that still has to confirm, or null once the change is applied. */
  pending: 'old' | 'new' | null;
}

/** Consumes one side of a pending change; applies it only when both are confirmed. */
export async function confirmEmailChange(db: PrismaClient, token: string): Promise<EmailChangeConfirmation> {
  const tokenHash = hashSecret(token);
  try {
    return await db.$transaction(async (tx) => {
      const now = new Date();
      const found = await tx.emailChangeRequest.findFirst({
        where: { OR: [{ oldTokenHash: tokenHash }, { newTokenHash: tokenHash }] },
      });
      if (!found) {
        throw new AuthError(400, 'Email change link is invalid or expired', 'INVALID_EMAIL_CHANGE_TOKEN');
      }
      // Serialize the two inbox confirmations: without the row lock, both
      // could read "one side confirmed" concurrently and neither apply.
      await tx.$queryRaw`SELECT "id" FROM "EmailChangeRequest" WHERE "id" = ${found.id} FOR UPDATE`;
      const request = await tx.emailChangeRequest.findUnique({ where: { id: found.id } });
      if (!request || request.completedAt || request.expiresAt.getTime() <= now.getTime()) {
        throw new AuthError(400, 'Email change link is invalid or expired', 'INVALID_EMAIL_CHANGE_TOKEN');
      }
      const side: 'old' | 'new' = request.oldTokenHash === tokenHash ? 'old' : 'new';
      if ((side === 'old' && request.oldConfirmedAt) || (side === 'new' && request.newConfirmedAt)) {
        throw new AuthError(400, 'Email change link is invalid or expired', 'INVALID_EMAIL_CHANGE_TOKEN');
      }

      const updated = await tx.emailChangeRequest.updateMany({
        where: {
          id: request.id,
          completedAt: null,
          expiresAt: { gt: now },
          ...(side === 'old' ? { oldConfirmedAt: null } : { newConfirmedAt: null }),
        },
        data: side === 'old' ? { oldConfirmedAt: now } : { newConfirmedAt: now },
      });
      if (updated.count !== 1) {
        throw new AuthError(400, 'Email change link is invalid or expired', 'INVALID_EMAIL_CHANGE_TOKEN');
      }

      const current = await tx.emailChangeRequest.findUniqueOrThrow({ where: { id: request.id } });
      if (!current.oldConfirmedAt || !current.newConfirmedAt) {
        return { side, changed: false, pending: side === 'old' ? 'new' : 'old' };
      }

      const user = await tx.user.findUnique({ where: { id: current.userId } });
      if (!user || user.email !== current.oldEmail) {
        throw new AuthError(400, 'Email change link is invalid or expired', 'INVALID_EMAIL_CHANGE_TOKEN');
      }
      const taken = await tx.user.findFirst({ where: { email: current.newEmail, NOT: { id: user.id } } });
      if (taken) throw new AuthError(409, 'An account with this email already exists', 'EMAIL_IN_USE');

      const changedUser = await tx.user.update({
        where: { id: user.id },
        data: { email: current.newEmail, emailVerifiedAt: now },
      });
      await tx.emailChangeRequest.update({ where: { id: current.id }, data: { completedAt: now } });
      await tx.emailChangeRequest.deleteMany({ where: { userId: user.id, completedAt: null, NOT: { id: current.id } } });
      // Email is identity: force every existing session to sign in again.
      await tx.authSession.deleteMany({ where: { userId: user.id } });
      return { side, changed: true, email: changedUser.email, pending: null };
    });
  } catch (cause) {
    if (isUniqueConstraintError(cause)) {
      throw new AuthError(409, 'An account with this email already exists', 'EMAIL_IN_USE');
    }
    throw cause;
  }
}

/**
 * Atomically increments the failed-login counter within the failure window and
 * sets `lockedUntil` once `LOGIN_MAX_FAILURES` is reached. Using a single SQL
 * UPDATE prevents concurrent wrong-password requests from overwriting each
 * other with stale pre-scrypt counts and bypassing account lockout.
 */
async function recordFailedLogin(db: PrismaClient, userId: string, now: Date): Promise<void> {
  const windowStart = new Date(now.getTime() - LOGIN_FAILURE_WINDOW_MS);
  const lockUntil = new Date(now.getTime() + LOGIN_LOCK_MS);
  await db.$executeRaw`
    UPDATE "User"
    SET
      "failedLoginAttempts" = CASE
        WHEN "lastFailedLoginAt" IS NOT NULL AND "lastFailedLoginAt" > ${windowStart}
          THEN "failedLoginAttempts" + 1
        ELSE 1
      END,
      "lockedUntil" = CASE
        WHEN (
          CASE
            WHEN "lastFailedLoginAt" IS NOT NULL AND "lastFailedLoginAt" > ${windowStart}
              THEN "failedLoginAttempts" + 1
            ELSE 1
          END
        ) >= ${LOGIN_MAX_FAILURES}
          THEN ${lockUntil}
        ELSE "lockedUntil"
      END,
      "lastFailedLoginAt" = ${now},
      "updatedAt" = ${now}
    WHERE "id" = ${userId}
  `;
}

export async function loginWithEmail(
  db: PrismaClient,
  input: { email: string; password: string },
): Promise<{ user: User; sessionToken: string }> {
  const now = new Date();
  const user = await db.user.findUnique({ where: { email: normalizeEmail(input.email) } });
  if (user?.lockedUntil && user.lockedUntil.getTime() > now.getTime()) {
    // Reject before hashing: a locked account must not consume scrypt memory.
    throw new AuthError(429, 'Too many sign-in attempts. Try again later.', 'LOGIN_LOCKED');
  }
  const passwordOk = await verifyPassword(input.password, user?.passwordHash ?? null);
  if (!user || !passwordOk) {
    if (user) await recordFailedLogin(db, user.id, new Date());
    throw new AuthError(401, 'Email or password is incorrect');
  }
  if (!user.emailVerifiedAt) {
    throw new AuthError(403, 'Verify your email address before signing in', 'EMAIL_NOT_VERIFIED');
  }
  if (user.failedLoginAttempts !== 0 || user.lastFailedLoginAt !== null || user.lockedUntil !== null) {
    await db.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lastFailedLoginAt: null, lockedUntil: null },
    });
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
  const now = Date.now();
  if (
    session.expiresAt.getTime() <= now ||
    session.lastUsedAt.getTime() <= now - AUTH_SESSION_IDLE_TTL_MS
  ) {
    await db.authSession.deleteMany({ where: { id: session.id } });
    return null;
  }
  if (now - session.lastUsedAt.getTime() > SESSION_LAST_USED_WRITE_INTERVAL_MS) {
    await db.authSession.updateMany({ where: { id: session.id }, data: { lastUsedAt: new Date(now) } });
  }
  return session.user;
}

export async function revokeSession(db: PrismaClient, rawToken: string | undefined): Promise<void> {
  if (rawToken) await db.authSession.deleteMany({ where: { tokenHash: hashSecret(rawToken) } });
}

/** Issues a single-use reset token, invalidating any outstanding ones. */
export async function issuePasswordReset(db: PrismaClient, user: User): Promise<string> {
  const token = createOpaqueToken();
  await db.$transaction(async (tx) => {
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id, consumedAt: null } });
    await tx.passwordResetToken.create({ data: {
      userId: user.id,
      tokenHash: hashSecret(token),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    } });
  });
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
    // Completing a reset proves control of the address, so it also verifies it.
    // Clear any sign-in lock so the new password works immediately.
    await tx.user.update({
      where: { id: row.userId },
      data: {
        passwordHash,
        emailVerifiedAt: new Date(),
        failedLoginAttempts: 0,
        lastFailedLoginAt: null,
        lockedUntil: null,
      },
    });
    await tx.authSession.deleteMany({ where: { userId: row.userId } });
  });
}
