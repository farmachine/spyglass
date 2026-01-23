import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Plus, 
  MoreVertical, 
  MessageSquare, 
  CheckSquare, 
  Paperclip,
  GripVertical,
  User,
  Users,
  Sparkles,
  X,
  Loader2,
  FileText,
  Send,
  Trash2,
  Check,
  ChevronDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { KanbanCard as KanbanCardType, User as UserType, KanbanComment, KanbanChecklistItem } from "@shared/schema";

interface SessionDocument {
  id: string;
  fileName: string;
  fileType?: string;
}

interface KanbanBoardProps {
  sessionId: string;
  stepId: string;
  statusColumns: string[];
  sessionDocuments?: SessionDocument[];
  isLoadingDocuments?: boolean;
  aiInstructions?: string;
  knowledgeDocumentIds?: string[];
  onGenerateTasks?: (selectedDocumentIds: string[]) => Promise<void>;
  isGenerating?: boolean;
  organizationId?: string;
  currentUserId?: string;
}

export function KanbanBoard({ 
  sessionId, 
  stepId, 
  statusColumns,
  sessionDocuments = [],
  isLoadingDocuments = false,
  aiInstructions,
  knowledgeDocumentIds,
  onGenerateTasks,
  isGenerating = false,
  organizationId,
  currentUserId
}: KanbanBoardProps) {
  const { toast } = useToast();
  const [draggedCard, setDraggedCard] = useState<string | null>(null);
  const [isAddingCard, setIsAddingCard] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [selectedCard, setSelectedCard] = useState<KanbanCardType | null>(null);
  const [isCardDialogOpen, setIsCardDialogOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [localIsGenerating, setLocalIsGenerating] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [cardAssignees, setCardAssignees] = useState<string[]>([]);

  // Fetch organization users for assignee dropdown and card avatars
  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: [`/api/users/${organizationId}`],
    enabled: !!organizationId
  });

  // Fetch comments for selected card
  const { data: comments = [], isLoading: commentsLoading } = useQuery<KanbanComment[]>({
    queryKey: [`/api/kanban-cards/${selectedCard?.id}/comments`],
    enabled: !!selectedCard?.id && isCardDialogOpen
  });

  // Fetch checklist items for selected card
  const { data: checklistItems = [], isLoading: checklistLoading } = useQuery<KanbanChecklistItem[]>({
    queryKey: [`/api/kanban-cards/${selectedCard?.id}/checklist`],
    enabled: !!selectedCard?.id && isCardDialogOpen
  });

  // Update cardAssignees when selectedCard changes
  useEffect(() => {
    if (selectedCard) {
      const assignees = (selectedCard.assigneeIds as string[]) || [];
      setCardAssignees(assignees);
    }
  }, [selectedCard]);

  // Comment mutations
  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!currentUserId) {
        throw new Error('User not authenticated');
      }
      return apiRequest(`/api/kanban-cards/${selectedCard?.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content, userId: currentUserId })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/kanban-cards/${selectedCard?.id}/comments`] });
      setNewComment('');
    },
    onError: () => {
      toast({
        title: "Failed to add comment",
        description: "Please try again.",
        variant: "destructive"
      });
    }
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      return apiRequest(`/api/kanban-comments/${commentId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/kanban-cards/${selectedCard?.id}/comments`] });
    }
  });

  // Checklist mutations
  const addChecklistItemMutation = useMutation({
    mutationFn: async (title: string) => {
      return apiRequest(`/api/kanban-cards/${selectedCard?.id}/checklist`, {
        method: 'POST',
        body: JSON.stringify({ title })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/kanban-cards/${selectedCard?.id}/checklist`] });
      setNewChecklistItem('');
    }
  });

  const toggleChecklistItemMutation = useMutation({
    mutationFn: async ({ itemId, isCompleted }: { itemId: string; isCompleted: boolean }) => {
      return apiRequest(`/api/kanban-checklist/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isCompleted })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/kanban-cards/${selectedCard?.id}/checklist`] });
    }
  });

  const deleteChecklistItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return apiRequest(`/api/kanban-checklist/${itemId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/kanban-cards/${selectedCard?.id}/checklist`] });
    }
  });

  // Update card assignees
  const updateAssigneesMutation = useMutation({
    mutationFn: async (assigneeIds: string[]) => {
      return apiRequest(`/api/kanban-cards/${selectedCard?.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ assigneeIds })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/steps/${stepId}/kanban-cards`] });
    }
  });

  const handleAssigneeToggle = (userId: string) => {
    const newAssignees = cardAssignees.includes(userId)
      ? cardAssignees.filter(id => id !== userId)
      : [...cardAssignees, userId];
    setCardAssignees(newAssignees);
    updateAssigneesMutation.mutate(newAssignees);
  };

  const getUserById = (userId: string) => users.find(u => u.id === userId);
  const getInitials = (user: UserType | undefined) => {
    if (!user) return '?';
    if (user.name) {
      const parts = user.name.split(' ');
      return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
    }
    return user.email?.[0]?.toUpperCase() || '?';
  };
  const getUserDisplayName = (user: UserType | undefined) => {
    if (!user) return 'Unknown';
    return user.name || user.email || 'Unknown';
  };

  const { data: cards = [], isLoading } = useQuery<KanbanCardType[]>({
    queryKey: [`/api/sessions/${sessionId}/steps/${stepId}/kanban-cards`]
  });

  const createCardMutation = useMutation({
    mutationFn: async (data: { title: string; status: string }) => {
      return apiRequest(`/api/sessions/${sessionId}/steps/${stepId}/kanban-cards`, {
        method: 'POST',
        body: JSON.stringify({
          title: data.title,
          status: data.status,
          orderIndex: cards.filter(c => c.status === data.status).length
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/steps/${stepId}/kanban-cards`] });
      setIsAddingCard(null);
      setNewCardTitle('');
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create card', variant: 'destructive' });
    }
  });

  const updateCardMutation = useMutation({
    mutationFn: async ({ cardId, updates }: { cardId: string; updates: Partial<KanbanCardType> }) => {
      return apiRequest(`/api/kanban-cards/${cardId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/steps/${stepId}/kanban-cards`] });
    }
  });

  const deleteCardMutation = useMutation({
    mutationFn: async (cardId: string) => {
      return apiRequest(`/api/kanban-cards/${cardId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/steps/${stepId}/kanban-cards`] });
      setIsCardDialogOpen(false);
      setSelectedCard(null);
    }
  });

  const reorderCardsMutation = useMutation({
    mutationFn: async (reorderedCards: { id: string; orderIndex: number; status?: string }[]) => {
      return apiRequest(`/api/sessions/${sessionId}/steps/${stepId}/kanban-cards/reorder`, {
        method: 'POST',
        body: JSON.stringify({ cards: reorderedCards })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/sessions/${sessionId}/steps/${stepId}/kanban-cards`] });
    }
  });

  const handleDragStart = (cardId: string) => {
    setDraggedCard(cardId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    if (!draggedCard) return;

    const card = cards.find(c => c.id === draggedCard);
    if (!card || card.status === newStatus) {
      setDraggedCard(null);
      return;
    }

    const cardsInNewStatus = cards.filter(c => c.status === newStatus);
    
    reorderCardsMutation.mutate([
      { id: draggedCard, orderIndex: cardsInNewStatus.length, status: newStatus }
    ]);

    setDraggedCard(null);
  };

  const handleAddCard = (status: string) => {
    if (!newCardTitle.trim()) return;
    createCardMutation.mutate({ title: newCardTitle, status });
  };

  const getColumnCards = (status: string) => {
    return cards
      .filter(card => card.status === status)
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  };

  const openCardDetail = (card: KanbanCardType) => {
    setSelectedCard(card);
    setIsCardDialogOpen(true);
  };

  const handleDocumentToggle = (docId: string) => {
    setSelectedDocumentIds(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  const handleOpenGenerateModal = () => {
    setSelectedDocumentIds([]);
    setIsGenerateModalOpen(true);
  };

  const handleGenerate = async () => {
    if (selectedDocumentIds.length === 0) {
      toast({
        title: "No documents selected",
        description: "Please select at least one document to generate tasks from.",
        variant: "destructive"
      });
      return;
    }
    
    if (onGenerateTasks) {
      setLocalIsGenerating(true);
      try {
        await onGenerateTasks(selectedDocumentIds);
        setIsGenerateModalOpen(false);
        toast({
          title: "Tasks generated",
          description: "AI has generated tasks from the selected documents."
        });
      } catch (error) {
        console.error('Error generating tasks:', error);
        toast({
          title: "Generation failed",
          description: "Failed to generate tasks. Please try again.",
          variant: "destructive"
        });
      } finally {
        setLocalIsGenerating(false);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#4F63A4]" />
      </div>
    );
  }

  return (
    <div className="h-full">
      {/* Header with AI Generate button */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {cards.length} task{cards.length !== 1 ? 's' : ''}
        </div>
        {onGenerateTasks && (
          <Button
            onClick={handleOpenGenerateModal}
            disabled={isGenerating || localIsGenerating}
            className="bg-[#4F63A4] hover:bg-[#3d4f80]"
          >
            {(isGenerating || localIsGenerating) ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Tasks with AI
              </>
            )}
          </Button>
        )}
      </div>

      {/* Kanban Columns */}
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '500px' }}>
        {statusColumns.map((status) => {
          const columnCards = getColumnCards(status);
          
          return (
            <div
              key={status}
              className="flex-shrink-0 w-72 bg-gray-100 dark:bg-gray-800 rounded-lg p-3"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, status)}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  {status}
                  <Badge variant="secondary" className="text-xs">
                    {columnCards.length}
                  </Badge>
                </h3>
              </div>

              {/* Cards */}
              <div className="space-y-2 min-h-[100px]">
                {columnCards.map((card) => {
                  const cardAssigneeIds = (card.assigneeIds as string[]) || [];
                  return (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={() => handleDragStart(card.id)}
                      onClick={() => openCardDetail(card)}
                      className={`bg-white dark:bg-gray-700 rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow ${
                        draggedCard === card.id ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0 cursor-grab" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                            {card.title}
                          </p>
                          {card.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                              {card.description}
                            </p>
                          )}
                          
                          {/* Card footer with badges and assignees */}
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-2">
                              {card.aiGenerated && (
                                <div className="flex items-center gap-0.5">
                                  <Sparkles className="h-3 w-3 text-purple-500" />
                                  <span className="text-xs text-purple-500">AI</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Assignee avatars */}
                            {cardAssigneeIds.length > 0 && (
                              <div className="flex -space-x-1">
                                {cardAssigneeIds.slice(0, 3).map((userId) => {
                                  const assigneeUser = getUserById(userId);
                                  return (
                                    <Avatar key={userId} className="h-5 w-5 border-2 border-white dark:border-gray-700">
                                      <AvatarFallback className="text-[8px] bg-[#4F63A4] text-white">
                                        {getInitials(assigneeUser)}
                                      </AvatarFallback>
                                    </Avatar>
                                  );
                                })}
                                {cardAssigneeIds.length > 3 && (
                                  <div className="h-5 w-5 rounded-full bg-gray-200 dark:bg-gray-600 border-2 border-white dark:border-gray-700 flex items-center justify-center">
                                    <span className="text-[8px] text-gray-600 dark:text-gray-300">+{cardAssigneeIds.length - 3}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Add Card Form */}
                {isAddingCard === status ? (
                  <div className="bg-white dark:bg-gray-700 rounded-lg p-3 shadow-sm">
                    <Input
                      value={newCardTitle}
                      onChange={(e) => setNewCardTitle(e.target.value)}
                      placeholder="Enter task title..."
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddCard(status);
                        if (e.key === 'Escape') {
                          setIsAddingCard(null);
                          setNewCardTitle('');
                        }
                      }}
                    />
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        onClick={() => handleAddCard(status)}
                        disabled={!newCardTitle.trim() || createCardMutation.isPending}
                        className="bg-[#4F63A4] hover:bg-[#3d4f80]"
                      >
                        Add
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setIsAddingCard(null);
                          setNewCardTitle('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-gray-500 hover:text-gray-700 dark:text-gray-400"
                    onClick={() => setIsAddingCard(status)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add task
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Card Detail Dialog - Trello-like Workspace */}
      <Dialog open={isCardDialogOpen} onOpenChange={setIsCardDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2">
              {selectedCard?.aiGenerated && (
                <Sparkles className="h-4 w-4 text-purple-500" />
              )}
              <Input
                value={selectedCard?.title || ''}
                onChange={(e) => selectedCard && setSelectedCard({ ...selectedCard, title: e.target.value })}
                className="text-lg font-semibold border-0 p-0 h-auto focus-visible:ring-0 bg-transparent"
                placeholder="Task title"
              />
            </DialogTitle>
          </DialogHeader>
          
          {selectedCard && (
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full pr-4">
                <div className="grid grid-cols-3 gap-6">
                  {/* Main Content - Left 2 columns */}
                  <div className="col-span-2 space-y-6">
                    {/* Description */}
                    <div>
                      <label className="text-sm font-medium flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4" />
                        Description
                      </label>
                      <Textarea
                        value={selectedCard.description || ''}
                        onChange={(e) => setSelectedCard({ ...selectedCard, description: e.target.value })}
                        rows={3}
                        placeholder="Add a more detailed description..."
                        className="resize-none"
                      />
                    </div>

                    {/* AI Reasoning */}
                    {selectedCard.aiReasoning && (
                      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                        <p className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-1 flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          AI Reasoning
                        </p>
                        <p className="text-sm text-purple-600 dark:text-purple-400">
                          {selectedCard.aiReasoning}
                        </p>
                      </div>
                    )}

                    {/* Checklist */}
                    <div>
                      <label className="text-sm font-medium flex items-center gap-2 mb-2">
                        <CheckSquare className="h-4 w-4" />
                        Checklist
                        {checklistItems.length > 0 && (
                          <span className="text-xs text-gray-500">
                            ({checklistItems.filter(i => i.isCompleted).length}/{checklistItems.length})
                          </span>
                        )}
                      </label>
                      
                      {checklistLoading ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {checklistItems.map((item) => (
                            <div key={item.id} className="flex items-center gap-2 group">
                              <Checkbox
                                checked={item.isCompleted}
                                onCheckedChange={(checked) => {
                                  toggleChecklistItemMutation.mutate({
                                    itemId: item.id,
                                    isCompleted: !!checked
                                  });
                                }}
                              />
                              <span className={`flex-1 text-sm ${item.isCompleted ? 'line-through text-gray-400' : ''}`}>
                                {item.title}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                                onClick={() => deleteChecklistItemMutation.mutate(item.id)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                          
                          {/* Add checklist item */}
                          <div className="flex gap-2 mt-2">
                            <Input
                              value={newChecklistItem}
                              onChange={(e) => setNewChecklistItem(e.target.value)}
                              placeholder="Add an item..."
                              className="h-8 text-sm"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && newChecklistItem.trim()) {
                                  addChecklistItemMutation.mutate(newChecklistItem);
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              onClick={() => newChecklistItem.trim() && addChecklistItemMutation.mutate(newChecklistItem)}
                              disabled={!newChecklistItem.trim() || addChecklistItemMutation.isPending}
                              className="h-8"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Comments/Chat */}
                    <div>
                      <label className="text-sm font-medium flex items-center gap-2 mb-3">
                        <MessageSquare className="h-4 w-4" />
                        Discussion
                        {comments.length > 0 && (
                          <Badge variant="secondary" className="text-xs">{comments.length}</Badge>
                        )}
                      </label>
                      
                      {/* Comment input */}
                      <div className="flex gap-2 mb-4">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-[#4F63A4] text-white text-xs">
                            {currentUserId ? getInitials(getUserById(currentUserId)) : 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 flex gap-2">
                          <Input
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder={currentUserId ? "Write a comment..." : "Sign in to comment"}
                            className="flex-1"
                            disabled={!currentUserId}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newComment.trim() && currentUserId) {
                                addCommentMutation.mutate(newComment);
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            onClick={() => newComment.trim() && currentUserId && addCommentMutation.mutate(newComment)}
                            disabled={!newComment.trim() || addCommentMutation.isPending || !currentUserId}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Comments list */}
                      {commentsLoading ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                        </div>
                      ) : comments.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">No comments yet. Start the conversation!</p>
                      ) : (
                        <div className="space-y-3 max-h-48 overflow-y-auto">
                          {comments.map((comment) => {
                            const commentUser = getUserById(comment.userId);
                            return (
                              <div key={comment.id} className="flex gap-2 group">
                                <Avatar className="h-8 w-8 flex-shrink-0">
                                  <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-xs">
                                    {getInitials(commentUser)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">
                                      {getUserDisplayName(commentUser)}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                      {new Date(comment.createdAt).toLocaleDateString()}
                                    </span>
                                    {comment.userId === currentUserId && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="opacity-0 group-hover:opacity-100 h-5 w-5 p-0 ml-auto"
                                        onClick={() => deleteCommentMutation.mutate(comment.id)}
                                      >
                                        <Trash2 className="h-3 w-3 text-gray-400" />
                                      </Button>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600 dark:text-gray-300 break-words">
                                    {comment.content}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sidebar - Right column */}
                  <div className="space-y-4">
                    {/* Status */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Status</label>
                      <select
                        value={selectedCard.status}
                        onChange={(e) => setSelectedCard({ ...selectedCard, status: e.target.value })}
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                      >
                        {statusColumns.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>

                    {/* Assignees */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Assignees</label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full justify-between">
                            <span className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              {cardAssignees.length > 0 
                                ? `${cardAssignees.length} assigned`
                                : 'Assign members'
                              }
                            </span>
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56">
                          {users.length === 0 ? (
                            <div className="p-2 text-sm text-gray-500 text-center">
                              No team members found
                            </div>
                          ) : (
                            users.map((user) => (
                              <DropdownMenuCheckboxItem
                                key={user.id}
                                checked={cardAssignees.includes(user.id)}
                                onCheckedChange={() => handleAssigneeToggle(user.id)}
                              >
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className="text-xs bg-[#4F63A4] text-white">
                                      {getInitials(user)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>{getUserDisplayName(user)}</span>
                                </div>
                              </DropdownMenuCheckboxItem>
                            ))
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      
                      {/* Show assigned avatars */}
                      {cardAssignees.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {cardAssignees.map((userId) => {
                            const user = getUserById(userId);
                            return (
                              <div key={userId} className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-1">
                                <Avatar className="h-5 w-5">
                                  <AvatarFallback className="text-xs bg-[#4F63A4] text-white">
                                    {getInitials(user)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs">{getUserDisplayName(user)}</span>
                                <button
                                  onClick={() => handleAssigneeToggle(userId)}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Actions */}
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => {
                          if (selectedCard) {
                            deleteCardMutation.mutate(selectedCard.id);
                            setIsCardDialogOpen(false);
                          }
                        }}
                        disabled={deleteCardMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Task
                      </Button>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setIsCardDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedCard) {
                  updateCardMutation.mutate({
                    cardId: selectedCard.id,
                    updates: {
                      title: selectedCard.title,
                      description: selectedCard.description,
                      status: selectedCard.status,
                      assigneeIds: cardAssignees
                    }
                  });
                  setIsCardDialogOpen(false);
                }
              }}
              disabled={updateCardMutation.isPending}
              className="bg-[#4F63A4] hover:bg-[#3d4f80]"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Tasks Modal */}
      <Dialog open={isGenerateModalOpen} onOpenChange={setIsGenerateModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#4F63A4]" />
              Generate Tasks with AI
            </DialogTitle>
            <DialogDescription>
              Select the documents you want AI to analyze and generate tasks from.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label className="text-sm font-medium mb-3 block">
              Select Documents ({selectedDocumentIds.length} selected)
            </Label>
            
            {isLoadingDocuments ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-[#4F63A4]" />
              </div>
            ) : sessionDocuments.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No documents available in this session.</p>
                <p className="text-sm">Upload documents first to generate tasks.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3 dark:border-gray-700">
                {sessionDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                    onClick={() => handleDocumentToggle(doc.id)}
                  >
                    <Checkbox
                      checked={selectedDocumentIds.includes(doc.id)}
                      onCheckedChange={() => handleDocumentToggle(doc.id)}
                    />
                    <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    <span className="text-sm truncate">{doc.fileName}</span>
                  </div>
                ))}
              </div>
            )}

            {sessionDocuments.length > 0 && (
              <div className="flex gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDocumentIds(sessionDocuments.map(d => d.id))}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDocumentIds([])}
                >
                  Clear
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsGenerateModalOpen(false)}
              disabled={localIsGenerating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={localIsGenerating || selectedDocumentIds.length === 0}
              className="bg-[#4F63A4] hover:bg-[#3d4f80]"
            >
              {localIsGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Tasks
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
