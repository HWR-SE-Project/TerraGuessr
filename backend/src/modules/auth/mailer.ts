import nodemailer from 'nodemailer';
import type { Env } from '../../config/env.js';

export interface AuthMailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Injectable outbound-email boundary so tests can capture messages. */
export type AuthMailer = (message: AuthMailMessage) => Promise<void>;

/**
 * Returns a mailer only when both SMTP settings exist. Callers treat `undefined`
 * as "email delivery unavailable" and refuse in production.
 */
export function createAuthMailer(config: Env): AuthMailer | undefined {
  if (!config.smtpUrl || !config.smtpFrom) return undefined;
  const smtpUrl = config.smtpUrl;
  const from = config.smtpFrom;
  return async (message) => {
    const transport = nodemailer.createTransport(smtpUrl);
    try {
      await transport.sendMail({
        from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    } finally {
      transport.close();
    }
  };
}
