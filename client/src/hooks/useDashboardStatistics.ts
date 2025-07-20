import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";

export interface DashboardStatistics {
  totalProjects: number;
  totalSessions: number;
  totalValidations: number;
  verifiedValidations: number;
  unverifiedValidations: number;
}

export function useDashboardStatistics() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["/api/dashboard/statistics", user?.id, user?.organizationId],
    queryFn: async (): Promise<DashboardStatistics> => {
      console.log("Fetching dashboard statistics...");
      try {
        const response = await apiRequest("/api/dashboard/statistics");
        console.log("Response status:", response.status, response.statusText);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("API error response:", errorText);
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        
        const data = await response.json();
        console.log("Dashboard statistics response:", data);
        return data;
      } catch (error) {
        console.error("Query function error:", error);
        throw error;
      }
    },
    enabled: !!user, // Only run query when user is authenticated
    staleTime: 30000, // Consider data stale after 30 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}