import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useEffect, useRef } from "react";
import Dashboard from "@/pages/Dashboard";
import ProjectView from "@/pages/ProjectView";
// import SessionReview from "@/pages/SessionReview";
import SessionView from "@/pages/SessionView";
import DocumentTextView from "@/pages/DocumentTextView";
import SchemaView from "@/pages/SchemaView";
import GeminiResults from "@/pages/GeminiResults";
import AdminPanel from "@/pages/AdminPanel";
import ProjectAdminView from "@/pages/ProjectAdminView";
import OrganizationConfig from "@/pages/OrganizationConfig";
import DebugView from "@/pages/DebugView";
import Login from "@/pages/Login";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />

      <Route path="/">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/projects/:id">
        <ProtectedRoute>
          <ProjectView />
        </ProtectedRoute>
      </Route>
      <Route path="/projects/:id/configure">
        <ProtectedRoute>
          <ProjectAdminView />
        </ProtectedRoute>
      </Route>
      <Route path="/projects/:projectId/sessions/:sessionId">
        <ProtectedRoute>
          <SessionView />
        </ProtectedRoute>
      </Route>
      <Route path="/sessions/:sessionId/text-view">
        <ProtectedRoute>
          <DocumentTextView />
        </ProtectedRoute>
      </Route>
      <Route path="/sessions/:sessionId/schema-view">
        <ProtectedRoute>
          <SchemaView />
        </ProtectedRoute>
      </Route>
      <Route path="/sessions/:sessionId/schema">
        <ProtectedRoute>
          <SchemaView />
        </ProtectedRoute>
      </Route>
      <Route path="/sessions/:sessionId/gemini-results">
        <ProtectedRoute>
          <GeminiResults />
        </ProtectedRoute>
      </Route>
      <Route path="/sessions/:sessionId/debug">
        <ProtectedRoute>
          <DebugView />
        </ProtectedRoute>
      </Route>
      <Route path="/sessions/:sessionId">
        <ProtectedRoute>
          <SessionView />
        </ProtectedRoute>
      </Route>
      <Route path="/admin">
        <ProtectedRoute>
          <AdminPanel />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/organizations/:id">
        <ProtectedRoute>
          <OrganizationConfig />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

// Simple browser console logging - polls every 5 seconds when page is active
function BrowserConsoleLogger() {
  const lastLogId = useRef<number>(0);
  
  useEffect(() => {
    let isActive = true;
    
    const pollLogs = async () => {
      if (!isActive) return;
      
      try {
        const response = await fetch(`/api/dev/browser-logs?since=${lastLogId.current}`);
        if (response.ok) {
          const data = await response.json();
          if (data.logs && data.logs.length > 0) {
            data.logs.forEach((log: any) => {
              // Log to actual browser console based on level
              const consoleFn = console[log.level] || console.log;
              consoleFn(`🔧 [Tool Debug] ${log.message}`);
              lastLogId.current = Math.max(lastLogId.current, log.id);
            });
          }
        }
      } catch (error) {
        // Silently ignore polling errors
      }
    };
    
    // Initial poll
    pollLogs();
    
    // Poll every 5 seconds (reasonable for debugging)
    const pollInterval = setInterval(pollLogs, 5000);
    
    return () => {
      isActive = false;
      clearInterval(pollInterval);
    };
  }, []);
  
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <BrowserConsoleLogger />
            <Toaster />
            <Router />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
