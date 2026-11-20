export interface AuthEmail {
  subject: string;
  text: string;
  html: string;
}

export interface AuthEmailLayout {
  eyebrow: string;
  heading: string;
  intro: string;
  actionLabel: string;
  actionUrl: string;
  note: string;
  preheader: string;
  footer: string;
}

const COLORS = {
  background: '#080f1b',
  cardStart: '#18283c',
  cardEnd: '#0d1827',
  surface: '#101c2c',
  raised: '#162437',
  border: '#a2bed63b',
  borderSubtle: '#a2bed620',
  text: '#f4f7fb',
  muted: '#a4b3c5',
  subtle: '#768ba3',
  lime: '#c0f66b',
  onLime: '#172512',
  cyan: '#83d5ed',
} as const;

const FONT_STACK =
  "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Table-based, inline-styled email so it renders consistently in Gmail,
 * Outlook, and Apple Mail while keeping the landing page's dark/lime identity.
 */
export function renderAuthEmail(layout: AuthEmailLayout): string {
  const eyebrow = escapeHtml(layout.eyebrow);
  const heading = escapeHtml(layout.heading);
  const intro = escapeHtml(layout.intro);
  const actionLabel = escapeHtml(layout.actionLabel);
  const actionUrl = escapeHtml(layout.actionUrl);
  const note = escapeHtml(layout.note);
  const preheader = escapeHtml(layout.preheader);
  const footer = escapeHtml(layout.footer);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>${heading}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${COLORS.background};">
    <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;color:${COLORS.background};">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.background};">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
            <tr>
              <td style="padding:0 8px 24px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td valign="middle" style="padding-right:11px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:38px;height:40px;">
                        <tr>
                          <td align="center" valign="middle" style="width:38px;height:40px;border:1px solid ${COLORS.border};border-radius:10px;background-color:${COLORS.raised};color:${COLORS.lime};font-family:${FONT_STACK};font-size:19px;font-weight:700;line-height:1;">T</td>
                        </tr>
                      </table>
                    </td>
                    <td valign="middle" style="font-family:${FONT_STACK};font-size:23px;font-weight:700;letter-spacing:-1px;color:${COLORS.text};">
                      <span style="font-weight:400;">Terra</span>Guessr<span style="color:${COLORS.lime};">.</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background-color:${COLORS.surface};background-image:linear-gradient(145deg,${COLORS.cardStart},${COLORS.cardEnd});border:1px solid ${COLORS.border};border-radius:28px;padding:40px 36px;">
                <p style="margin:0 0 14px;font-family:${FONT_STACK};font-size:10px;line-height:1.5;letter-spacing:2.5px;font-weight:600;color:${COLORS.cyan};text-transform:uppercase;">${eyebrow}</p>
                <h1 style="margin:0 0 16px;font-family:${FONT_STACK};font-size:32px;line-height:1.15;letter-spacing:-1.3px;font-weight:600;color:${COLORS.text};">${heading}</h1>
                <p style="margin:0 0 28px;font-family:${FONT_STACK};font-size:15px;line-height:1.75;color:${COLORS.muted};">${intro}</p>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
                  <tr>
                    <td align="center" bgcolor="${COLORS.lime}" style="border-radius:12px;">
                      <a href="${actionUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:15px 30px;font-family:${FONT_STACK};font-size:14px;font-weight:700;line-height:1.2;color:${COLORS.onLime};text-decoration:none;border-radius:12px;">${actionLabel}</a>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
                  <tr>
                    <td style="border-top:1px solid ${COLORS.borderSubtle};padding-top:20px;font-family:${FONT_STACK};font-size:12px;line-height:1.7;color:${COLORS.subtle};">
                      If the button doesn't work, copy and paste this link into your browser:
                      <br />
                      <a href="${actionUrl}" target="_blank" rel="noopener" style="color:${COLORS.lime};text-decoration:none;word-break:break-all;">${actionUrl}</a>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color:${COLORS.raised};border:1px solid ${COLORS.borderSubtle};border-radius:12px;padding:14px 16px;font-family:${FONT_STACK};font-size:12px;line-height:1.7;color:${COLORS.muted};">${note}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 8px 0;font-family:${FONT_STACK};font-size:11px;line-height:1.7;color:${COLORS.subtle};">
                <p style="margin:0 0 6px;">${footer}</p>
                <p style="margin:0;">© ${new Date().getFullYear()} TerraGuessr. A world waiting to be found.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildVerificationEmail(actionUrl: string): AuthEmail {
  return {
    subject: 'Verify your TerraGuessr email',
    text: [
      'Confirm your email address to finish creating your TerraGuessr account.',
      `This link expires in 24 hours: ${actionUrl}`,
      'If you did not create an account, you can ignore this message.',
    ].join('\n\n'),
    html: renderAuthEmail({
      eyebrow: 'A world waiting to be found',
      heading: 'Confirm your email.',
      intro: 'You are one step away from your first expedition. Verify your email address to finish creating your TerraGuessr account and start exploring.',
      actionLabel: 'Verify email address',
      actionUrl,
      note: 'This link expires in 24 hours. If you did not create a TerraGuessr account, you can safely ignore this message.',
      preheader: 'Confirm your email address to finish creating your TerraGuessr account.',
      footer: 'You are receiving this because someone signed up with this address.',
    }),
  };
}

/** Sent to the address currently on the account; acts as the owner's veto. */
export function buildEmailChangeConfirmationEmail(input: {
  oldEmail: string;
  newEmail: string;
  actionUrl: string;
}): AuthEmail {
  return {
    subject: 'Confirm your TerraGuessr email change',
    text: [
      `We received a request to change the TerraGuessr account for ${input.oldEmail} to ${input.newEmail}.`,
      `Confirm the change from this inbox: ${input.actionUrl}`,
      'The new address must also confirm before the change takes effect. This link expires in 60 minutes.',
      'If you did not request this, do not confirm. Your email will stay the same, and you should change your password.',
    ].join('\n\n'),
    html: renderAuthEmail({
      eyebrow: 'Secure your account',
      heading: 'Confirm this change?',
      intro: `We received a request to change your TerraGuessr email from ${input.oldEmail} to ${input.newEmail}. Confirm from this inbox to approve it.`,
      actionLabel: 'Confirm email change',
      actionUrl: input.actionUrl,
      note: 'The new address must also confirm before the change takes effect. This link expires in 60 minutes. If you did not request this, do not confirm and consider changing your password.',
      preheader: `Approve changing your TerraGuessr email to ${input.newEmail}.`,
      footer: 'You are receiving this because a change was requested for the address currently on this account.',
    }),
  };
}

/** Sent to the proposed address to prove the requester controls it. */
export function buildEmailChangeVerificationEmail(input: {
  oldEmail: string;
  newEmail: string;
  actionUrl: string;
}): AuthEmail {
  return {
    subject: 'Confirm your new TerraGuessr email',
    text: [
      `Confirm ${input.newEmail} to finish changing the TerraGuessr account from ${input.oldEmail}.`,
      `Confirm this address: ${input.actionUrl}`,
      'Your current address must also confirm before the change takes effect. This link expires in 60 minutes.',
      'If you did not request this, you can ignore this message.',
    ].join('\n\n'),
    html: renderAuthEmail({
      eyebrow: 'One last check',
      heading: 'Confirm your new email.',
      intro: `Confirm ${input.newEmail} to finish changing your TerraGuessr email from ${input.oldEmail}. Your current address must also approve the change.`,
      actionLabel: 'Confirm new email',
      actionUrl: input.actionUrl,
      note: 'Your current address must also confirm before the change takes effect. This link expires in 60 minutes. If you did not request this, you can ignore this message.',
      preheader: `Confirm ${input.newEmail} as your new TerraGuessr email.`,
      footer: 'You are receiving this because this address was proposed for a TerraGuessr account.',
    }),
  };
}

export function buildPasswordResetEmail(actionUrl: string): AuthEmail {
  return {
    subject: 'Reset your TerraGuessr password',
    text: `Use this one-time link within 30 minutes to reset your TerraGuessr password: ${actionUrl}`,
    html: renderAuthEmail({
      eyebrow: 'Secure your account',
      heading: 'Reset your password.',
      intro: 'We received a request to reset the password for your TerraGuessr account. Use the button below to choose a new one.',
      actionLabel: 'Reset password',
      actionUrl,
      note: 'This one-time link expires in 30 minutes. If you did not request a reset, you can safely ignore this message.',
      preheader: 'Use this one-time link within 30 minutes to reset your TerraGuessr password.',
      footer: 'You are receiving this because a password reset was requested for this address.',
    }),
  };
}
