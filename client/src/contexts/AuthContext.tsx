import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, UserWithOrganization } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";

interface AuthContextType {
  user: UserWithOrganization | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  organizationId: number;
  role: "admin" | "user";
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<UserWithOrganization | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize auth state from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem("auth_token");
    if (savedToken) {
      setToken(savedToken);
      // Verify token and get user data
      fetchUserData(savedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchUserData = async (authToken: string) => {
    try {
      const response = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        // Clear cache when user data is loaded/refreshed
        queryClient.clear();
      } else {
        // Token is invalid, clear it
        localStorage.removeItem("auth_token");
        setToken(null);
        queryClient.clear();
      }
    } catch (error) {
      console.error("Failed to fetch user data:", error);
      localStorage.removeItem("auth_token");
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem("auth_token", data.token);
        
        // Clear all cached data when a new user logs in
        queryClient.clear();
        
        // Check if user should be redirected to their org's subdomain
        const baseDomain = import.meta.env.VITE_BASE_DOMAIN;
        if (data.subdomain && baseDomain) {
          const currentHost = window.location.hostname;
          const expectedHost = `${data.subdomain}.${baseDomain}`;
          
          // Redirect if not on the correct subdomain
          if (currentHost !== expectedHost && currentHost !== 'localhost') {
            const redirectUrl = `${window.location.protocol}//${expectedHost}${window.location.pathname}`;
            toast({
              title: "Redirecting to your organization",
              description: `Taking you to ${data.subdomain}.${baseDomain}`,
            });
            window.location.href = redirectUrl;
            return;
          }
        }
        
        // Check if user has temporary password
        if (data.requiresPasswordChange) {
          setShowPasswordDialog(true);
          toast({
            title: "Password Change Required",
            description: "You must change your temporary password to continue.",
          });
        } else {
          toast({
            title: "Login successful",
            description: "Welcome back!",
          });
        }
      } else if (response.status === 403 && data.redirectSubdomain) {
        // User tried to login from wrong subdomain
        const baseDomain = import.meta.env.VITE_BASE_DOMAIN;
        if (baseDomain && data.redirectSubdomain) {
          const redirectUrl = `${window.location.protocol}//${data.redirectSubdomain}.${baseDomain}/login`;
          toast({
            title: "Wrong organization",
            description: `Redirecting you to the correct organization...`,
          });
          window.location.href = redirectUrl;
          return;
        }
        throw new Error(data.message || "Access denied");
      } else {
        throw new Error(data.message || "Login failed");
      }
    } catch (error) {
      toast({
        title: "Login failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
      throw error;
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const responseData = await response.json();

      if (response.ok) {
        setUser(responseData.user);
        setToken(responseData.token);
        localStorage.setItem("auth_token", responseData.token);
        toast({
          title: "Registration successful",
          description: "Account created successfully!",
        });
      } else {
        throw new Error(responseData.message || "Registration failed");
      }
    } catch (error) {
      toast({
        title: "Registration failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("auth_token");
    
    // Clear all cached data when user logs out
    queryClient.clear();
    
    toast({
      title: "Logged out",
      description: "You have been logged out successfully",
    });
  };

  const handlePasswordChangeSuccess = () => {
    setShowPasswordDialog(false);
    // Refresh user data to get updated temporary password status
    if (token) {
      fetchUserData(token);
    }
    toast({
      title: "Password Updated",
      description: "Your password has been successfully changed.",
    });
  };

  const value = {
    user,
    token,
    login,
    register,
    logout,
    isLoading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <ChangePasswordDialog
        open={showPasswordDialog}
        onClose={() => setShowPasswordDialog(false)}
        onSuccess={handlePasswordChangeSuccess}
      />
    </AuthContext.Provider>
  );
}