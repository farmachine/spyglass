/**
 * Email Service for extrapl
 *
 * Uses AWS SES (Simple Email Service) for sending emails.
 * Falls back to console logging if SES is not configured.
 *
 * Prerequisites:
 * - AWS SES domain verification for extrapl.it
 * - SES send permissions on the ECS task IAM role
 * - If in SES sandbox mode, recipient emails must be verified too
 */

import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const CONTACT_FORM_RECIPIENT = 'info@extrapl.io';
const CONTACT_FORM_SENDER = 'contact@extrapl.it';

// SES client — uses IAM role credentials automatically on ECS
let sesClient: SESv2Client | null = null;

function getSesClient(): SESv2Client {
  if (!sesClient) {
    sesClient = new SESv2Client({
      region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'eu-west-1',
    });
  }
  return sesClient;
}

/**
 * Send a contact form notification email to info@extrapl.io via AWS SES.
 */
export async function sendContactFormEmail(params: {
  name: string;
  email: string;
  message: string;
}): Promise<void> {
  const { name, email, message } = params;

  const subject = `New Contact Form Submission from ${name}`;

  const textBody = [
    `New contact form submission:`,
    ``,
    `Name: ${name}`,
    `Email: ${email}`,
    ``,
    `Message:`,
    message,
    ``,
    `---`,
    `This message was submitted via the extrapl contact form.`,
  ].join('\n');

  const htmlBody = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f0f0f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f0f4;">
<tr><td align="center" style="padding:48px 20px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<tr><td style="background-color:#151929;padding:40px 40px 36px 40px;text-align:center;">
<span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:36px;font-weight:700;color:#ffffff;letter-spacing:-1px;">extrapl</span><span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:36px;font-weight:700;color:#4F63A4;">&bull;</span>
</td></tr>
<tr><td style="background-color:#ffffff;padding:36px 40px 20px 40px;">
<h1 style="margin:0 0 16px 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:#151929;line-height:1.4;">New Contact Form Submission</h1>
<div style="width:40px;height:3px;background-color:#4F63A4;border-radius:2px;margin-bottom:20px;"></div>
<div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#4a4a5a;">
  <p><strong>Name:</strong> ${escapeHtml(name)}</p>
  <p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}" style="color:#4F63A4;text-decoration:none;">${escapeHtml(email)}</a></p>
  <p><strong>Message:</strong></p>
  <p style="white-space:pre-wrap;background-color:#f8f9fb;padding:16px;border-radius:8px;border:1px solid #e5e7eb;">${escapeHtml(message)}</p>
</div>
</td></tr>
<tr><td style="background-color:#ffffff;padding:12px 40px 36px 40px;">
<div style="border-top:1px solid #e5e7eb;padding-top:20px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#9ca3af;">
  This message was submitted via the extrapl contact form.<br>
  You can reply directly to <a href="mailto:${escapeHtml(email)}" style="color:#4F63A4;text-decoration:none;">${escapeHtml(email)}</a>.
</div>
</td></tr>
<tr><td style="background-color:#f8f9fb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
<span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;color:#9ca3af;">&copy; 2026 extrapl. All rights reserved.</span>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const client = getSesClient();

  const command = new SendEmailCommand({
    FromEmailAddress: CONTACT_FORM_SENDER,
    ReplyToAddresses: [email],
    Destination: {
      ToAddresses: [CONTACT_FORM_RECIPIENT],
    },
    Content: {
      Simple: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Text: {
            Data: textBody,
            Charset: 'UTF-8',
          },
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8',
          },
        },
      },
    },
  });

  await client.send(command);
}

/** Escape HTML special characters to prevent XSS in email templates */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
