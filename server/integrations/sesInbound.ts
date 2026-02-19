/**
 * SES Inbound Email Integration
 *
 * Reads raw email from S3 (stored by SES receipt rule) and parses it
 * using mailparser. Returns structured email data with attachment buffers.
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { simpleParser, ParsedMail } from 'mailparser';

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'eu-west-1',
    });
  }
  return s3Client;
}

export interface ParsedInboundEmail {
  messageId: string;
  from: string;
  to: string[];
  subject: string;
  textContent: string;
  htmlContent: string;
  date: Date | undefined;
  attachments: Array<{
    filename: string;
    contentType: string;
    size: number;
    content: Buffer;
  }>;
}

/**
 * Read the raw email from S3 and parse it with mailparser.
 * Returns structured email data including attachment buffers.
 */
export async function parseRawEmailFromS3(s3Key: string, s3Bucket?: string): Promise<ParsedInboundEmail> {
  const bucket = s3Bucket || process.env.S3_BUCKET_NAME;
  if (!bucket) {
    throw new Error('S3 bucket name not configured');
  }

  console.log(`📧 SES: Reading raw email from s3://${bucket}/${s3Key}`);

  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: s3Key,
  });

  const response = await client.send(command);
  const rawEmail = await response.Body?.transformToByteArray();

  if (!rawEmail) {
    throw new Error(`Empty email body at s3://${bucket}/${s3Key}`);
  }

  console.log(`📧 SES: Raw email size: ${rawEmail.length} bytes, parsing...`);

  const parsed: ParsedMail = await simpleParser(Buffer.from(rawEmail));

  // Extract the first "from" address
  const fromAddress = parsed.from?.value?.[0]?.address || parsed.from?.text || 'unknown@example.com';

  // Extract all "to" addresses
  const toAddresses: string[] = [];
  if (parsed.to) {
    const toField = Array.isArray(parsed.to) ? parsed.to : [parsed.to];
    for (const addr of toField) {
      if (addr.value) {
        for (const v of addr.value) {
          if (v.address) toAddresses.push(v.address.toLowerCase());
        }
      }
    }
  }

  // Extract attachments (filter out inline images and signature files)
  const attachments = (parsed.attachments || [])
    .filter(att => {
      const fname = att.filename || '';
      const ftype = att.contentType || '';
      const fsize = att.size || 0;
      // Skip common email signature images
      if (ftype.startsWith('image/') && fsize < 50000 && !fname) return false;
      if (/^(image\d+\.(png|jpg|gif)|logo\.(png|jpg)|signature\.(png|jpg))$/i.test(fname)) return false;
      return true;
    })
    .map(att => ({
      filename: att.filename || 'attachment',
      contentType: att.contentType || 'application/octet-stream',
      size: att.size || att.content.length,
      content: att.content,
    }));

  console.log(`📧 SES: Parsed email from ${fromAddress}, subject: "${parsed.subject}", ${attachments.length} attachment(s)`);

  return {
    messageId: parsed.messageId || s3Key,
    from: fromAddress,
    to: toAddresses,
    subject: parsed.subject || '(no subject)',
    textContent: parsed.text || '',
    htmlContent: parsed.html || '',
    date: parsed.date,
    attachments,
  };
}
