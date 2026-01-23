import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Loader2
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

interface KanbanBoardProps {
  sessionId: string;
  stepId: string;
  statusColumns: string[];
  onGenerateTasks?: () => void;
  isGenerating?: boolean;
}

export function KanbanBoard({ 
  sessionId, 
  stepId, 
  statusColumns,
  onGenerateTasks,
  isGenerating = false 
}: KanbanBoardProps) {
  const { toast } = useToast();
  const [draggedCard, setDraggedCard] = useState<string | null>(null);
  const [isAddingCard, setIsAddingCard] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [selectedCard, setSelectedCard] = useState<KanbanCardType | null>(null);
  const [isCardDialogOpen, setIsCardDialogOpen] = useState(false);

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
            onClick={onGenerateTasks}
            disabled={isGenerating}
            className="bg-[#4F63A4] hover:bg-[#3d4f80]"
          >
            {isGenerating ? (
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
    </div>
  );
}
