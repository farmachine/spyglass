import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MailOpen, ArrowLeft, Plus, MessageCircle, Star, X, AlertCircle, Paperclip, UserPlus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import DOMPurify from "dompurify";
import type { Project, SessionEmail, SessionConversation, ConversationParticipant } from "@shared/schema";

interface SessionMessengerProps {
  sessionId: string;
  project: Project;
}

type EnrichedConversation = SessionConversation & {
  emailCount: number;
  lastEmailPreview: string | null;
  lastEmailDate: string | Date;
  participants: ConversationParticipant[];
};

/**
 * Trim quoted email chain and signatures from reply content.
 */
function trimEmailChain(body: string): string {
  const lines = body.split('\n');
  let cutIndex = lines.length;

  // First pass: strip quoted reply chains
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (
      /^On .+ wrote:$/i.test(line) ||
      /^-{3,}\s*Original Message\s*-{3,}$/i.test(line) ||
      /^_{3,}$/i.test(line) ||
      (/^From:\s+.+@.+/i.test(line) && i > 0) ||
      /^>{2,}\s/.test(line)
    ) {
      cutIndex = i;
      break;
    }
    if (/^>\s/.test(line) && i > 0) {
      const prevLine = lines[i - 1]?.trim();
      if (/^>\s/.test(prevLine) || /^On .+ wrote:$/i.test(prevLine)) {
        cutIndex = i - 1;
        break;
      }
      if (i + 1 < lines.length && /^>\s/.test(lines[i + 1]?.trim())) {
        cutIndex = i;
        break;
      }
    }
  }

  let result = lines.slice(0, cutIndex).join('\n').trimEnd();

  // Second pass: strip email signatures
  const resultLines = result.split('\n');
  for (let i = 0; i < resultLines.length; i++) {
    const line = resultLines[i].trim();
    const remainingLines = resultLines.length - i;
    // Only cut if remaining content is short (signature-length)
    if (remainingLines <= 15) {
      if (
        line === '--' || line === '\u2014' ||
        /^-{2,}\s*$/.test(line) ||
        /^Sent from (my |Mail |Outlook|Yahoo)/i.test(line) ||
        /^Get Outlook for/i.test(line) ||
        /^(Best regards|Kind regards|Regards|Thanks|Cheers|Sincerely|Warm regards|Best wishes|Thank you),?\s*$/i.test(line)
      ) {
        result = resultLines.slice(0, i).join('\n').trimEnd();
        break;
      }
    }
  }

  return result;
}

function formatDate(date: string | Date) {
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SessionMessenger({ sessionId, project }: SessionMessengerProps) {
  const [view, setView] = useState<'conversations' | 'thread'>('conversations');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [newConvSubject, setNewConvSubject] = useState("");
  const [newConvEmail, setNewConvEmail] = useState("");
  const [newConvBody, setNewConvBody] = useState("");
  const [body, setBody] = useState("");
  const [isAddingParticipant, setIsAddingParticipant] = useState(false);
  const [newParticipantEmail, setNewParticipantEmail] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const hasInbox = !!project.inboxEmailAddress;

  // Fetch conversations for this session
  const { data: conversations = [], isLoading: convLoading } = useQuery<EnrichedConversation[]>({
    queryKey: ['/api/sessions', sessionId, 'conversations'],
  });

  // Fetch emails for selected conversation
  const { data: conversationEmails = [], isLoading: threadLoading } = useQuery<SessionEmail[]>({
    queryKey: ['/api/sessions', sessionId, 'conversations', selectedConversationId, 'emails'],
    enabled: !!selectedConversationId && view === 'thread',
  });

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  // Create conversation mutation
  const createConvMutation = useMutation({
    mutationFn: async (data: { subject: string; participantEmail: string; initialMessage?: string }) => {
      return await apiRequest(`/api/sessions/${sessionId}/conversations`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'activity'] });
      setIsCreatingConversation(false);
      setNewConvSubject("");
      setNewConvEmail("");
      setNewConvBody("");
      toast({ title: "Conversation created", description: "New conversation thread created." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create conversation.", variant: "destructive" });
    },
  });

  // Send email in conversation (IM-style, subject auto-derived)
  const sendConvEmailMutation = useMutation({
    mutationFn: async (data: { subject: string; body: string }) => {
      return await apiRequest(`/api/sessions/${sessionId}/conversations/${selectedConversationId}/emails`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'conversations', selectedConversationId, 'emails'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'activity'] });
      setBody("");
      toast({ title: "Message sent", description: "Your message has been sent." });
    },
    onError: () => {
      toast({ title: "Send failed", description: "Failed to send message. Please try again.", variant: "destructive" });
    },
  });

  // Add participant mutation
  const addParticipantMutation = useMutation({
    mutationFn: async (data: { email: string }) => {
      return await apiRequest(`/api/sessions/${sessionId}/conversations/${selectedConversationId}/participants`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'conversations'] });
      setNewParticipantEmail("");
      setIsAddingParticipant(false);
      toast({ title: "Participant added" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add participant.", variant: "destructive" });
    },
  });

  // Remove participant mutation
  const removeParticipantMutation = useMutation({
    mutationFn: async (participantId: string) => {
      return await apiRequest(`/api/sessions/${sessionId}/conversations/${selectedConversationId}/participants/${participantId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'conversations'] });
      toast({ title: "Participant removed" });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationEmails]);

  const openConversation = (convId: string) => {
    setSelectedConversationId(convId);
    setView('thread');
    setBody("");
    setIsAddingParticipant(false);
    setNewParticipantEmail("");
  };

  const backToConversations = () => {
    setView('conversations');
    setSelectedConversationId(null);
    setBody("");
    setIsAddingParticipant(false);
    setNewParticipantEmail("");
  };

  // Derive reply subject from conversation
  const getReplySubject = () => {
    const convSubject = selectedConversation?.subject;
    if (convSubject) {
      return convSubject.startsWith('Re:') ? convSubject : `Re: ${convSubject}`;
    }
    if (conversationEmails.length > 0) {
      const firstSubject = conversationEmails[0]?.subject;
      if (firstSubject) {
        return firstSubject.startsWith('Re:') ? firstSubject : `Re: ${firstSubject}`;
      }
    }
    return '(no subject)';
  };

  const handleSend = () => {
    if (body.trim() && hasInbox) {
      sendConvEmailMutation.mutate({ subject: getReplySubject(), body: body.trim() });
    }
  };

  // ─── Conversations List View ───
  if (view === 'conversations') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Conversations</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-[#4F63A4] hover:text-[#3d4f85]"
            onClick={() => setIsCreatingConversation(!isCreatingConversation)}
          >
            <Plus className="h-3 w-3 mr-1" />
            New
          </Button>
        </div>

        {/* New Conversation Form (top) */}
        {isCreatingConversation && (
          <div className="border-b border-gray-200 dark:border-gray-700 p-3 space-y-2 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">New Conversation</span>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setIsCreatingConversation(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
            <Input
              value={newConvSubject}
              onChange={(e) => setNewConvSubject(e.target.value)}
              placeholder="Subject..."
              className="text-sm h-8"
            />
            <Input
              value={newConvEmail}
              onChange={(e) => setNewConvEmail(e.target.value)}
              placeholder="Email address..."
              className="text-sm h-8"
              type="email"
            />
            <Textarea
              value={newConvBody}
              onChange={(e) => setNewConvBody(e.target.value)}
              placeholder="First message (optional)..."
              className="text-sm min-h-[100px] resize-y"
            />
            <Button
              onClick={() => {
                if (newConvSubject.trim() && newConvEmail.trim()) {
                  createConvMutation.mutate({
                    subject: newConvSubject.trim(),
                    participantEmail: newConvEmail.trim(),
                    initialMessage: newConvBody.trim() || undefined,
                  });
                }
              }}
              disabled={!newConvSubject.trim() || !newConvEmail.trim() || createConvMutation.isPending}
              size="sm"
              className="w-full bg-[#4F63A4] hover:bg-[#3d4f85] text-white h-8 text-xs"
            >
              {createConvMutation.isPending ? 'Creating...' : 'Create Conversation'}
            </Button>
          </div>
        )}

        <ScrollArea className="flex-1">
          {convLoading ? (
            <div className="text-xs text-gray-500 text-center py-8">Loading conversations...</div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 px-4">
              <MessageCircle className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-500 dark:text-gray-400">No conversations yet.</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Create a new conversation to start messaging.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  className="w-full text-left px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  onClick={() => openConversation(conv.id)}
                >
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {conv.isOriginator ? (
                        <div className="flex-shrink-0 w-6 h-6 bg-[#4F63A4] rounded-full flex items-center justify-center">
                          <Star className="h-3 w-3 text-white" />
                        </div>
                      ) : (
                        <div className="flex-shrink-0 w-6 h-6 bg-[#4F63A4]/20 rounded-full flex items-center justify-center">
                          <MessageCircle className="h-3 w-3 text-[#4F63A4]" />
                        </div>
                      )}
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {conv.subject || conv.name}
                      </span>
                      {conv.isOriginator && (
                        <span className="text-[9px] uppercase tracking-wider font-semibold text-[#4F63A4] bg-[#4F63A4]/10 dark:bg-[#4F63A4]/20 px-1.5 py-0.5 rounded flex-shrink-0">
                          Originator
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[120px]">
                        {conv.participants?.length > 1
                          ? `${conv.participants.length} people`
                          : conv.participantEmail}
                      </span>
                      {conv.emailCount > 0 && (
                        <span className="text-[10px] bg-[#4F63A4] text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                          {conv.emailCount}
                        </span>
                      )}
                    </div>
                  </div>
                  {conv.lastEmailPreview && (
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate pl-8">
                      {conv.lastEmailPreview}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    );
  }

  // ─── Thread View (conversation emails) ───
  if (view === 'thread' && selectedConversation) {
    const participants = selectedConversation.participants || [];

    return (
      <div className="flex flex-col h-full">
        {/* Thread header */}
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0" onClick={backToConversations}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {selectedConversation.subject || selectedConversation.name}
                </span>
                {selectedConversation.isOriginator && (
                  <span className="text-[9px] uppercase tracking-wider font-semibold text-[#4F63A4] bg-[#4F63A4]/10 dark:bg-[#4F63A4]/20 px-1.5 py-0.5 rounded flex-shrink-0">
                    Originator
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 flex-shrink-0 text-gray-400 hover:text-[#4F63A4]"
                  onClick={() => setIsAddingParticipant(!isAddingParticipant)}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {/* Participant chips */}
              <div className="flex flex-wrap gap-1 mt-0.5">
                {participants.map(p => (
                  <span
                    key={p.id}
                    className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full flex items-center gap-1"
                  >
                    {p.name || p.email}
                    {participants.length > 1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); removeParticipantMutation.mutate(p.id); }}
                        className="hover:text-red-500"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Add participant form */}
          {isAddingParticipant && (
            <div className="flex items-center gap-2 mt-2 pl-9">
              <Input
                value={newParticipantEmail}
                onChange={(e) => setNewParticipantEmail(e.target.value)}
                placeholder="Add email address..."
                className="text-xs h-7 flex-1"
                type="email"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newParticipantEmail.trim()) {
                    e.preventDefault();
                    addParticipantMutation.mutate({ email: newParticipantEmail.trim() });
                  }
                }}
              />
              <Button
                size="sm"
                className="h-7 px-2 text-xs bg-[#4F63A4] hover:bg-[#3d4f85] text-white"
                onClick={() => {
                  if (newParticipantEmail.trim()) {
                    addParticipantMutation.mutate({ email: newParticipantEmail.trim() });
                  }
                }}
                disabled={!newParticipantEmail.trim() || addParticipantMutation.isPending}
              >
                Add
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => { setIsAddingParticipant(false); setNewParticipantEmail(""); }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Email thread */}
        <ScrollArea className="flex-1 p-3">
          <div className="space-y-3">
            {threadLoading ? (
              <div className="text-xs text-gray-500 text-center py-8">Loading messages...</div>
            ) : conversationEmails.length === 0 ? (
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-8">
                No messages in this conversation yet.
              </div>
            ) : (
              conversationEmails.map((email: SessionEmail) => (
                <div
                  key={email.id}
                  className={`flex ${email.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                >
                  {email.direction === 'inbound' && (
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center mr-2 mt-1">
                      <MailOpen className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <div className={`max-w-[80%] ${email.direction === 'outbound' ? 'text-right' : ''}`}>
                    <div className="text-[10px] text-gray-400 dark:text-gray-500 mb-0.5">
                      {email.direction === 'inbound' ? (
                        <span>From: {email.fromEmail}</span>
                      ) : (
                        <span>To: {email.toEmail}</span>
                      )}
                      <span className="mx-1.5">&middot;</span>
                      <span>{formatDate(email.createdAt)}</span>
                    </div>
                    <div
                      className={`px-3 py-2 rounded-lg text-sm leading-relaxed ${
                        email.direction === 'outbound' && !email.htmlBody
                          ? 'bg-[#4F63A4] text-white'
                          : email.direction === 'outbound' && email.htmlBody
                            ? 'bg-[#4F63A4]/10 dark:bg-[#4F63A4]/20 text-gray-900 dark:text-gray-100 border border-[#4F63A4]/20 dark:border-[#4F63A4]/30'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      {email.htmlBody ? (
                        <div
                          className="email-html-content prose prose-sm max-w-none dark:prose-invert [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_th]:border [&_th]:border-gray-300 dark:[&_th]:border-gray-600 [&_th]:bg-gray-100 dark:[&_th]:bg-gray-700 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-gray-300 dark:[&_td]:border-gray-600 [&_td]:px-2 [&_td]:py-1 [&_p]:my-1"
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(email.htmlBody) }}
                        />
                      ) : (
                        trimEmailChain(email.body).split('\n').map((line, i) => (
                          <div key={i}>{line || <br />}</div>
                        ))
                      )}
                    </div>
                    {(email as any).attachments?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(email as any).attachments.map((att: { id: string; fileName: string }) => (
                          <button
                            key={att.id}
                            onClick={async () => {
                              const token = localStorage.getItem("auth_token");
                              const resp = await fetch(`/api/sessions/documents/${att.id}/file`, {
                                headers: { Authorization: `Bearer ${token}` },
                              });
                              if (resp.ok) {
                                const blob = await resp.blob();
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = att.fileName;
                                a.click();
                                URL.revokeObjectURL(url);
                              }
                            }}
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer"
                          >
                            <Paperclip className="h-2.5 w-2.5" />
                            {att.fileName}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {email.direction === 'outbound' && (
                    <div className="flex-shrink-0 w-6 h-6 bg-[#4F63A4] rounded-full flex items-center justify-center ml-2 mt-1">
                      <Send className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* IM-style compose bar */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-2">
          {!hasInbox && (
            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 px-3 py-2 rounded mb-2">
              <AlertCircle className="h-3 w-3 flex-shrink-0" />
              <span>No inbox configured. Set up an inbox in project settings to send emails.</span>
            </div>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message..."
              className="text-sm min-h-[36px] max-h-[120px] resize-none flex-1"
              rows={1}
              disabled={!hasInbox}
            />
            <Button
              onClick={handleSend}
              disabled={!body.trim() || !hasInbox || sendConvEmailMutation.isPending}
              size="sm"
              className="bg-[#4F63A4] hover:bg-[#3d4f85] text-white h-9 w-9 p-0 flex-shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback — shouldn't happen, but show conversations view
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-6">
      <MessageCircle className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
      <p className="text-sm text-gray-500 dark:text-gray-400">Select a conversation to view messages.</p>
      <Button
        variant="ghost"
        size="sm"
        className="mt-2 text-xs text-[#4F63A4]"
        onClick={backToConversations}
      >
        Back to conversations
      </Button>
    </div>
  );
}
