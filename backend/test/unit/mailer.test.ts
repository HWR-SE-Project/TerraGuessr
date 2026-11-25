import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { PrismaClient } from '@prisma/client';

const { sendMailMock, closeMock, createTransportMock } = vi.hoisted(() => {
  const sendMailMock = vi.fn();
  const closeMock = vi.fn();
  const createTransportMock = vi.fn(() => ({
    sendMail: sendMailMock,
    close: closeMock,
  }));
  return { sendMailMock, closeMock, createTransportMock };
});

vi.mock('nodemailer', () => ({
  default: {
    createTransport: createTransportMock,
  },
}));

import type { Env } from '../../src/config/env.js';
import {
  createAuthMailer,
  SMTP_CONNECTION_TIMEOUT_MS,
  SMTP_GREETING_TIMEOUT_MS,
  SMTP_SOCKET_TIMEOUT_MS,
} from '../../src/modules/auth/mailer.js';
import { registerAuthRoutes } from '../../src/modules/auth/routes.js';

function baseEnv(overrides: Partial<Env> = {}): Env {
  return {
    databaseUrl: 'postgresql://user:pass@localhost:5432/test',
    nodeEnv: 'test',
    port: 3000,
    corsOrigin: false,
    openMeteoBaseUrl: 'https://api.open-meteo.com',
    logLevel: 'silent',
    sessionCookieSecure: false,
    trustProxy: false,
    ...overrides,
  };
}

describe('createAuthMailer (pooled SMTP + timeouts)', () => {
  beforeEach(() => {
    sendMailMock.mockReset().mockResolvedValue({ messageId: 'msg-1' });
    closeMock.mockReset();
    createTransportMock.mockClear();
  });

  it('returns undefined when SMTP_URL or SMTP_FROM is missing', () => {
    expect(createAuthMailer(baseEnv())).toBeUndefined();
    expect(createAuthMailer(baseEnv({ smtpUrl: 'smtp://localhost:1025' }))).toBeUndefined();
    expect(createAuthMailer(baseEnv({ smtpFrom: 'TerraGuessr <no-reply@example.test>' }))).toBeUndefined();
    expect(createTransportMock).not.toHaveBeenCalled();
  });

  it('creates one pooled transport with strict timeouts, reuses it across sends, and closes on close()', async () => {
    const mailer = createAuthMailer(
      baseEnv({
        smtpUrl: 'smtps://user:secret@smtp.example.test:465',
        smtpFrom: 'TerraGuessr <no-reply@example.test>',
      }),
    );
    expect(mailer).toBeDefined();
    expect(createTransportMock).toHaveBeenCalledTimes(1);
    expect(createTransportMock).toHaveBeenCalledWith({
      url: 'smtps://user:secret@smtp.example.test:465',
      pool: true,
      connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
      greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
      socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
    });
    expect(SMTP_CONNECTION_TIMEOUT_MS).toBe(5_000);
    expect(SMTP_GREETING_TIMEOUT_MS).toBe(5_000);
    expect(SMTP_SOCKET_TIMEOUT_MS).toBe(10_000);

    await mailer!({ to: 'a@example.test', subject: 'First', text: 'Body 1' });
    await mailer!({ to: 'b@example.test', subject: 'Second', text: 'Body 2', html: '<p>Body 2</p>' });

    expect(createTransportMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock).toHaveBeenCalledTimes(2);
    expect(sendMailMock).toHaveBeenNthCalledWith(1, {
      from: 'TerraGuessr <no-reply@example.test>',
      to: 'a@example.test',
      subject: 'First',
      text: 'Body 1',
      html: undefined,
    });
    expect(closeMock).not.toHaveBeenCalled();

    mailer!.close();
    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  it('closes the pooled mailer transport when the Fastify app closes', async () => {
    const app = Fastify({ logger: { level: 'silent' } });
    registerAuthRoutes(app, {
      config: baseEnv({
        smtpUrl: 'smtp://localhost:1025',
        smtpFrom: 'TerraGuessr <no-reply@example.test>',
      }),
      db: {} as unknown as PrismaClient,
    });

    await app.ready();
    expect(closeMock).not.toHaveBeenCalled();

    await app.close();
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
