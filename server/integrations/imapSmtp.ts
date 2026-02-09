import Imap from 'imap';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import { createLogger } from '../logger';

const logger = createLogger('imap-smtp');

interface ImapConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  encryption: 'tls' | 'ssl' | 'none';
}

interface SmtpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  encryption: 'tls' | 'ssl' | 'none';
}

interface FetchedEmail {
  messageId: string;
  subject: string;
  from: string;
  textContent: string;
  htmlContent: string;
  attachments: Array<{ filename: string; data: Buffer; contentType: string }>;
}

function getImapOptions(config: ImapConfig) {
  return {
    user: config.username,
    password: config.password,
    host: config.host,
    port: config.port,
    tls: config.encryption !== 'none',
    connTimeout: 10000,
    authTimeout: 10000,
  };
}

function getSmtpOptions(config: SmtpConfig) {
  const options: any = {
    host: config.host,
    port: config.port,
    auth: { user: config.username, pass: config.password },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
  };

  if (config.encryption === 'ssl') {
    options.secure = true;
  } else if (config.encryption === 'tls') {
    options.secure = false;
    options.requireTLS = true;
  } else {
    options.secure = false;
  }

  return options;
}

export async function testImapConnection(config: ImapConfig): Promise<{ success: boolean; message: string; messageCount?: number }> {
  return new Promise((resolve) => {
    const imap = new Imap(getImapOptions(config));

    const timeout = setTimeout(() => {
      try { imap.end(); } catch {}
      resolve({ success: false, message: 'Connection timed out after 10 seconds' });
    }, 10000);

    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err, box) => {
        clearTimeout(timeout);
        if (err) {
          imap.end();
          resolve({ success: false, message: `Failed to open INBOX: ${err.message}` });
          return;
        }
        const count = box.messages.total;
        imap.end();
        resolve({ success: true, message: `Connected successfully. ${count} message(s) in INBOX.`, messageCount: count });
      });
    });

    imap.once('error', (err: Error) => {
      clearTimeout(timeout);
      resolve({ success: false, message: `Connection failed: ${err.message}` });
    });

    imap.connect();
  });
}

export async function testSmtpConnection(config: SmtpConfig): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ success: false, message: 'Connection timed out after 10 seconds' });
    }, 10000);

    const transporter = nodemailer.createTransport(getSmtpOptions(config));
    transporter.verify((err) => {
      clearTimeout(timeout);
      if (err) {
        resolve({ success: false, message: `SMTP verification failed: ${err.message}` });
      } else {
        resolve({ success: true, message: 'SMTP connection verified successfully' });
      }
    });
  });
}

export async function fetchImapEmails(config: ImapConfig): Promise<FetchedEmail[]> {
  return new Promise((resolve, reject) => {
    const emails: FetchedEmail[] = [];
    const imap = new Imap(getImapOptions(config));

    const timeout = setTimeout(() => {
      try { imap.end(); } catch {}
      resolve(emails);
    }, 60000);

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err) => {
        if (err) {
          clearTimeout(timeout);
          imap.end();
          reject(new Error(`Failed to open INBOX: ${err.message}`));
          return;
        }

        imap.search(['UNSEEN'], (searchErr, results) => {
          if (searchErr) {
            clearTimeout(timeout);
            imap.end();
            reject(new Error(`Search failed: ${searchErr.message}`));
            return;
          }

          if (!results || results.length === 0) {
            clearTimeout(timeout);
            imap.end();
            resolve([]);
            return;
          }

          logger.info(`Found ${results.length} unseen messages`);

          const fetch = imap.fetch(results, { bodies: '', markSeen: true });
          const messagePromises: Promise<void>[] = [];

          fetch.on('message', (msg) => {
            const bodyPromise = new Promise<void>((msgResolve) => {
              let rawBuffer: Buffer | null = null;

              msg.on('body', (stream) => {
                const chunks: Buffer[] = [];
                stream.on('data', (chunk: Buffer) => {
                  chunks.push(chunk);
                });
                stream.once('end', () => {
                  rawBuffer = Buffer.concat(chunks);
                });
              });

              msg.once('end', () => {
                const buffer = rawBuffer || Buffer.alloc(0);
                simpleParser(buffer).then((parsed) => {
                  const messageId = parsed.messageId || `imap-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                  const from = typeof parsed.from?.text === 'string' ? parsed.from.text : (parsed.from?.value?.[0]?.address || 'unknown');
                  const attachments = (parsed.attachments || []).map((att) => ({
                    filename: att.filename || 'attachment',
                    data: att.content,
                    contentType: att.contentType || 'application/octet-stream',
                  }));

                  emails.push({
                    messageId,
                    subject: parsed.subject || 'No Subject',
                    from,
                    textContent: parsed.text || '',
                    htmlContent: parsed.html || '',
                    attachments,
                  });
                  msgResolve();
                }).catch((parseErr) => {
                  logger.error('Failed to parse message', { error: String(parseErr) });
                  msgResolve();
                });
              });
            });
            messagePromises.push(bodyPromise);
          });

          fetch.once('error', (fetchErr) => {
            logger.error('Fetch error', { error: String(fetchErr) });
          });

          fetch.once('end', () => {
            Promise.all(messagePromises).then(() => {
              clearTimeout(timeout);
              imap.end();
              resolve(emails);
            });
          });
        });
      });
    });

    imap.once('error', (err: Error) => {
      clearTimeout(timeout);
      reject(new Error(`IMAP connection failed: ${err.message}`));
    });

    imap.connect();
  });
}

export async function sendSmtpEmail(
  config: SmtpConfig,
  params: {
    from?: string;
    to: string;
    subject: string;
    textContent: string;
    htmlContent?: string;
    replyToMessageId?: string;
  }
): Promise<{ messageId: string }> {
  const transporter = nodemailer.createTransport(getSmtpOptions(config));

  const mailOptions: any = {
    from: params.from || config.username,
    to: params.to,
    subject: params.subject,
    text: params.textContent,
  };

  if (params.htmlContent) {
    mailOptions.html = params.htmlContent;
  }

  if (params.replyToMessageId) {
    mailOptions.inReplyTo = params.replyToMessageId;
    mailOptions.references = params.replyToMessageId;
  }

  const info = await transporter.sendMail(mailOptions);
  return { messageId: info.messageId };
}
