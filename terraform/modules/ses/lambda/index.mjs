/**
 * AWS Lambda — SES Inbound Email Forwarder
 *
 * Handles TWO invocation modes:
 * 1. Direct SES Lambda action (preferred — no size limits)
 * 2. SNS notification (fallback — 150KB limit)
 *
 * Extracts metadata from the SES notification (to, from, subject, messageId)
 * and POSTs it to the application webhook endpoint.
 *
 * The app then reads the full raw email from S3 and parses it with mailparser.
 * This keeps the Lambda lightweight — no email parsing libraries needed.
 */

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || 'extrapl-staging-documents';

export async function handler(event) {
  console.log('SES Inbound Lambda invoked:', JSON.stringify(event).slice(0, 2000));

  let sesRecords = [];

  // Detect invocation mode
  if (event.Records && event.Records[0]?.eventSource === 'aws:ses') {
    // Mode 1: Direct SES Lambda action
    console.log('Mode: Direct SES invocation');
    sesRecords = event.Records.map(r => ({
      mail: r.ses.mail,
      receipt: r.ses.receipt,
    }));
  } else if (event.Records && event.Records[0]?.Sns) {
    // Mode 2: SNS notification
    console.log('Mode: SNS notification');
    for (const record of event.Records) {
      try {
        const snsMessage = JSON.parse(record.Sns.Message);
        if (snsMessage.notificationType === 'Received') {
          sesRecords.push({
            mail: snsMessage.mail,
            receipt: snsMessage.receipt,
          });
        } else {
          console.log(`Ignoring notification type: ${snsMessage.notificationType}`);
        }
      } catch (err) {
        console.error('Failed to parse SNS message:', err);
      }
    }
  } else {
    console.error('Unknown event format:', JSON.stringify(event).slice(0, 500));
    return { statusCode: 400, body: 'Unknown event format' };
  }

  console.log(`Processing ${sesRecords.length} SES record(s)`);

  for (const { mail, receipt } of sesRecords) {
    try {
      // Construct the S3 key — SES stores raw email as: {prefix}{messageId}
      const s3ObjectKey = `inbound-emails/${mail.messageId}`;
      console.log(`S3 key: ${s3ObjectKey}`);

      // Build webhook payload with essential metadata
      const payload = {
        messageId: mail.messageId,
        source: mail.source,
        from: mail.commonHeaders?.from?.[0] || mail.source,
        to: mail.commonHeaders?.to || mail.destination || [],
        subject: mail.commonHeaders?.subject || '(no subject)',
        date: mail.commonHeaders?.date || mail.timestamp,
        s3Bucket: S3_BUCKET_NAME,
        s3Key: s3ObjectKey,
        // Include receipt verdicts
        spamVerdict: receipt.spamVerdict?.status,
        virusVerdict: receipt.virusVerdict?.status,
        spfVerdict: receipt.spfVerdict?.status,
        dkimVerdict: receipt.dkimVerdict?.status,
        dmarcVerdict: receipt.dmarcVerdict?.status,
      };

      console.log(`Forwarding email ${mail.messageId} to webhook:`, JSON.stringify({
        from: payload.from,
        to: payload.to,
        subject: payload.subject,
        s3Key: payload.s3Key,
      }));

      // POST to the application webhook
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(WEBHOOK_SECRET ? { 'X-Webhook-Secret': WEBHOOK_SECRET } : {}),
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      console.log(`Webhook response: ${response.status} ${responseText.slice(0, 500)}`);

      if (!response.ok) {
        console.error(`Webhook returned ${response.status}: ${responseText.slice(0, 500)}`);
      }
    } catch (err) {
      console.error('Error processing SES record:', err);
    }
  }

  // Must return a valid disposition for SES Lambda action
  return { disposition: 'STOP_RULE' };
}
