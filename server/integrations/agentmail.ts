import { AgentMailClient } from 'agentmail';

let connectionSettings: any;

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
  
  // Debug: log the attachment structure to see what's returned
  const keys = Object.keys(attachment || {});
  console.log(`📧 Attachment keys: ${keys.join(', ')}`);
  
  // Try different possible property names for the content
  const contentBase64 = attachment.content || attachment.data || attachment.body || attachment.base64 || '';
  if (!contentBase64) {
    console.log(`📧 Attachment object: ${JSON.stringify(attachment).slice(0, 500)}`);
  }
  
  return {
    data: Buffer.from(contentBase64, 'base64'),
    filename: attachment.filename || attachment.fileName || 'attachment',
    contentType: attachment.contentType || attachment.content_type || 'application/octet-stream'
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
