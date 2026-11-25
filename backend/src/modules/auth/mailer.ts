import nodemailer from 'nodemailer';
import type { Env } from '../../config/env.js';

export const SMTP_CONNECTION_TIMEOUT_MS = 5_000;
export const SMTP_GREETING_TIMEOUT_MS = 5_000;
export const SMTP_SOCKET_TIMEOUT_MS = 10_000;

export interface AuthMailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Injectable outbound-email boundary so tests can capture messages. */
export type AuthMailer = ((message: AuthMailMessage) => Promise<void>) & {
  close?: () => void | Promise<void>;
};

export type PooledAuthMailer = ((message: AuthMailMessage) => Promise<void>) & {
  close: () => void;
};

/**
 * Returns a pooled mailer only when both SMTP settings exist. Callers treat
 * `undefined` as "email delivery unavailable" and refuse in production.
 *
 * Uses a single pooled Nodemailer transport with strict socket/handshake
 * timeouts and exposes `close()` so Fastify can tear down idle SMTP sockets on
 * shutdown.
 */
export function createAuthMailer(config: Env): PooledAuthMailer | undefined {
  if (!config.smtpUrl || !config.smtpFrom) return undefined;
  const from = config.smtpFrom;
  const transport = nodemailer.createTransport({
    url: config.smtpUrl,
    pool: true,
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
  });

  const send = async (message: AuthMailMessage): Promise<void> => {
    await transport.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  };

  return Object.assign(send, {
    close: () => {
      transport.close();
    },
  });
}
