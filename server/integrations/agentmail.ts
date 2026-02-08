import { AgentMailClient } from 'agentmail';

let connectionSettings: any;

export const DEFAULT_EMAIL_TEMPLATE = `<!DOCTYPE html>
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
<span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:36px;font-weight:700;color:#ffffff;letter-spacing:-1px;">extrapl</span><span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:36px;font-weight:700;color:#6B7AC7;">.</span>
<div style="margin-top:16px;width:40px;height:3px;background-color:#4F63A4;border-radius:2px;display:inline-block;"></div>
<div style="margin-top:14px;font-size:14px;font-weight:400;color:#8B9AD8;letter-spacing:1px;">Reinventing Process.</div>
</td></tr>
<tr><td style="background-color:#ffffff;padding:36px 40px 20px 40px;">
<h1 style="margin:0 0 16px 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:#151929;line-height:1.4;">{{subject}}</h1>
<div style="width:40px;height:3px;background-color:#4F63A4;border-radius:2px;margin-bottom:20px;"></div>
<div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#4a4a5a;">{{body}}</div>
</td></tr>
<tr><td style="background-color:#ffffff;padding:12px 40px 36px 40px;">
<div style="border-top:1px solid #e5e7eb;padding-top:20px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#6b7280;">
Best regards,<br>
<span style="font-weight:600;color:#151929;">The extrapl Team</span>
</div>
</td></tr>
<tr><td style="background-color:#f8f9fb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
<a href="mailto:josh@extrapl.io" style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#4F63A4;text-decoration:none;">josh@extrapl.io</a>
<br>
<span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;color:#9ca3af;">&copy; 2026 extrapl. All rights reserved.</span>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

export function renderEmailTemplate(
  template: string,
  placeholders: {
    subject: string;
    body: string;
    projectName: string;
    senderEmail: string;
  }
): string {
  return template
    .replace(/\{\{subject\}\}/g, placeholders.subject)
    .replace(/\{\{body\}\}/g, placeholders.body)
    .replace(/\{\{projectName\}\}/g, placeholders.projectName)
    .replace(/\{\{senderEmail\}\}/g, placeholders.senderEmail);
}

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=agentmail',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || !connectionSettings.settings.api_key) {
    throw new Error('AgentMail not connected');
  }
  return { apiKey: connectionSettings.settings.api_key };
}

export async function getAgentMailClient() {
  const { apiKey } = await getCredentials();
  return new AgentMailClient({
    apiKey: apiKey
  });
}

export async function createProjectInbox(projectId: string): Promise<{ email: string; inboxId: string }> {
  const client = await getAgentMailClient();
  
  const username = `extrapl-${projectId.slice(0, 8)}`;
  const inbox = await client.inboxes.create({
    username: username,
    clientId: `extrapl-project-${projectId}`,
  });
  
  const email = `${username}@agentmail.to`;
  
  return {
    email: email,
    inboxId: inbox.inboxId
  };
}

export async function getInboxMessages(inboxId: string) {
  const client = await getAgentMailClient();
  // Make sure inboxId is the full email format
  const normalizedInboxId = inboxId.includes('@') ? inboxId : `${inboxId}@agentmail.to`;
  console.log(`📧 Fetching messages for inbox: ${normalizedInboxId}`);
  const response = await client.inboxes.messages.list(normalizedInboxId);
  console.log(`📧 Raw response:`, JSON.stringify(response, null, 2));
  const messages = (response as any).items || (response as any).messages || [];
  console.log(`📧 Extracted messages count: ${messages.length}`);
  return messages;
}

export async function getMessage(inboxId: string, messageId: string) {
  const client = await getAgentMailClient();
  const normalizedInboxId = inboxId.includes('@') ? inboxId : `${inboxId}@agentmail.to`;
  const message = await client.inboxes.messages.get(normalizedInboxId, messageId);
  return message;
}

export async function downloadAttachment(inboxId: string, messageId: string, attachmentId: string): Promise<{ data: Buffer; filename: string; contentType: string }> {
  const client = await getAgentMailClient();
  const normalizedInboxId = inboxId.includes('@') ? inboxId : `${inboxId}@agentmail.to`;
  const attachment = await client.inboxes.messages.getAttachment(normalizedInboxId, messageId, attachmentId) as any;
  
  let fileData: Buffer;
  
  // Check if there's a downloadUrl - if so, fetch the file from that URL
  if (attachment.downloadUrl) {
    console.log(`📧 Downloading from URL: ${attachment.downloadUrl.slice(0, 100)}...`);
    const response = await fetch(attachment.downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download attachment: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    fileData = Buffer.from(arrayBuffer);
    console.log(`📧 Downloaded ${fileData.length} bytes`);
  } else if (attachment.content || attachment.data || attachment.body) {
    // Fall back to base64 content if provided directly
    const contentBase64 = attachment.content || attachment.data || attachment.body || '';
    fileData = Buffer.from(contentBase64, 'base64');
  } else {
    console.log(`📧 No content or downloadUrl found in attachment`);
    fileData = Buffer.alloc(0);
  }
  
  const filename = attachment.filename || attachment.fileName || 'attachment';
  let contentType = attachment.contentType || attachment.content_type || attachment.mimeType || attachment.mime_type || '';
  
  if (!contentType || contentType === 'application/octet-stream') {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'txt': 'text/plain',
      'csv': 'text/csv',
    };
    contentType = (ext && mimeMap[ext]) || contentType || 'application/octet-stream';
  }
  
  return {
    data: fileData,
    filename,
    contentType
  };
}

export async function createWebhook(inboxId: string, webhookUrl: string): Promise<{ webhookId: string }> {
  const client = await getAgentMailClient();
  
  const cleanInboxId = inboxId.replace(/[^A-Za-z0-9._~-]/g, '');
  const webhook = await client.webhooks.create({
    url: webhookUrl,
    eventTypes: ['message.received'],
    inboxIds: [inboxId],
    clientId: `extrapl-wh-${cleanInboxId}`,
  });
  
  return {
    webhookId: webhook.webhookId
  };
}

export interface InboundEmailPayload {
  event_type: string;
  message_id: string;
  thread_id: string;
  inbox_id: string;
  from_: string[];
  to: string[];
  subject: string;
  text_plain: string;
  text_html?: string;
  attachments?: Array<{
    attachment_id: string;
    filename: string;
    content_type: string;
    size: number;
  }>;
}

export async function sendEmail(params: {
  fromInboxId: string;
  to: string;
  subject: string;
  textContent: string;
  htmlContent?: string;
  replyToMessageId?: string;
}): Promise<{ messageId: string }> {
  const client = await getAgentMailClient();
  const normalizedInboxId = params.fromInboxId.includes('@') ? params.fromInboxId : `${params.fromInboxId}@agentmail.to`;
  
  const messageParams: any = {
    to: [params.to],
    subject: params.subject,
    text: params.textContent,
  };
  
  if (params.htmlContent) {
    messageParams.html = params.htmlContent;
  }
  
  if (params.replyToMessageId) {
    messageParams.inReplyTo = params.replyToMessageId;
  }
  
  const result = await client.inboxes.messages.send(normalizedInboxId, messageParams);
  
  return {
    messageId: (result as any).messageId || (result as any).message_id || ''
  };
}
