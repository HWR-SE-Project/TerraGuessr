import { registerAvatarRoutes } from './avatar.js';
import { createHash } from 'node:crypto';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { Env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import {
  confirmEmailChange,
  consumeEmailVerification,
  consumePasswordReset,
  createUserSession,
  findSessionUser,
  hashSecret,
  issueEmailVerification,
  issuePasswordReset,
  loginWithEmail,
  normalizeEmail,
  registerWithEmail,
  requestEmailChange,
  revokeSession,
  toPublicUser,
  verifyPassword,
  AuthError,
} from './service.js';
import { createAuthMailer } from './mailer.js';
import type { AuthMailer } from './mailer.js';
import {
  buildEmailChangeConfirmationEmail,
  buildEmailChangeVerificationEmail,
  buildPasswordResetEmail,
  buildVerificationEmail,
} from './emailTemplates.js';
import { assertSameSiteMutation, readSessionToken, requireSessionUser } from './session.js';
import {
  clearGoogleFlowCookie,
  clearSessionCookie,
  createGoogleFlowState,
  OAUTH_COOKIE_NAME,
  readCookie,
  setGoogleFlowCookie,
  setSessionCookie,
  verifyGoogleFlowCookie,
} from './cookies.js';

const Email = Type.String({ format: 'email', minLength: 3, maxLength: 254 });
const Password = Type.String({ minLength: 12, maxLength: 128 });
const UserBody = Type.Object({ email: Email, password: Password }, { additionalProperties: false });
const RegisterBody = Type.Object({
  email: Email,
  password: Password,
  displayName: Type.String({ minLength: 2, maxLength: 40 }),
}, { additionalProperties: false });
const ResetRequestBody = Type.Object({ email: Email }, { additionalProperties: false });
const EmailChangeBody = Type.Object({
  newEmail: Email,
  currentPassword: Type.Optional(Password),
}, { additionalProperties: false });
const ResetCompleteBody = Type.Object({ token: Type.String({ minLength: 32, maxLength: 128 }), password: Password }, { additionalProperties: false });
const VerificationTokenBody = Type.Object({ token: Type.String({ minLength: 32, maxLength: 128 }) }, { additionalProperties: false });
const ProfileBody = Type.Object({ displayName: Type.String({ minLength: 2, maxLength: 40 }) }, { additionalProperties: false });
const DeleteBody = Type.Object({ confirmation: Type.Literal('DELETE'), currentPassword: Type.Optional(Password) }, { additionalProperties: false });
const PreferencesBody = Type.Object({
  language: Type.Optional(Type.Union([Type.Literal('en'), Type.Literal('de')])),
  soundFxVolume: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })),
  musicVolume: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })),
  fullscreen: Type.Optional(Type.Boolean()),
}, { additionalProperties: false, minProperties: 1 });

interface GoogleQuery {
  state?: string;
  code?: string;
  error?: string;
}
function googleCookie(request: FastifyRequest): string | undefined {
  return readCookie(request.headers.cookie, OAUTH_COOKIE_NAME);
}

function googleConfigured(config: Env): boolean {
  return Boolean(config.googleClientId && config.googleClientSecret && config.googleRedirectUri);
}

function recoveryConfigured(config: Env): boolean {
  return Boolean(config.smtpUrl && config.smtpFrom && config.appBaseUrl);
}

/**
 * Cookie-based account endpoints. Anonymous game tokens remain supported by
 * the existing game API and are intentionally not changed by this module.
 */
export function registerAuthRoutes(
  app: FastifyInstance,
  options: { config: Env; db?: PrismaClient; mailer?: AuthMailer },
): void {
  const { config } = options;
  const db = options.db ?? prisma;
  const mailer = options.mailer ?? createAuthMailer(config);
  registerAvatarRoutes(app, db, config);
  const sameSiteMutation = (request: FastifyRequest) => assertSameSiteMutation(request, config);

  /**
   * Replaces whatever session the browser presented with `token`. Rotating on
   * every sign-in stops a pre-login cookie from remaining valid afterwards.
   */
  async function rotateSession(request: FastifyRequest, reply: FastifyReply, token: string): Promise<void> {
    await revokeSession(db, readSessionToken(request));
    setSessionCookie(reply, token, config.sessionCookieSecure);
  }

  function verificationEmailUrl(token: string): string {
    const url = new URL('/verify-email', config.appBaseUrl!);
    url.searchParams.set('token', token);
    return url.toString();
  }

  async function sendVerificationEmail(to: string, token: string): Promise<void> {
    const email = buildVerificationEmail(verificationEmailUrl(token));
    await mailer!({ to, ...email });
  }

  function emailChangeUrl(token: string): string {
    const url = new URL('/confirm-email-change', config.appBaseUrl!);
    url.searchParams.set('token', token);
    return url.toString();
  }

  app.get('/api/auth/config', async () => ({
    googleAvailable: googleConfigured(config),
    passwordRecoveryAvailable: recoveryConfigured(config),
    emailVerificationAvailable: Boolean(mailer && config.appBaseUrl),
  }));

  app.get('/api/auth/session', async (request) => {
    const user = await findSessionUser(db, readSessionToken(request));
    if (!user) return { user: null };
    const preferences = await db.userPreference.findUnique({ where: { userId: user.id } });
    return { user: toPublicUser(user), preferences };
  });

  app.post('/api/auth/register', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    onRequest: sameSiteMutation,
    schema: { body: RegisterBody },
  }, async (request, reply) => {
    // Production must prove email ownership before an account can sign in.
    if ((!mailer || !config.appBaseUrl) && config.nodeEnv === 'production') {
      throw new AuthError(503, 'Email delivery is not configured', 'EMAIL_DELIVERY_UNAVAILABLE');
    }
    const user = await registerWithEmail(db, request.body as { email: string; password: string; displayName: string });

    // Local/dev/e2e fallback: without SMTP there is no way to deliver a link,
    // so auto-verify and sign in (production never reaches this branch).
    if (!mailer || !config.appBaseUrl) {
      request.log.warn({ email: user.email }, 'SMTP not configured; auto-verified account (non-production fallback)');
      const verified = await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
      await rotateSession(request, reply, await createUserSession(db, user.id));
      reply.code(201);
      return { user: toPublicUser(verified), verificationRequired: false };
    }

    const token = await issueEmailVerification(db, user.id);
    try {
      await sendVerificationEmail(user.email, token);
    } catch (error) {
      await db.user.delete({ where: { id: user.id } });
      request.log.error({ err: error }, 'verification email could not be sent');
      throw new AuthError(503, 'Verification email could not be sent', 'EMAIL_DELIVERY_FAILED');
    }
    reply.code(201);
    return { user: toPublicUser(user), verificationRequired: true };
  });

  app.post('/api/auth/verify-email', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    onRequest: sameSiteMutation,
    schema: { body: VerificationTokenBody },
  }, async (request) => {
    const { token } = request.body as { token: string };
    const user = await consumeEmailVerification(db, token);
    return { verified: true, user: toPublicUser(user) };
  });

  app.post('/api/auth/verification/resend', {
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
    onRequest: sameSiteMutation,
    schema: { body: ResetRequestBody },
  }, async (request, reply) => {
    reply.code(202);
    const message = 'If an account needs verification, a new email has been sent.';
    // Never reveal whether an address is registered or already verified.
    if (!mailer || !config.appBaseUrl) return { message };
    const { email } = request.body as { email: string };
    const user = await db.user.findUnique({ where: { email: normalizeEmail(email) } });
    if (!user || !user.passwordHash || user.emailVerifiedAt) return { message };

    const token = await issueEmailVerification(db, user.id);
    try {
      await sendVerificationEmail(user.email, token);
    } catch (error) {
      await db.emailVerificationToken.deleteMany({ where: { tokenHash: hashSecret(token) } });
      request.log.error({ err: error }, 'verification email could not be resent');
    }
    return { message };
  });

  app.post('/api/auth/email-change/request', {
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
    onRequest: sameSiteMutation,
    schema: { body: EmailChangeBody },
  }, async (request, reply) => {
    if (!mailer || !config.appBaseUrl) {
      throw new AuthError(503, 'Email delivery is not configured', 'EMAIL_DELIVERY_UNAVAILABLE');
    }
    const user = await requireSessionUser(request, db);
    const { newEmail, currentPassword } = request.body as { newEmail: string; currentPassword?: string };
    const change = await requestEmailChange(db, user, { newEmail, currentPassword });

    const messages = [
      {
        to: user.email,
        ...buildEmailChangeConfirmationEmail({
          oldEmail: user.email,
          newEmail: change.newEmail,
          actionUrl: emailChangeUrl(change.oldToken),
        }),
      },
      {
        to: change.newEmail,
        ...buildEmailChangeVerificationEmail({
          oldEmail: user.email,
          newEmail: change.newEmail,
          actionUrl: emailChangeUrl(change.newToken),
        }),
      },
    ];
    const deliveries = await Promise.allSettled(messages.map((message) => mailer(message)));
    if (deliveries.some((delivery) => delivery.status === 'rejected')) {
      // Invalidate both links so a half-delivered pair cannot change the account.
      await db.emailChangeRequest.deleteMany({ where: { id: change.requestId } });
      request.log.error({
        errors: deliveries.flatMap((delivery) => delivery.status === 'rejected' ? [delivery.reason] : []),
      }, 'email change messages could not be sent');
      throw new AuthError(503, 'Confirmation email could not be sent', 'EMAIL_DELIVERY_FAILED');
    }

    reply.code(202);
    return {
      message: 'Check your current and new inboxes to confirm the change.',
      pendingEmail: change.newEmail,
    };
  });

  app.post('/api/auth/email-change/confirm', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    onRequest: sameSiteMutation,
    schema: { body: VerificationTokenBody },
  }, async (request, reply) => {
    const { token } = request.body as { token: string };
    const result = await confirmEmailChange(db, token);
    if (result.changed) clearSessionCookie(reply, config.sessionCookieSecure);
    return result;
  });

  app.post('/api/auth/login', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    onRequest: sameSiteMutation,
    schema: { body: UserBody },
  }, async (request, reply) => {
    const result = await loginWithEmail(db, request.body as { email: string; password: string });
    await rotateSession(request, reply, result.sessionToken);
    return { user: toPublicUser(result.user) };
  });

  app.post('/api/auth/logout', { onRequest: sameSiteMutation }, async (request, reply) => {
    await revokeSession(db, readSessionToken(request));
    clearSessionCookie(reply, config.sessionCookieSecure);
    reply.code(204);
  });

  app.patch('/api/auth/profile', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    onRequest: sameSiteMutation,
    schema: { body: ProfileBody },
  }, async (request) => {
    const user = await requireSessionUser(request, db);
    const { displayName } = request.body as { displayName: string };
    const updated = await db.user.update({
      where: { id: user.id },
      data: { displayName: displayName.trim() },
    });
    return { user: toPublicUser(updated) };
  });

  app.patch('/api/auth/preferences', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    onRequest: sameSiteMutation,
    schema: { body: PreferencesBody },
  }, async (request) => {
    const user = await requireSessionUser(request, db);
    const changes = request.body as {
      language?: 'en' | 'de'; soundFxVolume?: number; musicVolume?: number; fullscreen?: boolean;
    };
    const preferences = await db.userPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...changes },
      update: changes,
    });
    return { preferences };
  });

  app.delete('/api/auth/account', {
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
    onRequest: sameSiteMutation,
    schema: { body: DeleteBody },
  }, async (request, reply) => {
    const user = await requireSessionUser(request, db);
    const { currentPassword } = request.body as { confirmation: 'DELETE'; currentPassword?: string };
    if (user.passwordHash && !(await verifyPassword(currentPassword ?? '', user.passwordHash))) {
      throw new AuthError(401, 'Current password is incorrect');
    }
    // Cascades identity/session/preferences/reset-token rows. Historical game
    // and result records survive with ownerUserId set to null (R18).
    await db.user.delete({ where: { id: user.id } });
    clearSessionCookie(reply, config.sessionCookieSecure);
    reply.code(204);
  });

  app.post('/api/auth/password-reset/request', {
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
    onRequest: sameSiteMutation,
    schema: { body: ResetRequestBody },
  }, async (request, reply) => {
    if (!recoveryConfigured(config)) {
      throw new AuthError(503, 'Account recovery email is not configured');
    }
    const { email } = request.body as { email: string };
    const user = await db.user.findUnique({ where: { email: normalizeEmail(email) } });
    if (user?.passwordHash && mailer) {
      const token = await issuePasswordReset(db, user);
      const resetUrl = new URL('/reset-password', config.appBaseUrl);
      resetUrl.searchParams.set('token', token);
      try {
        const resetEmail = buildPasswordResetEmail(resetUrl.toString());
        await mailer({ to: user.email, ...resetEmail });
      } catch {
        await db.passwordResetToken.deleteMany({ where: { tokenHash: hashSecret(token) } });
        throw new AuthError(503, 'Recovery email could not be sent');
      }
    }
    reply.code(202);
    return { message: 'If an email account can be recovered, instructions have been sent.' };
  });

  app.post('/api/auth/password-reset/complete', {
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
    onRequest: sameSiteMutation,
    schema: { body: ResetCompleteBody },
  }, async (request, reply) => {
    const { token, password } = request.body as { token: string; password: string };
    await consumePasswordReset(db, token, password);
    clearSessionCookie(reply, config.sessionCookieSecure);
    reply.code(204);
  });

  app.get<{ Querystring: GoogleQuery }>('/api/auth/google', async (_request, reply) => {
    if (!googleConfigured(config)) throw new AuthError(503, 'Google sign-in is not configured');
    const client = new OAuth2Client(config.googleClientId, config.googleClientSecret, config.googleRedirectUri);
    const flow = createGoogleFlowState(config.googleClientSecret!);
    const challenge = createHash('sha256').update(flow.state.verifier).digest('base64url');
    setGoogleFlowCookie(reply, flow.cookieValue, config.sessionCookieSecure);
    const location = client.generateAuthUrl({
      access_type: 'online',
      scope: ['openid', 'email', 'profile'],
      state: flow.state.state,
      nonce: flow.state.nonce,
      code_challenge: challenge,
      code_challenge_method: CodeChallengeMethod.S256,
      prompt: 'select_account',
    });
    return reply.redirect(location);
  });

  app.get<{ Querystring: GoogleQuery }>('/api/auth/google/callback', async (request, reply) => {
    if (!googleConfigured(config)) throw new AuthError(503, 'Google sign-in is not configured');
    const flow = verifyGoogleFlowCookie(googleCookie(request), config.googleClientSecret!);
    clearGoogleFlowCookie(reply, config.sessionCookieSecure);
    if (!flow || !request.query.state || request.query.state !== flow.state || !request.query.code || request.query.error) {
      throw new AuthError(400, 'Google sign-in could not be verified');
    }
    const client = new OAuth2Client(config.googleClientId, config.googleClientSecret, config.googleRedirectUri);
    const { tokens } = await client.getToken({ code: request.query.code, codeVerifier: flow.verifier });
    if (!tokens.id_token) throw new AuthError(401, 'Google did not return an identity token');
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: config.googleClientId });
    const claims = ticket.getPayload();
    const issuerValid = claims?.iss === 'https://accounts.google.com' || claims?.iss === 'accounts.google.com';
    if (!claims || !issuerValid || claims.nonce !== flow.nonce || claims.email_verified !== true || !claims.sub || !claims.email) {
      throw new AuthError(401, 'Google identity could not be verified');
    }

    let user = await db.user.findUnique({ where: { googleSub: claims.sub } });
    if (!user) {
      const existingEmail = await db.user.findUnique({ where: { email: normalizeEmail(claims.email) } });
      if (existingEmail) throw new AuthError(409, 'Sign in with email before connecting this Google identity');
      try {
        user = await db.user.create({ data: {
          email: normalizeEmail(claims.email),
          googleSub: claims.sub,
          displayName: (claims.name?.trim() || claims.email.split('@')[0] || 'Terra player').slice(0, 40),
          emailVerifiedAt: new Date(),
        } });
      } catch {
        user = await db.user.findUnique({ where: { googleSub: claims.sub } });
        if (!user) throw new AuthError(409, 'This Google account could not be connected');
      }
    }
    await rotateSession(request, reply, await createUserSession(db, user.id));
    return reply.redirect(config.appBaseUrl ?? '/');
  });
}
