export interface AuthEmail {
  subject: string;
  text: string;
  html: string;
}

export type RichTextSegment = string | { emphasis: string };

export interface AuthEmailLayout {
  eyebrow: string;
  heading: string;
  intro: string | ReadonlyArray<RichTextSegment>;
  actionLabel: string;
  actionUrl: string;
  note: string;
  preheader: string;
  footer: string;
}

/**
 * Matches the TerraGuessr v2 website design tokens (`frontend/src/styles/index.css`):
 * deep indigo-violet space surfaces, warm cream typography, and chunky lime controls.
 * Solid blended hex borders are used instead of 8-digit hex so Outlook renders them cleanly.
 */
const COLORS = {
  background: '#0e0b20', // space-900
  cardTop: '#2b2452', // space-600
  cardBottom: '#221c41', // space-700
  inset: '#1a1636', // space-800
  border: '#3c3563', // ~9% white over space-600/700
  borderSubtle: '#342d56', // ~8% white over space-700
  cream: '#fbf7ee',
  muted: '#bdb5d8',
  subtle: '#948bac',
  lime: '#c0f66b', // lime-400
  limeLight: '#d7ff96', // lime-300
  ink: '#1b2a10',
} as const;

const DISPLAY_FONT =
  "'Fredoka','Nunito',ui-rounded,'SF Pro Rounded','Trebuchet MS',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const BODY_FONT =
  "'Nunito',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderRichText(content: string | ReadonlyArray<RichTextSegment>): string {
  if (typeof content === 'string') return escapeHtml(content);
  return content
    .map((segment) =>
      typeof segment === 'string'
        ? escapeHtml(segment)
        : `<strong style="color:${COLORS.cream};font-weight:700;">${escapeHtml(segment.emphasis)}</strong>`,
    )
    .join('');
}

/**
 * Table-based, inline-styled HTML email matching the TerraGuessr v2 auth cards
 * while rendering reliably across Gmail, Apple Mail, and Outlook.
 */
export function renderAuthEmail(layout: AuthEmailLayout): string {
  const eyebrow = escapeHtml(layout.eyebrow);
  const heading = escapeHtml(layout.heading);
  const intro = renderRichText(layout.intro);
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
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&family=Nunito:wght@400;600;700&display=swap" rel="stylesheet" />
    <style>
      :root { color-scheme: dark; supported-color-schemes: dark; }
      .tg-btn:hover { background-color: ${COLORS.limeLight} !important; }
      @media only screen and (max-width: 540px) {
        .tg-outer { padding: 24px 12px !important; }
        .tg-card { padding: 32px 22px !important; border-radius: 24px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:${COLORS.background};color:${COLORS.cream};-webkit-font-smoothing:antialiased;">
    <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;color:${COLORS.background};">${preheader}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.background};">
      <tr>
        <td align="center" class="tg-outer" style="padding:44px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:520px;">
            <tr>
              <td align="center" style="padding:0 0 24px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td valign="middle" style="padding-right:10px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:36px;height:36px;">
                        <tr>
                          <td align="center" valign="middle" bgcolor="${COLORS.lime}" style="width:36px;height:36px;border-radius:12px;background-color:${COLORS.lime};color:${COLORS.ink};font-family:${DISPLAY_FONT};font-size:20px;font-weight:700;line-height:1;">T</td>
                        </tr>
                      </table>
                    </td>
                    <td valign="middle" style="font-family:${DISPLAY_FONT};font-size:22px;font-weight:600;letter-spacing:-0.4px;color:${COLORS.cream};">
                      Terra<span style="color:${COLORS.lime};">Guessr</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="tg-card" align="center" bgcolor="${COLORS.cardBottom}" style="background-color:${COLORS.cardBottom};background-image:linear-gradient(180deg,${COLORS.cardTop},${COLORS.cardBottom});border:1px solid ${COLORS.border};border-radius:28px;padding:40px 36px;box-shadow:0 10px 28px rgba(5,3,16,0.42);">
                <p style="margin:0 0 12px;font-family:${DISPLAY_FONT};font-size:11px;line-height:1.4;letter-spacing:2px;font-weight:600;color:${COLORS.lime};text-transform:uppercase;">${eyebrow}</p>
                <h1 style="margin:0 0 14px;font-family:${DISPLAY_FONT};font-size:28px;line-height:1.2;letter-spacing:-0.3px;font-weight:600;color:${COLORS.cream};">${heading}</h1>
                <p style="margin:0 0 28px;font-family:${BODY_FONT};font-size:15px;line-height:1.65;color:${COLORS.muted};">${intro}</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
                  <tr>
                    <td align="center" bgcolor="${COLORS.lime}" style="border-radius:18px;background-color:${COLORS.lime};box-shadow:inset 0 1px 0 rgba(255,255,255,0.35),0 10px 24px rgba(5,3,16,0.36);">
                      <a href="${actionUrl}" target="_blank" rel="noopener" class="tg-btn" style="display:block;padding:15px 28px;font-family:${DISPLAY_FONT};font-size:16px;font-weight:600;line-height:1.2;color:${COLORS.ink};text-decoration:none;border-radius:18px;">${actionLabel}</a>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;">
                  <tr>
                    <td align="left" bgcolor="${COLORS.inset}" style="background-color:${COLORS.inset};border:1px solid ${COLORS.borderSubtle};border-radius:16px;padding:14px 16px;font-family:${BODY_FONT};font-size:13px;line-height:1.6;color:${COLORS.muted};">${note}</td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="left" style="border-top:1px solid ${COLORS.borderSubtle};padding-top:18px;font-family:${BODY_FONT};font-size:12px;line-height:1.65;color:${COLORS.subtle};">
                      If the button doesn’t work, copy and paste this link into your browser:
                      <br />
                      <a href="${actionUrl}" target="_blank" rel="noopener" style="color:${COLORS.limeLight};text-decoration:underline;word-break:break-all;">${actionUrl}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 12px 0;font-family:${BODY_FONT};font-size:12px;line-height:1.65;color:${COLORS.subtle};">
                <p style="margin:0 0 6px;">${footer}</p>
                <p style="margin:0;">© ${new Date().getFullYear()} TerraGuessr · Explore the World</p>
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
      eyebrow: 'Email verification',
      heading: 'Confirm your email',
      intro:
        'You are one step away from your first expedition. Verify your email address to finish creating your TerraGuessr account and start exploring.',
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
      eyebrow: 'Account security',
      heading: 'Confirm this email change',
      intro: [
        'We received a request to change your TerraGuessr email from ',
        { emphasis: input.oldEmail },
        ' to ',
        { emphasis: input.newEmail },
        '. Confirm from this inbox to approve it.',
      ],
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
      heading: 'Confirm your new email',
      intro: [
        'Confirm ',
        { emphasis: input.newEmail },
        ' to finish changing your TerraGuessr email from ',
        { emphasis: input.oldEmail },
        '. Your current address must also approve the change.',
      ],
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
      eyebrow: 'Password recovery',
      heading: 'Reset your password',
      intro:
        'We received a request to reset the password for your TerraGuessr account. Use the button below to choose a new one.',
      actionLabel: 'Reset password',
      actionUrl,
      note: 'This one-time link expires in 30 minutes. If you did not request a reset, you can safely ignore this message.',
      preheader: 'Use this one-time link within 30 minutes to reset your TerraGuessr password.',
      footer: 'You are receiving this because a password reset was requested for this address.',
    }),
  };
}
