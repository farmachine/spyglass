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

// Browser console logging component - only polls during extractions
function BrowserConsoleLogger() {
  const lastLogId = useRef<number>(0);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Function to start polling when extraction begins
  const startPolling = () => {
    if (pollInterval.current) return; // Already polling
    
    pollInterval.current = setInterval(async () => {
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
        // Silently ignore polling errors to avoid spam
      }
    }, 2000); // Poll every 2 seconds during extractions
  };
  
  // Function to stop polling when extraction ends
  const stopPolling = () => {
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }
  };
  
  useEffect(() => {
    // Listen for extraction events
    const handleExtractionStart = () => startPolling();
    const handleExtractionEnd = () => {
      // Stop polling after a brief delay to catch final logs
      setTimeout(stopPolling, 5000);
    };
    
    // Listen for custom events from extraction components
    window.addEventListener('extraction-started', handleExtractionStart);
    window.addEventListener('extraction-completed', handleExtractionEnd);
    
    return () => {
      stopPolling();
      window.removeEventListener('extraction-started', handleExtractionStart);
      window.removeEventListener('extraction-completed', handleExtractionEnd);
    };
  }, []);
  
  return null; // This component doesn't render anything
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
