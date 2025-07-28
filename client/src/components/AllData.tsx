import React, { useState, useMemo } from "react";
import { Database, CheckCircle, Clock, ExternalLink, Calendar, AlertCircle, ChevronUp, ChevronDown, ChevronsUpDown, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { ProjectWithDetails, FieldValidation } from "@shared/schema";

interface AllDataProps {
  project: ProjectWithDetails;
}

type SortField = 'sessionName' | 'documentCount' | 'progress' | 'status' | 'createdAt';
type SortDirection = 'asc' | 'desc';

export default function AllData({ project }: AllDataProps) {
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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
      for (const session of project.sessions) {
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
    staleTime: 0,  // Make sure data is always fresh
    refetchInterval: 5000  // Refresh every 5 seconds to catch status changes
  });

  // Use project sessions directly with reactive updates
  const sessionsToDisplay = project.sessions;

  // Get verification status for a session
  const getVerificationStatus = (sessionId: string): 'verified' | 'in_progress' | 'pending' => {
    const sessionValidations = allValidations.filter(v => v.sessionId === sessionId);
    if (sessionValidations.length === 0) return 'pending';
    
    const allVerified = sessionValidations.every(v => v.validationStatus === 'valid' || v.validationStatus === 'verified');
    
    return allVerified ? 'verified' : 'in_progress';
  };

  // Calculate verification stats
  const getVerificationStats = () => {
    const stats = { verified: 0, in_progress: 0, pending: 0 };
    
    for (const session of sessionsToDisplay) {
      const status = getVerificationStatus(session.id);
      stats[status]++;
    }
    
    return stats;
  };

  const verificationStats = getVerificationStats();

  // Get verification progress for a session
  const getSessionProgress = (sessionId: string) => {
    const sessionValidations = allValidations.filter(v => v.sessionId === sessionId);
    if (sessionValidations.length === 0) return { verified: 0, total: 0, percentage: 0 };
    
    const verified = sessionValidations.filter(v => v.validationStatus === 'valid' || v.validationStatus === 'verified').length;
    const total = sessionValidations.length;
    const percentage = Math.round((verified / total) * 100);
    
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
        className={`${className} cursor-pointer hover:bg-gray-50 select-none`}
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
    const sessions = [...sessionsToDisplay];
    
    return sessions.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortField) {
        case 'sessionName':
          aValue = a.sessionName.toLowerCase();
          bValue = b.sessionName.toLowerCase();
          break;
        case 'documentCount':
          aValue = a.documentCount;
          bValue = b.documentCount;
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
  }, [sessionsToDisplay, sortField, sortDirection, allValidations]);

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900">{project.mainObjectName || "Session"} Extraction Sessions</h2>
        <p className="text-sm text-gray-600 mt-1">
          View extracted data and manage all extraction sessions for this project
        </p>
      </div>

      {/* Sessions Table */}
      <Card>
        <CardContent>
          {project.sessions.length === 0 ? (
            <div className="text-center py-8">
              <Database className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No {(project.mainObjectName || "session").toLowerCase()} extractions</h3>
              <p className="mt-1 text-sm text-gray-500">
                Upload documents to start extracting {(project.mainObjectName || "session").toLowerCase()} data
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
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
                <TableBody>
                {sortedSessions.map((session) => {
                  const progress = getSessionProgress(session.id);
                  const verificationStatus = getVerificationStatus(session.id);
                  
                  return (
                    <TableRow key={session.id} className="hover:bg-gray-50">
                      <TableCell className="py-3">
                        <Link href={`/projects/${project.id}/sessions/${session.id}`}>
                          <div className="cursor-pointer hover:text-primary transition-colors">
                            <p className="font-medium text-sm">{session.sessionName}</p>
                            {session.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {session.description}
                              </p>
                            )}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="py-3 text-sm">
                        {session.documentCount}
                      </TableCell>
                      <TableCell className="py-3">
                        {session.status === 'processing' ? (
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2.5">
                              <div className="h-2.5 rounded-full bg-blue-500 animate-pulse" style={{ width: '40%' }} />
                            </div>
                            <span className="text-xs font-medium text-blue-600">Processing...</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2.5">
                              <div 
                                className={`h-2.5 rounded-full transition-all duration-300 ${
                                  progress.percentage === 100 ? 'bg-green-600' : 
                                  progress.percentage > 0 ? 'bg-green-600' : 'bg-gray-400'
                                }`}
                                style={{ width: `${progress.percentage}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-700 min-w-[32px]">
                              {progress.percentage}%
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-center">
                        <div className="flex justify-center">
                          {session.status === 'processing' ? (
                            <Clock className="h-4 w-4 text-blue-500 animate-spin" />
                          ) : verificationStatus === 'verified' ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="text-xs text-muted-foreground">
                          {formatDate(session.createdAt).split(',')[0]}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
