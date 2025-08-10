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

    // If unauthorized, clear token and redirect to login
    if (res.status === 401) {
      localStorage.removeItem("auth_token");
      window.location.href = "/login";
      return;
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
