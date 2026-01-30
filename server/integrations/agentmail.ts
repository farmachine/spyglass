import { AgentMail } from 'agentmail';

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
  return new AgentMail({
    baseUrl: "https://api.agentmail.to",
    apiKey: apiKey
  });
}

export async function createProjectInbox(projectId: string): Promise<{ email: string; inboxId: string }> {
  const client = await getAgentMailClient();
  
  const inbox = await client.inboxes.create({
    username: `extrapl-${projectId.slice(0, 8)}`,
    clientId: `extrapl-project-${projectId}`, // Idempotent - prevents duplicate inboxes
  });
  
  return {
    email: inbox.email || '',
    inboxId: inbox.inboxId || ''
  };
}

export async function getInboxMessages(inboxId: string) {
  const client = await getAgentMailClient();
  const messages = await client.inboxes.messages.list(inboxId);
  return messages.items || [];
}

export async function getMessage(messageId: string) {
  const client = await getAgentMailClient();
  const message = await client.messages.get(messageId);
  return message;
}

export async function getMessageAttachments(messageId: string) {
  const client = await getAgentMailClient();
  const message = await client.messages.get(messageId);
  return message.attachments || [];
}

export async function downloadAttachment(messageId: string, attachmentId: string): Promise<{ data: Buffer; filename: string; contentType: string }> {
  const client = await getAgentMailClient();
  const attachment = await client.messages.attachments.download(messageId, attachmentId);
  
  return {
    data: Buffer.from(attachment.content || '', 'base64'),
    filename: attachment.filename || 'attachment',
    contentType: attachment.content_type || 'application/octet-stream'
  };
}

export async function createWebhook(inboxId: string, webhookUrl: string): Promise<{ webhookId: string }> {
  const client = await getAgentMailClient();
  
  const webhook = await client.webhooks.create({
    url: webhookUrl,
    eventTypes: ['message.received'],
    inboxIds: [inboxId],
    clientId: `extrapl-webhook-${inboxId}`, // Idempotent
  });
  
  return {
    webhookId: webhook.id || ''
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
