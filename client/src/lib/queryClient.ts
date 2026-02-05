import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  url: string,
  options?: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
  }
): Promise<any> {
  const { method = "GET", body, headers = {} } = options || {};
  const token = localStorage.getItem("auth_token");
  
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...headers,
      },
      body,
      credentials: "include",
    });

    // If unauthorized (401), clear token and redirect to login
    // For 403, only logout if it's not a tenant mismatch (user may be on wrong subdomain)
    if (res.status === 401) {
      console.log('Token expired or unauthorized. Clearing auth and redirecting to login...');
      localStorage.removeItem("auth_token");
      localStorage.clear();
      sessionStorage.clear();
      window.location.replace("/login");
      return;
    }
    
    // For 403, check if it's a tenant mismatch - don't logout, just throw error
    if (res.status === 403) {
      const errorData = await res.clone().json().catch(() => ({}));
      if (errorData.error === 'TENANT_MISMATCH') {
        throw new Error(`403: ${errorData.message || 'Access denied to this organization'}`);
      }
      // For other 403 errors (forbidden actions), don't auto-logout
      throw new Error(`403: ${errorData.message || 'Forbidden'}`);
    }

    await throwIfResNotOk(res);
    
    // Handle empty responses (like 204 No Content)
    const contentType = res.headers.get("content-type");
    if (res.status === 204 || !contentType?.includes("application/json")) {
      return null;
    }
    
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch (error) {
    // Enhanced error handling with more context
    if (error instanceof TypeError && (
      error.message.includes('Failed to fetch') || 
      error.message.includes('Network request failed') ||
      error.message.includes('fetch: network error')
    )) {
      throw new Error(`Network error: unable to connect to server. Please check your connection and try again.`);
    }
    if (error instanceof Error && error.name === 'NetworkError') {
      throw new Error(`Network error: unable to connect to server. Please check your connection and try again.`);
    }
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = localStorage.getItem("auth_token");
    
    const res = await fetch(queryKey.join("/") as string, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    // If unauthorized, clear token and redirect to login
    if (res.status === 401) {
      localStorage.removeItem("auth_token");
      window.location.href = "/login";
      return;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: (failureCount, error) => {
        // Retry network errors up to 2 times
        if (error?.message?.includes('Network error') && failureCount < 2) {
          return true;
        }
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: false,
    },
  },
});
