import './helpers/env.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { registerErrorHandler } from '../../src/plugins/errorHandler.js';
import { registerAuthRoutes } from '../../src/modules/auth/routes.js';
import type { AuthMailMessage } from '../../src/modules/auth/mailer.js';
import { hashSecret, issuePasswordReset } from '../../src/modules/auth/service.js';
import type { Env } from '../../src/config/env.js';
import { setupDatabase, teardownDatabase } from './helpers/database.js';

const PASSWORD = 'correct horse battery';

function tokenFrom(message: AuthMailMessage): string {
  const match = /[?&]token=([A-Za-z0-9_-]+)/.exec(message.text);
  if (!match?.[1]) throw new Error('verification email did not contain a token');
  return match[1];
}

describe('account authentication (integration)', () => {
  let db: PrismaClient;
  let app: FastifyInstance;
  const sent: AuthMailMessage[] = [];

  beforeAll(async () => {
    db = await setupDatabase();
    app = Fastify({ logger: { level: 'silent' } });
    registerErrorHandler(app);
    const config: Env = {
      databaseUrl: process.env.DATABASE_URL!,
      nodeEnv: 'test',
      port: 3000,
      corsOrigin: false,
      adminApiToken: '',
      openMeteoBaseUrl: 'https://api.open-meteo.com',
      logLevel: 'silent',
      appBaseUrl: 'http://localhost:8080',
      sessionCookieSecure: false,
      trustProxy: false,
    };
    registerAuthRoutes(app, { db, config, mailer: async (message) => { sent.push(message); } });
  });
  beforeEach(() => { sent.length = 0; });
  afterAll(async () => { await app.close(); await teardownDatabase(db); });

  async function registerVerified(email: string, displayName: string) {
    const registration = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, displayName, password: PASSWORD } });
    expect(registration.statusCode).toBe(201);
    const message = sent.find((item) => item.to === email);
    expect(message).toBeTruthy();
    const token = tokenFrom(message!);
    const verify = await app.inject({ method: 'POST', url: '/api/auth/verify-email', payload: { token } });
    expect(verify.statusCode).toBe(200);
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: PASSWORD } });
    expect(login.statusCode).toBe(200);
    return { cookie: String(login.headers['set-cookie']).split(';')[0]!, userId: login.json().user.id as string, token };
  }

  it('saves supported avatar colors per account and restores them after a new sign-in', async () => {
    const first = await registerVerified(`avatar-a-${Date.now()}@example.test`, 'Explorer A');
    const second = await registerVerified(`avatar-b-${Date.now()}@example.test`, 'Explorer B');
    const appearance = { version: 1, hairColor: '#a58bd7', eyeColor: '#378bce', shirtColor: '#e67b58', pantsColor: '#333b67', shoeColor: null };
    expect((await app.inject({ method: 'GET', url: '/api/auth/avatar' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'PATCH', url: '/api/auth/avatar', payload: appearance })).statusCode).toBe(401);
    const saved = await app.inject({ method: 'PATCH', url: '/api/auth/avatar', headers: { cookie: first.cookie }, payload: appearance });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().avatarConfig).toEqual(appearance);
    expect((await db.userPreference.findUniqueOrThrow({ where: { userId: first.userId } })).avatarConfig).toEqual(appearance);
    expect((await app.inject({ method: 'GET', url: '/api/auth/avatar', headers: { cookie: second.cookie } })).json().avatarConfig).toBeNull();
    const email = (await db.user.findUniqueOrThrow({ where: { id: first.userId } })).email;
    await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie: first.cookie } });
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: PASSWORD } });
    const cookie = String(login.headers['set-cookie']).split(';')[0]!;
    expect((await app.inject({ method: 'GET', url: '/api/auth/avatar', headers: { cookie } })).json().avatarConfig).toEqual(appearance);
    for (const payload of [{ ...appearance, shirtColor: 'red' }, { ...appearance, version: 9 }, { version: 1 }]) {
      expect((await app.inject({ method: 'PATCH', url: '/api/auth/avatar', headers: { cookie }, payload })).statusCode).toBe(400);
    }
    expect((await app.inject({ method: 'PATCH', url: '/api/auth/avatar', headers: { cookie, origin: 'https://other.example' }, payload: appearance })).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/api/auth/avatar', headers: { cookie } })).json().avatarConfig).toEqual(appearance);
  });

  it('requires email verification before login and keeps only hashes of cookies', async () => {
    const email = `auth-${Date.now()}@example.test`;
    const registration = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, displayName: 'Map Reader', password: PASSWORD } });
    expect(registration.statusCode).toBe(201);
    expect(registration.json()).toMatchObject({ verificationRequired: true });
    expect(registration.headers['set-cookie']).toBeUndefined();

    const message = sent.find((item) => item.to === email);
    expect(message?.subject).toMatch(/verify/i);
    const token = tokenFrom(message!);

    const blocked = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: PASSWORD } });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().error.code).toBe('EMAIL_NOT_VERIFIED');

    const verify = await app.inject({ method: 'POST', url: '/api/auth/verify-email', payload: { token } });
    expect(verify.statusCode).toBe(200);
    expect(verify.json().user).toMatchObject({ email, emailVerifiedAt: expect.any(String) });
    expect((await app.inject({ method: 'POST', url: '/api/auth/verify-email', payload: { token } })).statusCode).toBe(400);

    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: PASSWORD } });
    expect(login.statusCode).toBe(200);
    expect(login.headers['set-cookie']).toContain('HttpOnly');
    expect(login.headers['set-cookie']).toContain('SameSite=Lax');
    const cookie = String(login.headers['set-cookie']).split(';')[0]!;
    const session = await app.inject({ url: '/api/auth/session', headers: { cookie } });
    expect(session.json().user).toMatchObject({ email, displayName: 'Map Reader', hasPassword: true });

    const rawToken = cookie.slice('tg_session='.length);
    const persisted = await db.authSession.findFirst({ where: { userId: session.json().user.id } });
    expect(persisted?.tokenHash).not.toBe(rawToken);
    expect(persisted?.tokenHash).toHaveLength(64);

    expect((await app.inject({ url: '/api/auth/session', headers: { cookie: 'tg_session=invalid' } })).json().user).toBeNull();
    const rejected = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: 'wrong password value' } });
    expect(rejected.statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } })).statusCode).toBe(204);
    expect((await app.inject({ url: '/api/auth/session', headers: { cookie } })).json().user).toBeNull();
  });

  it('resends a fresh verification link without revealing account state', async () => {
    const email = `resend-${Date.now()}@example.test`;
    expect((await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, displayName: 'Resend Me', password: PASSWORD } })).statusCode).toBe(201);
    sent.length = 0;

    const resend = await app.inject({ method: 'POST', url: '/api/auth/verification/resend', payload: { email } });
    expect(resend.statusCode).toBe(202);
    expect(sent).toHaveLength(1);
    expect(tokenFrom(sent[0]!)).toHaveLength(43);

    const unknown = await app.inject({ method: 'POST', url: '/api/auth/verification/resend', payload: { email: 'nobody@example.test' } });
    expect(unknown.statusCode).toBe(202);
    expect(sent).toHaveLength(1);
  });

  it('persists account preferences and deletes the account on confirmed deletion', async () => {
    const email = `delete-${Date.now()}@example.test`;
    const { cookie, userId } = await registerVerified(email, 'Delete Me');
    const pref = await app.inject({ method: 'PATCH', url: '/api/auth/preferences', headers: { cookie }, payload: { language: 'de', fullscreen: true } });
    expect(pref.json().preferences).toMatchObject({ language: 'de', fullscreen: true });
    const denied = await app.inject({ method: 'DELETE', url: '/api/auth/account', headers: { cookie }, payload: { confirmation: 'DELETE', currentPassword: 'wrong password value' } });
    expect(denied.statusCode).toBe(401);
    const deleted = await app.inject({ method: 'DELETE', url: '/api/auth/account', headers: { cookie }, payload: { confirmation: 'DELETE', currentPassword: PASSWORD } });
    expect(deleted.statusCode).toBe(204);
    expect(await db.user.findUnique({ where: { id: userId } })).toBeNull();
  });

  it('reports email verification availability and rejects cross-site mutations', async () => {
    expect((await app.inject({ url: '/api/auth/config' })).json()).toEqual({
      googleAvailable: false,
      passwordRecoveryAvailable: false,
      emailVerificationAvailable: true,
    });
    expect((await app.inject({ method: 'POST', url: '/api/auth/password-reset/request', payload: { email: 'nobody@example.test' } })).statusCode).toBe(503);
    const protectedProfile = await app.inject({ method: 'PATCH', url: '/api/auth/profile', payload: { displayName: 'No Access' } });
    expect(protectedProfile.statusCode).toBe(401);
    const crossSite = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin: 'https://attacker.example' }, payload: { email: 'nobody@example.test', password: 'long enough password' } });
    expect(crossSite.statusCode).toBe(403);
    expect(crossSite.json().error.code).toBe('FORBIDDEN');
  });

  it('changes an email only after the current and new addresses both confirm', async () => {
    const oldEmail = `change-old-${Date.now()}@example.test`;
    const newEmail = `change-new-${Date.now()}@example.test`;
    const { cookie, userId } = await registerVerified(oldEmail, 'Change Me');
    sent.length = 0;

    const wrongPassword = await app.inject({
      method: 'POST',
      url: '/api/auth/email-change/request',
      headers: { cookie },
      payload: { newEmail, currentPassword: 'wrong password value' },
    });
    expect(wrongPassword.statusCode).toBe(401);
    expect(sent).toHaveLength(0);

    const request = await app.inject({
      method: 'POST',
      url: '/api/auth/email-change/request',
      headers: { cookie },
      payload: { newEmail, currentPassword: PASSWORD },
    });
    expect(request.statusCode).toBe(202);
    expect(request.json()).toMatchObject({ pendingEmail: newEmail });

    const oldMessage = sent.find((item) => item.to === oldEmail);
    const newMessage = sent.find((item) => item.to === newEmail);
    expect(oldMessage?.subject).toMatch(/change/i);
    expect(newMessage?.subject).toMatch(/new .*email/i);
    const oldToken = tokenFrom(oldMessage!);
    const newToken = tokenFrom(newMessage!);
    expect(oldToken).not.toBe(newToken);

    const pending = await db.emailChangeRequest.findFirstOrThrow({ where: { userId } });
    expect(pending.oldTokenHash).toBe(hashSecret(oldToken));
    expect(pending.oldTokenHash).not.toBe(oldToken);
    expect(pending.oldTokenHash).toHaveLength(64);

    // Confirming the new address alone must not move the account.
    const newConfirm = await app.inject({ method: 'POST', url: '/api/auth/email-change/confirm', payload: { token: newToken } });
    expect(newConfirm.statusCode).toBe(200);
    expect(newConfirm.json()).toEqual({ side: 'new', changed: false, pending: 'old' });
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).email).toBe(oldEmail);
    expect((await app.inject({ method: 'POST', url: '/api/auth/email-change/confirm', payload: { token: newToken } })).statusCode).toBe(400);

    const oldConfirm = await app.inject({ method: 'POST', url: '/api/auth/email-change/confirm', payload: { token: oldToken } });
    expect(oldConfirm.statusCode).toBe(200);
    expect(oldConfirm.json()).toEqual({ side: 'old', changed: true, email: newEmail, pending: null });

    const changed = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(changed.email).toBe(newEmail);
    expect(changed.emailVerifiedAt).not.toBeNull();

    // The change consumes both links and revokes every existing session.
    expect((await app.inject({ method: 'POST', url: '/api/auth/email-change/confirm', payload: { token: oldToken } })).statusCode).toBe(400);
    expect((await app.inject({ url: '/api/auth/session', headers: { cookie } })).json().user).toBeNull();
    expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: oldEmail, password: PASSWORD } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: newEmail, password: PASSWORD } })).statusCode).toBe(200);
  });

  it('rejects an email change to an address already in use', async () => {
    const firstEmail = `taken-first-${Date.now()}@example.test`;
    const secondEmail = `taken-second-${Date.now()}@example.test`;
    await registerVerified(secondEmail, 'Already Here');
    const { cookie } = await registerVerified(firstEmail, 'Wants It');
    sent.length = 0;

    const conflict = await app.inject({
      method: 'POST',
      url: '/api/auth/email-change/request',
      headers: { cookie },
      payload: { newEmail: secondEmail, currentPassword: PASSWORD },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.code).toBe('EMAIL_IN_USE');
    expect(sent).toHaveLength(0);

    const unchanged = await app.inject({
      method: 'POST',
      url: '/api/auth/email-change/request',
      headers: { cookie },
      payload: { newEmail: firstEmail, currentPassword: PASSWORD },
    });
    expect(unchanged.statusCode).toBe(400);
    expect(unchanged.json().error.code).toBe('EMAIL_UNCHANGED');
  });

  it('consumes a reset token once, revokes sessions, and invalidates older reset tokens', async () => {
    const email = `reset-${Date.now()}@example.test`;
    const { cookie } = await registerVerified(email, 'Reset Me');
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    const firstToken = await issuePasswordReset(db, user);
    const secondToken = await issuePasswordReset(db, user);
    expect((await app.inject({ method: 'POST', url: '/api/auth/password-reset/complete', payload: { token: firstToken, password: 'new safe password 2026' } })).statusCode).toBe(400);
    const complete = await app.inject({ method: 'POST', url: '/api/auth/password-reset/complete', payload: { token: secondToken, password: 'new safe password 2026' } });
    expect(complete.statusCode).toBe(204);
    expect((await app.inject({ url: '/api/auth/session', headers: { cookie } })).json().user).toBeNull();
    expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: PASSWORD } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/auth/password-reset/complete', payload: { token: secondToken, password: 'another safe password 2026' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: 'new safe password 2026' } })).statusCode).toBe(200);
  });

  it('records failed sign-ins and rejects a temporarily locked account', async () => {
    const email = `lock-${Date.now()}@example.test`;
    const { userId } = await registerVerified(email, 'Lock Me');

    const wrong = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: 'wrong password value' } });
    expect(wrong.statusCode).toBe(401);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).failedLoginAttempts).toBe(1);

    await db.user.update({ where: { id: userId }, data: { lockedUntil: new Date(Date.now() + 60_000) } });
    const locked = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: PASSWORD } });
    expect(locked.statusCode).toBe(429);
    expect(locked.json().error.code).toBe('LOGIN_LOCKED');
  });

  it('rotates the session cookie on sign-in', async () => {
    const email = `rotate-${Date.now()}@example.test`;
    const { cookie: firstCookie } = await registerVerified(email, 'Rotate Me');

    const secondLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { cookie: firstCookie },
      payload: { email, password: PASSWORD },
    });
    expect(secondLogin.statusCode).toBe(200);
    const secondCookie = String(secondLogin.headers['set-cookie']).split(';')[0]!;
    expect(secondCookie).not.toBe(firstCookie);

    expect((await app.inject({ url: '/api/auth/session', headers: { cookie: firstCookie } })).json().user).toBeNull();
    expect((await app.inject({ url: '/api/auth/session', headers: { cookie: secondCookie } })).json().user).toMatchObject({ email });
  });
});
