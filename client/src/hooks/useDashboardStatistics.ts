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
    queryKey: ["/api/dashboard/statistics"], // Simple endpoint without parameters
    enabled: !!user, // Only run query when user is authenticated
    staleTime: 30000, // Consider data stale after 30 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}