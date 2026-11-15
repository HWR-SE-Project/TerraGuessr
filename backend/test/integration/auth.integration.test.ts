import './helpers/env.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { registerErrorHandler } from '../../src/plugins/errorHandler.js';
import { registerAuthRoutes } from '../../src/modules/auth/routes.js';
import { registerGamesRoutes } from '../../src/modules/games/routes.js';
import { issuePasswordReset } from '../../src/modules/auth/service.js';
import { setupDatabase, teardownDatabase } from './helpers/database.js';

describe('account authentication (integration)', () => {
  let db: PrismaClient;
  let app: FastifyInstance;
  beforeAll(async () => {
    db = await setupDatabase();
    app = Fastify({ logger: { level: 'silent' } });
    registerErrorHandler(app);
    registerAuthRoutes(app, { db, config: {
      databaseUrl: process.env.DATABASE_URL!, port: 3000, corsOrigin: false,
      adminApiToken: '', openMeteoBaseUrl: 'https://api.open-meteo.com', logLevel: 'silent',
      sessionCookieSecure: false,
    } });
    registerGamesRoutes(app, db);
  });
  afterAll(async () => { await app.close(); await teardownDatabase(db); });

  it('registers, logs in, protects the session, and keeps only a hash of the cookie token', async () => {
    const email = `auth-${Date.now()}@example.test`;
    const registration = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, displayName: 'Map Reader', password: 'correct horse battery' } });
    expect(registration.statusCode).toBe(201);
    expect(registration.headers['set-cookie']).toContain('HttpOnly');
    expect(registration.headers['set-cookie']).toContain('SameSite=Lax');
    const cookie = String(registration.headers['set-cookie']).split(';')[0]!;
    const session = await app.inject({ url: '/api/auth/session', headers: { cookie } });
    expect(session.json().user).toMatchObject({ email, displayName: 'Map Reader', hasPassword: true });
    const rawToken = cookie.slice('tg_session='.length);
    const persisted = await db.authSession.findFirst({ where: { userId: session.json().user.id } });
    expect(persisted?.tokenHash).not.toBe(rawToken);
    expect(persisted?.tokenHash).toHaveLength(64);

    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: 'correct horse battery' } });
    expect(login.statusCode).toBe(200);
    expect((await app.inject({ url: '/api/auth/session', headers: { cookie: 'tg_session=invalid' } })).json().user).toBeNull();
    const rejected = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: 'wrong password value' } });
    expect(rejected.statusCode).toBe(401);
    const loginCookie = String(login.headers['set-cookie']).split(';')[0]!;
    expect((await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie: loginCookie } })).statusCode).toBe(204);
    expect((await app.inject({ url: '/api/auth/session', headers: { cookie: loginCookie } })).json().user).toBeNull();
  });

  it('persists account preferences and anonymizes owned games on confirmed deletion', async () => {
    const email = `delete-${Date.now()}@example.test`;
    const register = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, displayName: 'Delete Me', password: 'correct horse battery' } });
    const cookie = String(register.headers['set-cookie']).split(';')[0]!;
    const userId = register.json().user.id as string;
    const game = await app.inject({ method: 'POST', url: '/api/games', headers: { cookie }, payload: { mode: 'solo', difficulty: 'easy' } });
    expect(game.statusCode).toBe(201);
    expect((await db.game.findUnique({ where: { id: game.json().gameId } }))?.ownerUserId).toBe(userId);
    const pref = await app.inject({ method: 'PATCH', url: '/api/auth/preferences', headers: { cookie }, payload: { language: 'de', fullscreen: true } });
    expect(pref.json().preferences).toMatchObject({ language: 'de', fullscreen: true });
    const denied = await app.inject({ method: 'DELETE', url: '/api/auth/account', headers: { cookie }, payload: { confirmation: 'DELETE', currentPassword: 'wrong password value' } });
    expect(denied.statusCode).toBe(401);
    const deleted = await app.inject({ method: 'DELETE', url: '/api/auth/account', headers: { cookie }, payload: { confirmation: 'DELETE', currentPassword: 'correct horse battery' } });
    expect(deleted.statusCode).toBe(204);
    expect(await db.user.findUnique({ where: { id: userId } })).toBeNull();
    expect((await db.game.findUnique({ where: { id: game.json().gameId } }))?.ownerUserId).toBeNull();
  });

  it('returns a configuration status without pretending external auth or recovery is available', async () => {
    expect((await app.inject({ url: '/api/auth/config' })).json()).toEqual({ googleAvailable: false, passwordRecoveryAvailable: false });
    expect((await app.inject({ method: 'POST', url: '/api/auth/password-reset/request', payload: { email: 'nobody@example.test' } })).statusCode).toBe(503);
    const protectedProfile = await app.inject({ method: 'PATCH', url: '/api/auth/profile', payload: { displayName: 'No Access' } });
    expect(protectedProfile.statusCode).toBe(401);
    const crossSite = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin: 'https://attacker.example' }, payload: { email: 'nobody@example.test', password: 'long enough password' } });
    expect(crossSite.statusCode).toBe(403);
    expect(crossSite.json().error.code).toBe('FORBIDDEN');
  });

  it('consumes a reset token once and revokes existing sessions', async () => {
    const email = `reset-${Date.now()}@example.test`;
    const register = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, displayName: 'Reset Me', password: 'correct horse battery' } });
    const cookie = String(register.headers['set-cookie']).split(';')[0]!;
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    const token = await issuePasswordReset(db, user);
    const complete = await app.inject({ method: 'POST', url: '/api/auth/password-reset/complete', payload: { token, password: 'new safe password 2026' } });
    expect(complete.statusCode).toBe(204);
    expect((await app.inject({ url: '/api/auth/session', headers: { cookie } })).json().user).toBeNull();
    expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: 'correct horse battery' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/auth/password-reset/complete', payload: { token, password: 'another safe password 2026' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password: 'new safe password 2026' } })).statusCode).toBe(200);
  });
});
