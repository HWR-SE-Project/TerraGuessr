import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyReply } from 'fastify';

export const SESSION_COOKIE_NAME = 'tg_session';
export const OAUTH_COOKIE_NAME = 'tg_google_flow';

export function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return undefined;
}

function cookieOptions(secure: boolean): string {
  return `Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

export function setSessionCookie(reply: FastifyReply, token: string, secure: boolean): void {
  reply.header('Set-Cookie', `${SESSION_COOKIE_NAME}=${token}; ${cookieOptions(secure)}; Max-Age=2592000`);
}

export function clearSessionCookie(reply: FastifyReply, secure: boolean): void {
  reply.header('Set-Cookie', `${SESSION_COOKIE_NAME}=; ${cookieOptions(secure)}; Max-Age=0`);
}

export interface GoogleFlowState {
  state: string;
  nonce: string;
  verifier: string;
  createdAt: number;
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createGoogleFlowState(secret: string): { state: GoogleFlowState; cookieValue: string } {
  const state: GoogleFlowState = {
    state: randomBytes(32).toString('base64url'),
    nonce: randomBytes(32).toString('base64url'),
    verifier: randomBytes(32).toString('base64url'),
    createdAt: Date.now(),
  };
  const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
  return { state, cookieValue: `${payload}.${sign(payload, secret)}` };
}

export function verifyGoogleFlowCookie(value: string | undefined, secret: string): GoogleFlowState | null {
  if (!value) return null;
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(payload, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const state = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<GoogleFlowState>;
    if (
      typeof state.state !== 'string' || typeof state.nonce !== 'string' ||
      typeof state.verifier !== 'string' || typeof state.createdAt !== 'number' ||
      Date.now() - state.createdAt > 10 * 60 * 1000 || state.createdAt > Date.now() + 60_000
    ) return null;
    return state as GoogleFlowState;
  } catch {
    return null;
  }
}

export function setGoogleFlowCookie(reply: FastifyReply, value: string, secure: boolean): void {
  const flags = `Path=/api/auth/google/callback; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
  reply.header('Set-Cookie', `${OAUTH_COOKIE_NAME}=${value}; ${flags}; Max-Age=600`);
}

export function clearGoogleFlowCookie(reply: FastifyReply, secure: boolean): void {
  const flags = `Path=/api/auth/google/callback; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
  reply.header('Set-Cookie', `${OAUTH_COOKIE_NAME}=; ${flags}; Max-Age=0`);
}
