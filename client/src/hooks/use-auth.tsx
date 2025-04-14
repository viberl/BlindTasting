import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import {
  useMutation,
  UseMutationResult,
  useQueryClient,
} from "@tanstack/react-query";
import { User } from "@shared/schema";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, RegisterData>;
};

type LoginData = {
  email: string;
  password: string;
};

type RegisterData = {
  name: string;
  email: string;
  password: string;
  company: string;
  profileImage: string;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch current user on mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        setIsLoading(true);
        console.log('Fetching user data...');
        const response = await fetch('/api/user', {
          credentials: 'include',
        });
        console.log('User fetch response:', response.status, response.statusText);
        
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          setUser(null);
        }
      } catch (err) {
        setError(err as Error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, []);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      console.log('Attempting login with:', credentials.email);
      const res = await apiRequest("POST", "/api/login", credentials);
      const userData = await res.json();
      console.log('Login response:', userData);
      return userData;
    },
    onSuccess: (userData: User) => {
      setUser(userData);
      queryClient.invalidateQueries({queryKey: ["/api/user"]});
      toast({
        title: "Login successful",
        description: `Welcome back, ${userData.name}!`,
      });
    },
    onError: (err: Error) => {
      setError(err);
      toast({
        title: "Login failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: RegisterData) => {
      console.log('Attempting registration with:', userData.email);
      const res = await apiRequest("POST", "/api/register", userData);
      const newUserData = await res.json();
      console.log('Registration response:', newUserData);
      return newUserData;
    },
    onSuccess: (userData: User) => {
      setUser(userData);
      queryClient.invalidateQueries({queryKey: ["/api/user"]});
      toast({
        title: "Registration successful",
        description: `Welcome to BlindSip, ${userData.name}!`,
      });
    },
    onError: (err: Error) => {
      setError(err);
      toast({
        title: "Registration failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      setUser(null);
      queryClient.invalidateQueries({queryKey: ["/api/user"]});
      toast({
        title: "Logout successful",
        description: "You have been logged out.",
      });
    },
    onError: (err: Error) => {
      setError(err);
      toast({
        title: "Logout failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
