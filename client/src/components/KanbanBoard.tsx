import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { 
  Plus, 
  MoreVertical, 
  MessageSquare, 
  CheckSquare, 
  Paperclip,
  GripVertical,
  User,
  Sparkles,
  X,
  Loader2,
  FileText
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import type { KanbanCard as KanbanCardType } from "@shared/schema";

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
  isGenerating = false 
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
                {columnCards.map((card) => (
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
                        {card.aiGenerated && (
                          <div className="flex items-center gap-1 mt-2">
                            <Sparkles className="h-3 w-3 text-purple-500" />
                            <span className="text-xs text-purple-500">AI</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

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

      {/* Card Detail Dialog */}
      <Dialog open={isCardDialogOpen} onOpenChange={setIsCardDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedCard?.aiGenerated && (
                <Sparkles className="h-4 w-4 text-purple-500" />
              )}
              Edit Task
            </DialogTitle>
          </DialogHeader>
          
          {selectedCard && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input
                  value={selectedCard.title}
                  onChange={(e) => setSelectedCard({ ...selectedCard, title: e.target.value })}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={selectedCard.description || ''}
                  onChange={(e) => setSelectedCard({ ...selectedCard, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Status</label>
                <select
                  value={selectedCard.status}
                  onChange={(e) => setSelectedCard({ ...selectedCard, status: e.target.value })}
                  className="w-full mt-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                >
                  {statusColumns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              {selectedCard.aiReasoning && (
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                  <p className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">
                    AI Reasoning
                  </p>
                  <p className="text-sm text-purple-600 dark:text-purple-400">
                    {selectedCard.aiReasoning}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <Button
              variant="destructive"
              onClick={() => selectedCard && deleteCardMutation.mutate(selectedCard.id)}
              disabled={deleteCardMutation.isPending}
            >
              Delete
            </Button>
            <div className="flex gap-2">
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
                        status: selectedCard.status
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
            </div>
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
