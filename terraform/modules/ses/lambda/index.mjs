/**
 * AWS Lambda — SES Inbound Email Forwarder
 *
 * Receives SNS notifications from SES when an email arrives.
 * Extracts metadata from the SES notification (to, from, subject, messageId, s3Key)
 * and POSTs it to the application webhook endpoint.
 *
 * The app then reads the full raw email from S3 and parses it with mailparser.
 * This keeps the Lambda lightweight — no email parsing libraries needed.
 */

const WEBHOOK_URL = process.env.WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

export async function handler(event) {
  console.log('SES Inbound Lambda invoked, records:', event.Records?.length);

  for (const record of event.Records || []) {
    try {
      // SNS wraps the SES notification in a Message field
      const snsMessage = JSON.parse(record.Sns.Message);
      const notificationType = snsMessage.notificationType;

      if (notificationType !== 'Received') {
        console.log(`Ignoring notification type: ${notificationType}`);
        continue;
      }

      const mail = snsMessage.mail;
      const receipt = snsMessage.receipt;

      // Extract the S3 object key where SES stored the raw email
      const s3Action = receipt.action;
      const s3BucketName = s3Action?.bucketName;
      const s3ObjectKey = s3Action?.objectKey;

      if (!s3ObjectKey) {
        console.error('No S3 object key found in receipt action');
        continue;
      }

      // Build webhook payload with essential metadata
      const payload = {
        messageId: mail.messageId,
        source: mail.source,
        from: mail.commonHeaders?.from?.[0] || mail.source,
        to: mail.commonHeaders?.to || mail.destination || [],
        subject: mail.commonHeaders?.subject || '(no subject)',
        date: mail.commonHeaders?.date || mail.timestamp,
        s3Bucket: s3BucketName,
        s3Key: s3ObjectKey,
        // Include some receipt info
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
      console.error('Error processing SNS record:', err);
    }
  }

  return { statusCode: 200, body: 'OK' };
}
