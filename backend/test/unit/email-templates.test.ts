import { describe, expect, it } from 'vitest';
import {
  buildEmailChangeConfirmationEmail,
  buildEmailChangeVerificationEmail,
  buildPasswordResetEmail,
  buildVerificationEmail,
} from '../../src/modules/auth/emailTemplates.js';

describe('auth email templates', () => {
  it('renders all auth emails with the TerraGuessr v2 palette, wordmark, and action link', () => {
    const emails = [
      buildVerificationEmail('https://terraguessr.example/verify-email?token=abc'),
      buildPasswordResetEmail('https://terraguessr.example/reset-password?token=def'),
      buildEmailChangeConfirmationEmail({
        oldEmail: 'old@example.test',
        newEmail: 'new@example.test',
        actionUrl: 'https://terraguessr.example/confirm-email-change?token=ghi',
      }),
      buildEmailChangeVerificationEmail({
        oldEmail: 'old@example.test',
        newEmail: 'new@example.test',
        actionUrl: 'https://terraguessr.example/confirm-email-change?token=jkl',
      }),
    ];

    for (const email of emails) {
      expect(email.subject).toContain('TerraGuessr');
      expect(email.text.length).toBeGreaterThan(20);
      // Matches v2 space-900 background, space-600/700 card surface, lime-400 CTA, and cream text.
      expect(email.html).toContain('#0e0b20');
      expect(email.html).toContain('#2b2452');
      expect(email.html).toContain('#221c41');
      expect(email.html).toContain('#c0f66b');
      expect(email.html).toContain('#fbf7ee');
      expect(email.html).toContain('Terra<span style="color:#c0f66b;">Guessr</span>');
    }
  });

  it('escapes HTML special characters in interpolated email addresses and URLs', () => {
    const email = buildEmailChangeConfirmationEmail({
      oldEmail: 'a<script>@example.test',
      newEmail: '"evil"@example.test',
      actionUrl: 'https://terraguessr.example/confirm?a=1&b="x"',
    });

    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('a&lt;script&gt;@example.test');
    expect(email.html).toContain('&quot;evil&quot;@example.test');
    expect(email.html).toContain('a=1&amp;b=&quot;x&quot;');
  });
});
