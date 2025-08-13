import React, { useState, useMemo } from "react";
import { Database, CheckCircle, Clock, ExternalLink, Calendar, AlertCircle, ChevronUp, ChevronDown, ChevronsUpDown, AlertTriangle, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ProjectWithDetails, FieldValidation } from "@shared/schema";

interface AllDataProps {
  project: ProjectWithDetails;
}

type SortField = 'sessionName' | 'documentCount' | 'progress' | 'status' | 'createdAt';
type SortDirection = 'asc' | 'desc';

export default function AllData({ project }: AllDataProps) {
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [, setLocation] = useLocation();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Fetch validation data for all sessions
  const { data: allValidations = [] } = useQuery<FieldValidation[]>({
    queryKey: ['/api/validations/project', project.id],
    queryFn: async () => {
      const validations: FieldValidation[] = [];
      // Filter out null/undefined sessions before iterating
      const validSessions = (project.sessions || []).filter(session => session && session.id);
      for (const session of validSessions) {
        try {
          const response = await fetch(`/api/sessions/${session.id}/validations`);
          if (response.ok) {
            const sessionValidations = await response.json();
            validations.push(...sessionValidations);
          }
        } catch (error) {
          console.error(`Failed to fetch validations for session ${session.id}:`, error);
        }
      }
      return validations;
    },
    enabled: project.sessions.length > 0,
    refetchOnWindowFocus: false,
    staleTime: 0  // Make sure data is always fresh
  });

  // Get verification status for a session
  const getVerificationStatus = (sessionId: string): 'verified' | 'in_progress' | 'pending' => {
    // Safety check for sessionId
    if (!sessionId) return 'pending';
    
    const sessionValidations = allValidations.filter(v => v.sessionId === sessionId);
    if (sessionValidations.length === 0) return 'pending';
    
    const allVerified = sessionValidations.every(v => v.validationStatus === 'valid' || v.validationStatus === 'verified');
    
    // Debug logging
    console.log(`Session ${sessionId} - Validations: ${sessionValidations.length}, All verified: ${allVerified}`);
    console.log(`Session ${sessionId} - Status breakdown:`, sessionValidations.map(v => ({ field: (v as any).fieldName || 'Unknown', status: v.validationStatus })));
    
    return allVerified ? 'verified' : 'in_progress';
  };

  // Calculate verification stats
  const getVerificationStats = () => {
    const stats = { verified: 0, in_progress: 0, pending: 0 };
    
    // Filter out null/undefined sessions before iterating
    const validSessions = (project.sessions || []).filter(session => session && session.id);
    for (const session of validSessions) {
      const status = getVerificationStatus(session.id);
      stats[status]++;
    }
    
    return stats;
  };

  const verificationStats = getVerificationStats();

  // Create new session mutation
  const createSessionMutation = useMutation({
    mutationFn: async (sessionName: string) => {
      return apiRequest(`/api/projects/${project.id}/sessions/create-empty`, {
        method: 'POST',
        body: JSON.stringify({ sessionName })
      });
    },
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', newSession.id] });
      setShowCreateModal(false);
      setSessionName('');
      // Navigate to the new session
      setLocation(`/projects/${project.id}/sessions/${newSession.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create new session",
        variant: "destructive",
      });
    },
  });

  const handleCreateNewSession = () => {
    setShowCreateModal(true);
  };

  const handleSubmitCreate = () => {
    if (!sessionName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a session name",
        variant: "destructive",
      });
      return;
    }
    createSessionMutation.mutate(sessionName.trim());
  };

  const handleCancelCreate = () => {
    setShowCreateModal(false);
    setSessionName('');
  };

  // Get verification progress for a session
  const getSessionProgress = (sessionId: string) => {
    // Safety check for sessionId
    if (!sessionId) return { verified: 0, total: 0, percentage: 0 };
    
    const sessionValidations = allValidations.filter(v => v.sessionId === sessionId);
    if (sessionValidations.length === 0) return { verified: 0, total: 0, percentage: 0 };
    
    const verified = sessionValidations.filter(v => v.validationStatus === 'valid' || v.validationStatus === 'verified').length;
    const total = sessionValidations.length;
    // Only show 100% if truly 100% verified, otherwise round down to avoid confusion
    const exactPercentage = (verified / total) * 100;
    const percentage = verified === total ? 100 : Math.floor(exactPercentage);
    
    return { verified, total, percentage };
  };

  // Sortable column header component
  const SortableHeader = ({ field, children, className = "py-3" }: { 
    field: SortField; 
    children: React.ReactNode; 
    className?: string;
  }) => {
    const isSorted = sortField === field;
    const isAsc = isSorted && sortDirection === 'asc';
    const isDesc = isSorted && sortDirection === 'desc';

    return (
      <TableHead 
        className={`${className} cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 select-none text-gray-900 dark:text-gray-200`}
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-1">
          {children}
          {isSorted ? (
            isAsc ? (
              <ChevronUp className="h-4 w-4 text-blue-600" />
            ) : (
              <ChevronDown className="h-4 w-4 text-blue-600" />
            )
          ) : (
            <ChevronsUpDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </TableHead>
    );
  };

  // Sorted sessions using useMemo for performance
  const sortedSessions = useMemo(() => {
    const sessions = [...(project.sessions || [])].filter(session => session && session.id);
    
    return sessions.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortField) {
        case 'sessionName':
          aValue = (a.sessionName || '').toLowerCase();
          bValue = (b.sessionName || '').toLowerCase();
          break;
        case 'documentCount':
          aValue = a.documentCount || 0;
          bValue = b.documentCount || 0;
          break;
        case 'progress':
          aValue = getSessionProgress(a.id).percentage;
          bValue = getSessionProgress(b.id).percentage;
          break;
        case 'status':
          const statusOrder = { 'verified': 3, 'in_progress': 2, 'pending': 1 };
          aValue = statusOrder[getVerificationStatus(a.id)];
          bValue = statusOrder[getVerificationStatus(b.id)];
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        default:
          return 0;
      }
      
      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  }, [project.sessions, sortField, sortDirection, allValidations]);

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">{project.mainObjectName || "Session"}s</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              View extracted data and manage all extraction sessions for this project
            </p>
          </div>
          <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
            <DialogTrigger asChild>
              <Button 
                onClick={handleCreateNewSession}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                New {project.mainObjectName || "Session"}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New {project.mainObjectName || "Session"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sessionName">Name</Label>
                  <Input
                    id="sessionName"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    placeholder={`Enter ${(project.mainObjectName || "session").toLowerCase()} name`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSubmitCreate();
                      }
                      if (e.key === 'Escape') {
                        handleCancelCreate();
                      }
                    }}
                    autoFocus
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button 
                    variant="outline" 
                    onClick={handleCancelCreate}
                    disabled={createSessionMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSubmitCreate}
                    disabled={createSessionMutation.isPending || !sessionName.trim()}
                  >
                    {createSessionMutation.isPending ? "Creating..." : "Create"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Sessions Table */}
      <Card className="!bg-white dark:!bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardContent className="!bg-white dark:!bg-gray-800">
          {project.sessions.length === 0 ? (
            <div className="text-center py-8">
              <Database className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No {(project.mainObjectName || "session").toLowerCase()} extractions</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Click "New {project.mainObjectName || "Session"}" to create your first extraction session
              </p>
              <div className="mt-4 flex justify-center">
                <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                  <DialogTrigger asChild>
                    <Button 
                      onClick={handleCreateNewSession}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      New {project.mainObjectName || "Session"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create New {project.mainObjectName || "Session"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="sessionName2">Name</Label>
                        <Input
                          id="sessionName2"
                          value={sessionName}
                          onChange={(e) => setSessionName(e.target.value)}
                          placeholder={`Enter ${(project.mainObjectName || "session").toLowerCase()} name`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSubmitCreate();
                            }
                            if (e.key === 'Escape') {
                              handleCancelCreate();
                            }
                          }}
                          autoFocus
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button 
                          variant="outline" 
                          onClick={handleCancelCreate}
                          disabled={createSessionMutation.isPending}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleSubmitCreate}
                          disabled={createSessionMutation.isPending || !sessionName.trim()}
                        >
                          {createSessionMutation.isPending ? "Creating..." : "Create"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-gray-200 dark:border-gray-700">
              <Table className="!bg-white dark:!bg-gray-800">
                <TableHeader className="!bg-gray-50 dark:!bg-gray-700">
                  <TableRow className="border-b border-gray-200 dark:border-gray-600">
                    <SortableHeader field="sessionName">Session Name</SortableHeader>
                    <SortableHeader field="documentCount" className="py-3 w-24">Docs</SortableHeader>
                    <SortableHeader field="progress" className="py-3 w-32">Progress</SortableHeader>
                    <SortableHeader field="status" className="py-3 w-16 text-center">
                      <div className="flex justify-center">
                        <CheckCircle className="h-4 w-4 text-gray-400" />
                      </div>
                    </SortableHeader>
                    <SortableHeader field="createdAt" className="py-3 w-32">Created</SortableHeader>
                  </TableRow>
                </TableHeader>
                <TableBody className="!bg-white dark:!bg-gray-800">
                {sortedSessions.map((session) => {
                  if (!session || !session.id) return null;
                  const progress = getSessionProgress(session.id);
                  const verificationStatus = getVerificationStatus(session.id);
                  
                  return (
                    <TableRow key={session.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-600 !bg-white dark:!bg-gray-800">
                      <TableCell className="py-3 !bg-white dark:!bg-gray-800">
                        <Link href={`/projects/${project.id}/sessions/${session.id}`}>
                          <div className="cursor-pointer hover:text-primary transition-colors">
                            <p className="font-medium text-sm text-gray-900 dark:text-white">{session.sessionName || 'Untitled Session'}</p>
                            {session.description && (
                              <p className="text-xs text-muted-foreground dark:text-gray-400 truncate max-w-[200px]">
                                {session.description}
                              </p>
                            )}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="py-3 text-sm text-gray-900 dark:text-white !bg-white dark:!bg-gray-800">
                        {session.documentCount || 0}
                      </TableCell>
                      <TableCell className="py-3 !bg-white dark:!bg-gray-800">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                            <div 
                              className={`h-2.5 rounded-full transition-all duration-300 ${
                                progress.percentage === 100 ? 'bg-green-600' : 
                                progress.percentage > 0 ? 'bg-green-600' : 'bg-gray-400'
                              }`}
                              style={{ width: `${progress.percentage}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 min-w-[32px]">
                            {progress.percentage}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-center !bg-white dark:!bg-gray-800">
                        <div className="flex justify-center">
                          {verificationStatus === 'verified' ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 !bg-white dark:!bg-gray-800">
                        <div className="text-xs text-muted-foreground dark:text-gray-400">
                          {session.createdAt ? formatDate(session.createdAt).split(',')[0] : 'Unknown'}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }).filter(Boolean)}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
