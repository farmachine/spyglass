import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Dashboard from "@/pages/Dashboard";
import ProjectView from "@/pages/ProjectView";
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
import TenantNotFound from "@/pages/TenantNotFound";
import ComingSoon from "@/pages/ComingSoon";

function getSubdomain(): string | null {
  const baseDomain = import.meta.env.VITE_BASE_DOMAIN || 'extrapl.io';
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname.includes('replit')) {
    return null;
  }
  
  if (hostname === baseDomain || hostname === `www.${baseDomain}`) {
    return 'root';
  }
  
  const parts = hostname.split('.');
  if (parts.length > baseDomain.split('.').length) {
    return parts[0];
  }
  
  return null;
}

function TenantValidator({ children }: { children: React.ReactNode }) {
  const subdomain = getSubdomain();
  
  if (subdomain === 'root') {
    return <ComingSoon />;
  }
  
  const { data, isLoading, isError } = useQuery({
    queryKey: ['/api/tenant/validate', subdomain],
    queryFn: async () => {
      if (!subdomain) return { valid: true };
      const res = await fetch(`/api/tenant/validate?subdomain=${subdomain}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Invalid tenant');
      }
      return res.json();
    },
    enabled: !!subdomain,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
  
  if (!subdomain) {
    return <>{children}</>;
  }
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (isError || !data?.valid) {
    return <TenantNotFound subdomain={subdomain} />;
  }
  
  return <>{children}</>;
}

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <TenantValidator>
            <AuthProvider>
              <Toaster />
              <Router />
            </AuthProvider>
          </TenantValidator>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
