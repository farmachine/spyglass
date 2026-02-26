import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Copy, Check, Mail, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage, FieldValidation, ExtractionSession, Project } from "@shared/schema";

interface SessionAssistantProps {
  sessionId: string;
  session: ExtractionSession;
  validations: FieldValidation[];
  project: Project;
}

interface ConversationParticipant {
  id: string;
  name: string;
  email: string;
}

interface ConversationWithParticipants {
  id: string;
  name: string;
  subject?: string | null;
  participantEmail: string;
  isOriginator: boolean;
  participants: ConversationParticipant[];
}

// Parse draft marker from assistant message content
function parseDraftMarker(content: string): { conversationId: string; subject: string } | null {
  const match = content.match(/<!-- DRAFT_EMAIL conversationId="([^"]+)" subject="([^"]*)" -->/);
  if (match) {
    return { conversationId: match[1], subject: match[2] };
  }
  return null;
}

// Extract the draft body from blockquote content
function extractDraftBody(content: string): string {
  const lines = content.split('\n');
  const blockquoteLines: string[] = [];
  let inBlockquote = false;
  for (const line of lines) {
    if (line.startsWith('> ')) {
      inBlockquote = true;
      blockquoteLines.push(line.slice(2));
    } else if (inBlockquote && line.startsWith('>')) {
      blockquoteLines.push(line.slice(1).trimStart());
    } else if (inBlockquote && line.trim() === '') {
      blockquoteLines.push('');
    } else {
      if (inBlockquote) break;
    }
  }
  return blockquoteLines.join('\n').trim();
}

// Custom markdown components for compact styling in chat bubbles
const markdownComponents = {
  table: ({ children, ...props }: any) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full text-xs border-collapse border border-gray-200 dark:border-gray-600" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }: any) => (
    <thead className="bg-gray-50 dark:bg-gray-700" {...props}>{children}</thead>
  ),
  th: ({ children, ...props }: any) => (
    <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }: any) => (
    <td className="px-2 py-1 text-xs text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600" {...props}>
      {children}
    </td>
  ),
  p: ({ children, ...props }: any) => (
    <p className="my-1.5 leading-relaxed" {...props}>{children}</p>
  ),
  h2: ({ children, ...props }: any) => (
    <h2 className="text-sm font-semibold mt-3 mb-1 text-gray-900 dark:text-gray-100" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }: any) => (
    <h3 className="text-xs font-semibold mt-2 mb-1 text-gray-800 dark:text-gray-200" {...props}>{children}</h3>
  ),
  ul: ({ children, ...props }: any) => (
    <ul className="list-disc list-inside my-1 space-y-0.5" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }: any) => (
    <ol className="list-decimal list-inside my-1 space-y-0.5" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }: any) => (
    <li className="text-xs" {...props}>{children}</li>
  ),
  blockquote: ({ children, ...props }: any) => (
    <blockquote className="border-l-3 border-[#4F63A4] pl-3 my-2 text-gray-700 dark:text-gray-300 bg-[#4F63A4]/5 py-2 pr-2 rounded-r" {...props}>
      {children}
    </blockquote>
  ),
  strong: ({ children, ...props }: any) => (
    <strong className="font-semibold" {...props}>{children}</strong>
  ),
  code: ({ children, inline, ...props }: any) => (
    inline
      ? <code className="bg-gray-200 dark:bg-gray-600 px-1 py-0.5 rounded text-xs" {...props}>{children}</code>
      : <pre className="bg-gray-800 text-gray-100 p-2 rounded my-1 overflow-x-auto text-xs"><code {...props}>{children}</code></pre>
  ),
};

export default function SessionAssistant({ sessionId, session, validations, project }: SessionAssistantProps) {
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [sentDrafts, setSentDrafts] = useState<Set<string>>(new Set());
  const [sendingDraft, setSendingDraft] = useState<string | null>(null);
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionCursorPos, setMentionCursorPos] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionPopoverRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch chat messages
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['/api/sessions', sessionId, 'chat'],
  });

  // Fetch conversations with participants for @-mention
  const { data: conversations = [] } = useQuery<ConversationWithParticipants[]>({
    queryKey: ['/api/sessions', sessionId, 'conversations'],
  });

  // Get all unique participants across conversations
  const allParticipants = useMemo(() => {
    const seen = new Map<string, { name: string; email: string; conversationId: string; conversationName: string; isOriginator: boolean }>();
    conversations.forEach((conv: ConversationWithParticipants) => {
      if (conv.participants && conv.participants.length > 0) {
        conv.participants.forEach(p => {
          if (!seen.has(p.email)) {
            seen.set(p.email, {
              name: p.name,
              email: p.email,
              conversationId: conv.id,
              conversationName: conv.name,
              isOriginator: conv.isOriginator || false,
            });
          }
        });
      } else {
        // Fallback: use conversation's primary participant
        if (!seen.has(conv.participantEmail)) {
          seen.set(conv.participantEmail, {
            name: conv.name,
            email: conv.participantEmail,
            conversationId: conv.id,
            conversationName: conv.name,
            isOriginator: conv.isOriginator || false,
          });
        }
      }
    });
    return Array.from(seen.values());
  }, [conversations]);

  // Filtered participants for mention popover
  const filteredParticipants = useMemo(() => {
    if (!mentionFilter) return allParticipants;
    const lower = mentionFilter.toLowerCase();
    return allParticipants.filter(p =>
      p.name.toLowerCase().includes(lower) || p.email.toLowerCase().includes(lower)
    );
  }, [allParticipants, mentionFilter]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest(`/api/sessions/${sessionId}/chat`, {
        method: 'POST',
        body: JSON.stringify({ message: content }),
      });
      return response;
    },
    onMutate: () => setIsTyping(true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'chat'] });
      setMessage("");
      setIsTyping(false);
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    },
    onError: () => setIsTyping(false),
  });

  // Send draft email mutation
  const sendDraftMutation = useMutation({
    mutationFn: async (params: { conversationId: string; subject: string; body: string }) => {
      const response = await apiRequest(`/api/sessions/${sessionId}/chat/send`, {
        method: 'POST',
        body: JSON.stringify(params),
      });
      return response;
    },
    onSuccess: (_data, variables) => {
      setSentDrafts(prev => new Set(prev).add(variables.conversationId + variables.body.slice(0, 50)));
      setSendingDraft(null);
      toast({ title: "Email sent", description: "The draft has been sent to the conversation." });
      // Refresh conversations/emails
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'conversations'] });
    },
    onError: (error: any) => {
      setSendingDraft(null);
      toast({ title: "Send failed", description: error?.message || "Failed to send the draft email.", variant: "destructive" });
    },
  });

  const handleSendMessage = () => {
    if (message.trim() && !sendMessageMutation.isPending) {
      setShowMentionPopover(false);
      sendMessageMutation.mutate(message.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionPopover) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentionPopover(false);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredParticipants.length > 0) {
          insertMention(filteredParticipants[0]);
        }
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setMessage(value);

    // Auto-grow textarea
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    // Detect @-mention trigger
    const textBeforeCursor = value.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    if (atIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(atIndex + 1);
      // Only show popover if @ is at start or preceded by whitespace, and no space in the filter yet
      const charBeforeAt = atIndex > 0 ? value[atIndex - 1] : ' ';
      if ((charBeforeAt === ' ' || charBeforeAt === '\n' || atIndex === 0) && !textAfterAt.includes(' ')) {
        setShowMentionPopover(true);
        setMentionFilter(textAfterAt);
        setMentionCursorPos(atIndex);
        return;
      }
    }
    setShowMentionPopover(false);
  };

  const insertMention = useCallback((participant: { name: string; email: string }) => {
    const before = message.slice(0, mentionCursorPos);
    const afterCursor = message.slice(textareaRef.current?.selectionStart || message.length);
    const mention = `@${participant.name} (${participant.email})`;
    const newMessage = before + mention + ' ' + afterCursor;
    setMessage(newMessage);
    setShowMentionPopover(false);
    setMentionFilter("");
    // Focus textarea
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = before.length + mention.length + 1;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  }, [message, mentionCursorPos]);

  const copyToClipboard = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
      toast({ title: "Copied to clipboard", description: "AI response has been copied to your clipboard." });
    } catch (err) {
      toast({ title: "Copy failed", description: "Unable to copy to clipboard.", variant: "destructive" });
    }
  };

  const handleSendDraft = (msgContent: string, draft: { conversationId: string; subject: string }) => {
    const body = extractDraftBody(msgContent);
    if (!body) {
      toast({ title: "No draft content", description: "Could not extract draft body from the message.", variant: "destructive" });
      return;
    }
    const draftKey = draft.conversationId + body.slice(0, 50);
    setSendingDraft(draftKey);
    sendDraftMutation.mutate({ conversationId: draft.conversationId, subject: draft.subject, body });
  };

  // Get conversation name by ID
  const getConversationName = useCallback((convId: string) => {
    const conv = conversations.find((c: ConversationWithParticipants) => c.id === convId);
    return conv?.name || 'conversation';
  }, [conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Close mention popover on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (mentionPopoverRef.current && !mentionPopoverRef.current.contains(e.target as Node)) {
        setShowMentionPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-2">
          {isLoading ? (
            <div className="text-xs text-gray-500 text-center py-8">
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="text-xs text-gray-500 text-center py-8">
              Ask me anything about this session's data!
            </div>
          ) : (
            messages.map((msg: ChatMessage) => {
              const draftMarker = msg.role === 'assistant' ? parseDraftMarker(msg.content) : null;
              const draftKey = draftMarker ? draftMarker.conversationId + extractDraftBody(msg.content).slice(0, 50) : '';
              const isDraftSent = draftMarker ? sentDrafts.has(draftKey) : false;
              const isDraftSending = draftMarker ? sendingDraft === draftKey : false;

              return (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex-shrink-0 w-6 h-6 bg-[#4F63A4] rounded-full flex items-center justify-center mt-1">
                      <Bot className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <div className="flex flex-col max-w-[85%]">
                    <div
                      className={`px-3 py-2 rounded-lg text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-[#4F63A4] text-white'
                          : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="prose-sm max-w-none">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={markdownComponents}
                          >
                            {msg.content.replace(/<!-- DRAFT_EMAIL[^>]*-->/g, '')}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                    {/* Draft send button */}
                    {draftMarker && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className={`h-7 text-xs gap-1.5 ${
                            isDraftSent
                              ? 'border-green-300 text-green-700 bg-green-50 hover:bg-green-50'
                              : 'border-[#4F63A4]/30 text-[#4F63A4] hover:bg-[#4F63A4]/10'
                          }`}
                          onClick={() => !isDraftSent && !isDraftSending && handleSendDraft(msg.content, draftMarker)}
                          disabled={isDraftSent || isDraftSending}
                        >
                          {isDraftSending ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Sending...
                            </>
                          ) : isDraftSent ? (
                            <>
                              <Check className="h-3 w-3" />
                              Sent
                            </>
                          ) : (
                            <>
                              <Mail className="h-3 w-3" />
                              Send to {getConversationName(draftMarker.conversationId)}
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                    {/* Copy button */}
                    {msg.role === 'assistant' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1 h-6 w-6 p-0 self-end hover:bg-gray-200"
                        onClick={() => copyToClipboard(msg.content, msg.id)}
                      >
                        {copiedMessageId === msg.id ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3 text-gray-500" />
                        )}
                      </Button>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="flex-shrink-0 w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center mt-1">
                      <User className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>
              );
            })
          )}

          {isTyping && (
            <div className="flex gap-2 justify-start">
              <div className="flex-shrink-0 w-6 h-6 bg-[#4F63A4] rounded-full flex items-center justify-center">
                <Bot className="h-3 w-3 text-white" />
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2 py-1.5 rounded-lg text-xs">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="border-t p-3 relative">
        {/* @-Mention popover */}
        {showMentionPopover && filteredParticipants.length > 0 && (
          <div
            ref={mentionPopoverRef}
            className="absolute bottom-full left-3 right-3 mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50"
          >
            <div className="py-1">
              {filteredParticipants.map((p, idx) => (
                <button
                  key={p.email}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${
                    idx === 0 ? 'bg-gray-50 dark:bg-gray-750' : ''
                  }`}
                  onClick={() => insertMention(p)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{p.name}</span>
                      {p.isOriginator && (
                        <span className="flex-shrink-0 text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded">
                          Originator
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate block">{p.email}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about data, draft messages with @mentions..."
            className="flex-1 text-sm min-h-[40px] max-h-[120px] resize-none rounded-md border border-input bg-background px-3 py-2 ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            rows={1}
            disabled={sendMessageMutation.isPending}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || sendMessageMutation.isPending}
            size="sm"
            className="bg-[#4F63A4] hover:bg-[#3d4f85] text-white h-10 px-4 flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
