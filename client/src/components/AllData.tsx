import React, { useState } from "react";
import { Database, CheckCircle, Clock, ExternalLink, Calendar, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "wouter";
import SessionView from "./SessionView";
import type { ProjectWithDetails } from "@shared/schema";

interface AllDataProps {
  project: ProjectWithDetails;
}

export default function AllData({ project }: AllDataProps) {
  const [selectedSession, setSelectedSession] = useState<number | null>(null);
  
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // If a session is selected, show its detailed view
  if (selectedSession) {
    return (
      <div>
        <div className="mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedSession(null)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to All Sessions
          </Button>
        </div>
        <SessionView sessionId={selectedSession} project={project} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900">All Data</h2>
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
                <p className="text-sm font-medium text-gray-600">Total Sessions</p>
                <p className="text-2xl font-bold text-gray-900">{project.sessions.length}</p>
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
                  {project.sessions.filter(s => s.status === 'verified').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {project.sessions.filter(s => s.status === 'completed').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sessions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Extraction Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {project.sessions.length === 0 ? (
            <div className="text-center py-8">
              <Database className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No extraction sessions</h3>
              <p className="mt-1 text-sm text-gray-500">
                Upload documents to start extracting data
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session Name</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {project.sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{session.sessionName}</p>
                        {session.description && (
                          <p className="text-sm text-muted-foreground">{session.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{session.documentCount}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          session.status === 'verified'
                            ? 'default'
                            : session.status === 'completed'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {session.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {formatDate(session.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {session.extractedData ? (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setSelectedSession(session.id)}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">No data</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
