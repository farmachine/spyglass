import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, X, Minimize2, Maximize2, Bot, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import type { ChatMessage, FieldValidation, ExtractionSession } from "@shared/schema";

interface SessionChatProps {
  sessionId: string;
  session: ExtractionSession;
  validations: FieldValidation[];
}

interface ChatResponse {
  message: string;
}

export default function SessionChat({ sessionId, session, validations }: SessionChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch chat messages
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['/api/sessions', sessionId, 'chat'],
    enabled: isOpen,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest(`/api/sessions/${sessionId}/chat`, {
        method: 'POST',
        body: JSON.stringify({
          message: content,
        }),
      });
      return response;
    },
    onMutate: () => {
      setIsTyping(true);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'chat'] });
      setMessage("");
      setIsTyping(false);
    },
    onError: () => {
      setIsTyping(false);
    },
  });

  const handleSendMessage = () => {
    if (message.trim() && !sendMessageMutation.isPending) {
      sendMessageMutation.mutate(message.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          className="bg-[#4F63A4] hover:bg-[#3d4f85] text-white rounded-full p-3 shadow-lg"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Card 
        className={`w-96 shadow-lg border-[#4F63A4]/20 ${
          isMinimized ? 'h-auto' : 'h-[500px]'
        }`}
      >
        <CardHeader className="p-3 pb-2 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bot className="h-4 w-4 text-[#4F63A4]" />
              Session Assistant
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-gray-100"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-gray-100"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {!isMinimized && (
          <CardContent className="p-0 flex flex-col h-[440px]">
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
                  messages.map((msg: ChatMessage) => (
                    <div
                      key={msg.id}
                      className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="flex-shrink-0 w-6 h-6 bg-[#4F63A4] rounded-full flex items-center justify-center">
                          <Bot className="h-3 w-3 text-white" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] px-3 py-2 rounded-lg text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-[#4F63A4] text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        {msg.content}
                      </div>
                      {msg.role === 'user' && (
                        <div className="flex-shrink-0 w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center">
                          <User className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                  ))
                )}
                
                {isTyping && (
                  <div className="flex gap-2 justify-start">
                    <div className="flex-shrink-0 w-6 h-6 bg-[#4F63A4] rounded-full flex items-center justify-center">
                      <Bot className="h-3 w-3 text-white" />
                    </div>
                    <div className="bg-gray-100 text-gray-900 px-2 py-1.5 rounded-lg text-xs">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="border-t p-3">
              <div className="flex gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about this session's data..."
                  className="flex-1 text-sm h-10"
                  disabled={sendMessageMutation.isPending}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!message.trim() || sendMessageMutation.isPending}
                  size="sm"
                  className="bg-[#4F63A4] hover:bg-[#3d4f85] text-white h-10 px-4"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}