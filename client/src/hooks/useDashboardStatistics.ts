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
      const response = await apiRequest("/api/dashboard/statistics");
      const data = await response.json();
      console.log("Dashboard statistics response:", data);
      return data;
    },
    enabled: !!user, // Only run query when user is authenticated
    onError: (error) => {
      console.error("Dashboard statistics error:", error);
    }
  });
}