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
    queryKey: ["/api/dashboard/statistics", user?.id], // Add user ID to force refetch
    enabled: !!user, // Only run query when user is authenticated
    staleTime: 0, // Force fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}