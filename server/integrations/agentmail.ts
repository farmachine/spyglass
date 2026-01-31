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
  // AgentMail SDK expects just the username, not the full email
  const normalizedInboxId = inboxId.replace('@agentmail.to', '');
  console.log(`📧 Fetching messages for inbox: ${normalizedInboxId} (from: ${inboxId})`);
  const response = await client.inboxes.messages.list(normalizedInboxId);
  return (response as any).items || [];
}

export async function getMessage(inboxId: string, messageId: string) {
  const client = await getAgentMailClient();
  const normalizedInboxId = inboxId.replace('@agentmail.to', '');
  const message = await client.inboxes.messages.get(normalizedInboxId, messageId);
  return message;
}

export async function downloadAttachment(inboxId: string, messageId: string, attachmentId: string): Promise<{ data: Buffer; filename: string; contentType: string }> {
  const client = await getAgentMailClient();
  const normalizedInboxId = inboxId.replace('@agentmail.to', '');
  const attachment = await client.inboxes.messages.getAttachment(normalizedInboxId, messageId, attachmentId) as any;
  
  return {
    data: Buffer.from(attachment.content || '', 'base64'),
    filename: attachment.filename || 'attachment',
    contentType: attachment.contentType || 'application/octet-stream'
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
