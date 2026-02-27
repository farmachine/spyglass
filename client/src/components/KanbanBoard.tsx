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
  ClipboardList,
  Sparkles,
  X,
  Loader2,
  FileText,
  Send,
  Trash2,
  Check,
  ChevronDown,
  ExternalLink
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
import type { KanbanCard as KanbanCardType, User as UserType, KanbanComment, KanbanChecklistItem, KanbanAttachment, StepValue } from "@shared/schema";

// Helper to render description with bold field names
function formatDescriptionWithBoldFields(text: string): JSX.Element[] {
  const lines = text.split('\n');
  return lines.map((line, idx) => {
    // Match pattern "FieldName: value" or "--- Section ---"
    const fieldMatch = line.match(/^([^:]+):\s*(.*)$/);
    const sectionMatch = line.match(/^---\s*(.+?)\s*---$/);
    
    if (sectionMatch) {
      return (
        <div key={idx} className="font-semibold text-gray-600 dark:text-gray-400 mt-2 mb-1">
          --- {sectionMatch[1]} ---
        </div>
      );
    } else if (fieldMatch) {
      return (
        <div key={idx}>
          <span className="font-semibold text-gray-700 dark:text-gray-300">{fieldMatch[1]}:</span>
          <span className="text-gray-600 dark:text-gray-400"> {fieldMatch[2]}</span>
        </div>
      );
    }
    return <div key={idx}>{line || '\u00A0'}</div>;
  });
}

interface SessionDocument {
  id: string;
  fileName: string;
  fileType?: string;
}

interface KanbanAction {
  name: string;
  applicableStatuses: string[];
  link: string;
}

// Color palette for kanban columns - matches WorkflowBuilder
const KANBAN_COLUMN_COLORS = [
  '#4F63A4', // Primary purple
  '#5B8DBD', // Blue
  '#4F9A94', // Teal
  '#5EA47B', // Green
  '#C4A35A', // Gold
  '#C47B5A', // Orange
  '#A45B73', // Rose
];

interface KanbanBoardProps {
  sessionId: string;
  stepId: string;
  statusColumns: string[];
  columnColors?: string[];
  sessionDocuments?: SessionDocument[];
  isLoadingDocuments?: boolean;
  aiInstructions?: string;
  knowledgeDocumentIds?: string[];
  onGenerateTasks?: (selectedDocumentIds: string[]) => Promise<void>;
  isGenerating?: boolean;
  organizationId?: string;
  currentUserId?: string;
  stepValues?: StepValue[];
  actions?: KanbanAction[];
}

export function KanbanBoard({ 
  sessionId, 
  stepId, 
  statusColumns,
  columnColors = [],
  sessionDocuments = [],
  isLoadingDocuments = false,
  aiInstructions,
  knowledgeDocumentIds,
  onGenerateTasks,
  isGenerating = false,
  organizationId,
  currentUserId,
  stepValues = [],
  actions = []
}: KanbanBoardProps) {
  // Helper to get column color by status name
  const getColumnColor = (status: string): string => {
    const colIndex = statusColumns.indexOf(status);
    if (colIndex >= 0 && columnColors[colIndex]) {
      return columnColors[colIndex];
    }
    return KANBAN_COLUMN_COLORS[colIndex >= 0 ? colIndex % KANBAN_COLUMN_COLORS.length : 0];
  };
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
  const [cardFieldValues, setCardFieldValues] = useState<Record<string, string>>({});
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);

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

  // Fetch attachments for selected card
  const { data: attachments = [], isLoading: attachmentsLoading } = useQuery<KanbanAttachment[]>({
    queryKey: [`/api/kanban-cards/${selectedCard?.id}/attachments`],
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

  // Attachment mutations
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedCard?.id) return;

    setIsUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (currentUserId) {
        formData.append('uploadedBy', currentUserId);
      }

      const response = await fetch(`/api/kanban-cards/${selectedCard.id}/attachments`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      queryClient.invalidateQueries({ queryKey: [`/api/kanban-cards/${selectedCard.id}/attachments`] });
      toast({
        title: "Attachment uploaded",
        description: file.name
      });
    } catch (error) {
      console.error('Failed to upload attachment:', error);
      toast({
        title: "Upload failed",
        description: "Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploadingAttachment(false);
      event.target.value = '';
    }
  };

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      return apiRequest(`/api/kanban-attachments/${attachmentId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/kanban-cards/${selectedCard?.id}/attachments`] });
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
    // Load existing field values from the card
    const existingFieldValues = (card.fieldValues as Record<string, string>) || {};
    setCardFieldValues(existingFieldValues);
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
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header with AI Generate button */}
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
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
                Generating tasks...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Tasks
              </>
            )}
          </Button>
        )}
      </div>

      {/* Kanban Columns - Each scrolls independently */}
      <div className="flex-1 grid gap-4 min-h-0" style={{ gridTemplateColumns: `repeat(${statusColumns.length}, minmax(280px, 1fr))` }}>
        {statusColumns.map((status) => {
          const columnCards = getColumnCards(status);
          
          return (
            <div
              key={status}
              className="bg-gray-100 dark:bg-gray-800 rounded-lg flex flex-col min-h-0 max-h-full"
            >
              {/* Fixed Column Header */}
              <div className="flex-shrink-0 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    {status}
                    <Badge className="text-xs bg-[#4F63A4] text-white hover:bg-[#3d4f80]">
                      {columnCards.length}
                    </Badge>
                  </h3>
                </div>
              </div>

              {/* Scrollable Cards Area */}
              <div
                className="flex-1 overflow-y-auto p-3 min-h-0 scrollbar-hide"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, status)}
              >
                <div className="space-y-2 min-h-[100px]">
                {columnCards.map((card) => {
                  const cardAssigneeIds = (card.assigneeIds as string[]) || [];
                  const cardColor = getColumnColor(status);
                  return (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={() => handleDragStart(card.id)}
                      onClick={() => openCardDetail(card)}
                      className={`bg-white dark:bg-gray-700 rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow border-l-4 ${
                        draggedCard === card.id ? 'opacity-50' : ''
                      }`}
                      style={{ borderLeftColor: cardColor }}
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
                          
                          {/* Card footer with assignees */}
                          <div className="flex items-center justify-end mt-2">
                            
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
          </div>
          );
        })}
      </div>

      {/* Card Detail Dialog - Trello-like Workspace */}
      <Dialog open={isCardDialogOpen} onOpenChange={(open) => { setIsCardDialogOpen(open); if (!open) setIsEditingDescription(false); }}>
        <DialogContent className="max-w-6xl w-[98vw] h-[92vh] overflow-hidden flex flex-col p-0">
          {/* Card Header */}
          <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-10 py-6">
            <div className="flex items-center gap-4">
              <div className="bg-[#4F63A4]/10 dark:bg-[#4F63A4]/20 rounded-xl p-3 flex-shrink-0">
                <ClipboardList className="h-6 w-6 text-[#4F63A4] dark:text-[#8B9CD6]" />
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={selectedCard?.title || ''}
                  onChange={(e) => selectedCard && setSelectedCard({ ...selectedCard, title: e.target.value })}
                  className="w-full font-bold border-0 p-0 h-auto outline-none bg-transparent text-[#3A4A7C] dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 tracking-tight"
                  placeholder="Task title"
                  style={{ fontSize: '1.5rem', lineHeight: '1.3' }}
                  tabIndex={-1}
                  onFocus={(e) => {
                    const input = e.target;
                    setTimeout(() => {
                      input.selectionStart = input.selectionEnd = input.value.length;
                    }, 0);
                  }}
                />
              </div>
            </div>
          </div>
          
          {selectedCard && (
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="grid grid-cols-4 gap-6 p-6">
                  {/* Main Content - Left 3 columns */}
                  <div className="col-span-3 space-y-5">
                    {/* Description Section */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-semibold flex items-center gap-2 text-gray-700 dark:text-gray-300">
                          <div className="bg-[#4F63A4]/10 rounded-lg p-1.5">
                            <FileText className="h-4 w-4 text-[#4F63A4]" />
                          </div>
                          Description
                        </label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsEditingDescription(!isEditingDescription)}
                          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          {isEditingDescription ? 'Done' : 'Edit'}
                        </Button>
                      </div>
                      {isEditingDescription ? (
                        <Textarea
                          value={selectedCard.description || ''}
                          onChange={(e) => setSelectedCard({ ...selectedCard, description: e.target.value })}
                          rows={5}
                          placeholder="Add a more detailed description..."
                          className="resize-y min-h-[120px] bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-600"
                          autoFocus
                        />
                      ) : (
                        <div 
                          className="min-h-[120px] p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-md text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          onClick={() => setIsEditingDescription(true)}
                        >
                          {selectedCard.description ? (
                            <div className="space-y-0.5">
                              {formatDescriptionWithBoldFields(selectedCard.description)}
                            </div>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500 italic">Click to add a description...</span>
                          )}
                        </div>
                      )}
                      
                      {/* Step Value Fields - Inside description container */}
                      {stepValues.length > 0 && (
                        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                          {stepValues.map((value) => (
                            <div key={value.id} className="space-y-1.5">
                              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block">
                                {value.valueName}
                              </label>
                              {value.dataType === 'TEXT' || !value.dataType ? (
                                <Input
                                  value={cardFieldValues[value.id] || ''}
                                  onChange={(e) => setCardFieldValues(prev => ({ ...prev, [value.id]: e.target.value }))}
                                  placeholder={value.valueName}
                                  className="h-9 text-sm bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-600"
                                />
                              ) : value.dataType === 'NUMBER' ? (
                                <Input
                                  type="number"
                                  value={cardFieldValues[value.id] || ''}
                                  onChange={(e) => setCardFieldValues(prev => ({ ...prev, [value.id]: e.target.value }))}
                                  placeholder={value.valueName}
                                  className="h-9 text-sm bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-600"
                                />
                              ) : value.dataType === 'DATE' ? (
                                <Input
                                  type="date"
                                  value={cardFieldValues[value.id] || ''}
                                  onChange={(e) => setCardFieldValues(prev => ({ ...prev, [value.id]: e.target.value }))}
                                  className="h-9 text-sm bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-600"
                                />
                              ) : value.dataType === 'CHOICE' && value.choiceOptions ? (
                                <select
                                  value={cardFieldValues[value.id] || ''}
                                  onChange={(e) => setCardFieldValues(prev => ({ ...prev, [value.id]: e.target.value }))}
                                  className="w-full h-9 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 text-sm focus:ring-2 focus:ring-[#4F63A4] focus:border-transparent"
                                >
                                  <option value="">Select...</option>
                                  {(value.choiceOptions as string[]).map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                  ))}
                                </select>
                              ) : (
                                <Input
                                  value={cardFieldValues[value.id] || ''}
                                  onChange={(e) => setCardFieldValues(prev => ({ ...prev, [value.id]: e.target.value }))}
                                  placeholder={value.valueName}
                                  className="h-9 text-sm bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-600"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Checklist */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-semibold flex items-center gap-2 text-gray-700 dark:text-gray-300">
                          <div className="bg-[#4F63A4]/10 rounded-lg p-1.5">
                            <CheckSquare className="h-4 w-4 text-[#4F63A4]" />
                          </div>
                          Checklist
                        </label>
                        {checklistItems.length > 0 && (
                          <span className="text-xs font-medium text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                            {checklistItems.filter(i => i.isCompleted).length}/{checklistItems.length}
                          </span>
                        )}
                      </div>
                      
                      {/* Progress bar */}
                      {checklistItems.length > 0 && (
                        <div className="mb-3">
                          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500 transition-all duration-300 rounded-full"
                              style={{ width: `${(checklistItems.filter(i => i.isCompleted).length / checklistItems.length) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                      
                      {checklistLoading ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {checklistItems.map((item) => (
                            <div key={item.id} className="flex items-center gap-3 group p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors">
                              <Checkbox
                                checked={item.isCompleted}
                                onCheckedChange={(checked) => {
                                  toggleChecklistItemMutation.mutate({
                                    itemId: item.id,
                                    isCompleted: !!checked
                                  });
                                }}
                                className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                              />
                              <span className={`flex-1 text-sm ${item.isCompleted ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                {item.title}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                                onClick={() => deleteChecklistItemMutation.mutate(item.id)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                          
                          {/* Add checklist item */}
                          <div className="flex gap-2 mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                            <Input
                              value={newChecklistItem}
                              onChange={(e) => setNewChecklistItem(e.target.value)}
                              placeholder="Add an item..."
                              className="h-9 text-sm bg-white dark:bg-gray-900"
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
                              className="h-9 bg-[#4F63A4] hover:bg-[#3D4E85]"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Attachments */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                      <label className="text-sm font-semibold flex items-center gap-2 mb-3 text-gray-700 dark:text-gray-300">
                        <div className="bg-[#4F63A4]/10 rounded-lg p-1.5">
                          <Paperclip className="h-4 w-4 text-[#4F63A4]" />
                        </div>
                        Attachments
                        {attachments.length > 0 && (
                          <Badge variant="secondary" className="text-xs ml-auto">{attachments.length}</Badge>
                        )}
                      </label>
                      
                      {attachmentsLoading ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {attachments.map((attachment) => (
                            <div key={attachment.id} className="flex items-center gap-3 group p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors">
                              <div className="bg-[#4F63A4]/10 rounded-lg p-2">
                                <FileText className="h-4 w-4 text-[#4F63A4]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <a
                                  href={attachment.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-[#4F63A4] truncate block"
                                >
                                  {attachment.fileName}
                                </a>
                                {attachment.fileSize && (
                                  <span className="text-xs text-gray-400">
                                    {(attachment.fileSize / 1024).toFixed(1)} KB
                                  </span>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                                onClick={() => deleteAttachmentMutation.mutate(attachment.id)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                          
                          {/* Upload button */}
                          <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors">
                              <input
                                type="file"
                                className="hidden"
                                onChange={handleFileUpload}
                                disabled={isUploadingAttachment}
                              />
                              {isUploadingAttachment ? (
                                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                              ) : (
                                <Plus className="h-4 w-4 text-gray-400" />
                              )}
                              <span className="text-sm text-gray-500">
                                {isUploadingAttachment ? 'Uploading...' : 'Add attachment'}
                              </span>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Comments/Chat */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                      <label className="text-sm font-semibold flex items-center gap-2 mb-3 text-gray-700 dark:text-gray-300">
                        <div className="bg-blue-500/10 rounded-lg p-1.5">
                          <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        Discussion
                        {comments.length > 0 && (
                          <Badge variant="secondary" className="text-xs ml-auto">{comments.length}</Badge>
                        )}
                      </label>
                      
                      {/* Comment input */}
                      <div className="flex gap-3 mb-4 p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
                        <Avatar className="h-9 w-9 ring-2 ring-[#4F63A4]/20">
                          <AvatarFallback className="bg-[#4F63A4] text-white text-xs font-medium">
                            {currentUserId ? getInitials(getUserById(currentUserId)) : 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 flex gap-2">
                          <Input
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder={currentUserId ? "Write a comment..." : "Sign in to comment"}
                            className="flex-1 border-0 bg-transparent focus-visible:ring-0 px-0"
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
                            className="bg-[#4F63A4] hover:bg-[#3D4E85] h-9 px-3"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Comments list */}
                      {commentsLoading ? (
                        <div className="flex justify-center py-6">
                          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                        </div>
                      ) : comments.length === 0 ? (
                        <div className="text-center py-6">
                          <MessageSquare className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                          <p className="text-sm text-gray-400">No comments yet. Start the conversation!</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                          {comments.map((comment) => {
                            const commentUser = getUserById(comment.userId);
                            return (
                              <div key={comment.id} className="flex gap-3 group p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors">
                                <Avatar className="h-8 w-8 flex-shrink-0">
                                  <AvatarFallback className="bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-medium">
                                    {getInitials(commentUser)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                      {getUserDisplayName(commentUser)}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                      {new Date(comment.createdAt).toLocaleDateString()}
                                    </span>
                                    {comment.userId === currentUserId && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="opacity-0 group-hover:opacity-100 h-5 w-5 p-0 ml-auto text-gray-400 hover:text-red-500"
                                        onClick={() => deleteCommentMutation.mutate(comment.id)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600 dark:text-gray-300 break-words leading-relaxed">
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
                  <div className="space-y-4 sticky top-0">
                    {/* Status Card */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">Status</label>
                      <select
                        value={selectedCard.status}
                        onChange={(e) => setSelectedCard({ ...selectedCard, status: e.target.value })}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-[#4F63A4] focus:border-transparent transition-all"
                      >
                        {statusColumns.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>

                    {/* Assignees Card */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">Assignees</label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full justify-between h-10 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-600">
                            <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                              <Users className="h-4 w-4 text-[#4F63A4]" />
                              {cardAssignees.length > 0 
                                ? `${cardAssignees.length} assigned`
                                : 'Assign members'
                              }
                            </span>
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56">
                          {users.length === 0 ? (
                            <div className="p-3 text-sm text-gray-500 text-center">
                              No team members found
                            </div>
                          ) : (
                            users.map((user) => (
                              <DropdownMenuCheckboxItem
                                key={user.id}
                                checked={cardAssignees.includes(user.id)}
                                onCheckedChange={() => handleAssigneeToggle(user.id)}
                                className="py-2"
                              >
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6 ring-2 ring-[#4F63A4]/20">
                                    <AvatarFallback className="text-xs bg-[#4F63A4] text-white font-medium">
                                      {getInitials(user)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="font-medium">{getUserDisplayName(user)}</span>
                                </div>
                              </DropdownMenuCheckboxItem>
                            ))
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      
                      {/* Show assigned avatars */}
                      {cardAssignees.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {cardAssignees.map((userId) => {
                            const user = getUserById(userId);
                            return (
                              <div key={userId} className="flex items-center gap-1.5 bg-white dark:bg-gray-700 rounded-full pl-1 pr-2 py-1 border border-gray-200 dark:border-gray-600 shadow-sm">
                                <Avatar className="h-5 w-5">
                                  <AvatarFallback className="text-[10px] bg-[#4F63A4] text-white font-medium">
                                    {getInitials(user)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{getUserDisplayName(user)}</span>
                                <button
                                  onClick={() => handleAssigneeToggle(userId)}
                                  className="text-gray-400 hover:text-red-500 transition-colors ml-0.5"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Actions Card */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">Actions</label>
                      <div className="space-y-2">
                        {/* Configured action buttons - only show for applicable statuses */}
                        {actions.filter(action => 
                          action.name && 
                          action.link && 
                          selectedCard && 
                          (action.applicableStatuses?.length === 0 || action.applicableStatuses?.includes(selectedCard.status))
                        ).map((action, index) => {
                          const processedLink = action.link.replace(/\{\{task_name\}\}/g, encodeURIComponent(selectedCard?.title || ''));
                          return (
                            <Button
                              key={index}
                              variant="outline"
                              size="sm"
                              className="w-full justify-start h-10 text-[#4F63A4] hover:text-[#3d4f80] hover:bg-[#4F63A4]/10 border-[#4F63A4]/30"
                              onClick={() => window.open(processedLink, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              {action.name}
                            </Button>
                          );
                        })}
                        {/* Delete button */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start h-10 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800/50"
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
                </div>
              </ScrollArea>
            </div>
          )}

          <DialogFooter className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
            <Button variant="outline" onClick={() => setIsCardDialogOpen(false)} className="px-5">
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
                      assigneeIds: cardAssignees,
                      fieldValues: cardFieldValues
                    }
                  });
                  setIsCardDialogOpen(false);
                }
              }}
              disabled={updateCardMutation.isPending}
              className="bg-[#4F63A4] hover:bg-[#3d4f80] px-6 shadow-sm"
            >
              {updateCardMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                'Save Changes'
              )}
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
              Generate Tasks
            </DialogTitle>
            <DialogDescription>
              Select the documents to analyze and generate tasks from.
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
