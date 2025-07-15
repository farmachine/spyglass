import { Database, Calendar, CheckCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProjectWithDetails } from "@shared/schema";

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

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900">All Data</h2>
        <p className="text-sm text-gray-600 mt-1">
          View all extraction sessions and their status for this project
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
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-gray-900">
                  {project.sessions.filter(s => s.status === 'in_progress').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sessions List */}
      <Card>
        <CardHeader>
          <CardTitle>Extraction Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {project.sessions.length === 0 ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No extraction sessions yet
              </h3>
              <p className="text-sm text-gray-600">
                Start by uploading documents in the "New Upload" tab
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {project.sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      {session.status === 'verified' ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <Clock className="h-5 w-5 text-orange-600" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">
                        Session #{session.id}
                      </h4>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="h-4 w-4" />
                        {formatDate(session.createdAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge 
                      variant={session.status === 'verified' ? 'default' : 'secondary'}
                      className={session.status === 'verified' ? 'bg-green-100 text-green-800' : ''}
                    >
                      {session.status === 'verified' ? 'Verified' : 'In Progress'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
