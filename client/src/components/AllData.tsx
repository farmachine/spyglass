import React from "react";
import { Database, CheckCircle, Clock, ExternalLink, Calendar, AlertCircle } from "lucide-react";
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

export default function AllData({ project }: AllDataProps) {
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
    staleTime: 0  // Make sure data is always fresh
  });

  // Get verification status for a session
  const getVerificationStatus = (sessionId: number): 'verified' | 'in_progress' | 'pending' => {
    const sessionValidations = allValidations.filter(v => v.sessionId === sessionId);
    if (sessionValidations.length === 0) return 'pending';
    
    const allVerified = sessionValidations.every(v => v.validationStatus === 'valid' || v.validationStatus === 'verified');
    
    // Debug logging
    console.log(`Session ${sessionId} - Validations: ${sessionValidations.length}, All verified: ${allVerified}`);
    console.log(`Session ${sessionId} - Status breakdown:`, sessionValidations.map(v => ({ field: v.fieldName, status: v.validationStatus })));
    
    return allVerified ? 'verified' : 'in_progress';
  };

  // Calculate verification stats
  const getVerificationStats = () => {
    const stats = { verified: 0, in_progress: 0, pending: 0 };
    
    for (const session of project.sessions) {
      const status = getVerificationStatus(session.id);
      stats[status]++;
    }
    
    return stats;
  };

  const verificationStats = getVerificationStats();

  // Get verification progress for a session
  const getSessionProgress = (sessionId: number) => {
    const sessionValidations = allValidations.filter(v => v.sessionId === sessionId);
    if (sessionValidations.length === 0) return { verified: 0, total: 0, percentage: 0 };
    
    const verified = sessionValidations.filter(v => v.validationStatus === 'valid' || v.validationStatus === 'verified').length;
    const total = sessionValidations.length;
    const percentage = Math.round((verified / total) * 100);
    
    return { verified, total, percentage };
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900">All {project.mainObjectName || "Session"} Data</h2>
        <p className="text-sm text-gray-600 mt-1">
          View extracted data and manage all extraction sessions for this project
        </p>
      </div>

      {/* Sessions Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Database className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total {project.mainObjectName || "Session"}s</p>
                <p className="text-2xl font-bold text-gray-900">{project.sessions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-gray-900">
                  {verificationStats.in_progress}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Verified</p>
                <p className="text-2xl font-bold text-gray-900">
                  {verificationStats.verified}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sessions Table */}
      <Card>
        <CardHeader>
          <CardTitle>{project.mainObjectName || "Session"} Extraction Sessions</CardTitle>
        </CardHeader>
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
                    <TableHead className="py-3">Session Name</TableHead>
                    <TableHead className="py-3 w-24">Docs</TableHead>
                    <TableHead className="py-3 w-32">Progress</TableHead>
                    <TableHead className="py-3 w-32">Status</TableHead>
                    <TableHead className="py-3 w-32">Created</TableHead>
                    <TableHead className="py-3 w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {project.sessions.map((session) => {
                  const progress = getSessionProgress(session.id);
                  const verificationStatus = getVerificationStatus(session.id);
                  
                  return (
                    <TableRow key={session.id} className="hover:bg-gray-50">
                      <TableCell className="py-3">
                        <div>
                          <p className="font-medium text-sm">{session.sessionName}</p>
                          {session.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {session.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-sm">
                        {session.documentCount}
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                progress.percentage === 100 ? 'bg-green-600' : 
                                progress.percentage > 0 ? 'bg-blue-600' : 'bg-gray-400'
                              }`}
                              style={{ width: `${progress.percentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600 min-w-[40px]">
                            {progress.verified}/{progress.total}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge
                          variant={
                            verificationStatus === 'verified'
                              ? 'default'
                              : verificationStatus === 'in_progress'
                              ? 'secondary'
                              : 'outline'
                          }
                          className="text-xs"
                        >
                          {verificationStatus === 'verified' ? 'Verified' : 
                           verificationStatus === 'in_progress' ? 'In Progress' : 
                           'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="text-xs text-muted-foreground">
                          {formatDate(session.createdAt).split(',')[0]}
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <Link href={`/projects/${project.id}/sessions/${session.id}`}>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </Link>
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
