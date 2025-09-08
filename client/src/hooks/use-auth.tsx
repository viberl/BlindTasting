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
  updateProfile: UseMutationResult<User, Error, { name?: string; company?: string; profileImage?: string }>;
  updatePassword: UseMutationResult<void, Error, { currentPassword: string; newPassword: string }>;
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
        
        // Check for session cookie
        const hasSessionCookie = document.cookie.includes('connect.sid');
        console.log('Session cookie present:', hasSessionCookie);
        
        if (!hasSessionCookie) {
          setIsLoading(false);
          setUser(null);
          return;
        }
        
        const response = await queryClient.fetchQuery({
          queryKey: ['user'],
          queryFn: () => fetchCurrentUser(),
          retry: false // Don't retry on 401 errors
        });

        if (response) {
          setUser(response);
          setError(null);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
        setError(error as Error);
        setUser(null);
        
        // Clear invalid session
        if ((error as any)?.response?.status === 401) {
          await queryClient.invalidateQueries({ queryKey: ['user'] });
          document.cookie = 'connect.sid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        }
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

  const updateProfile = useMutation({
    mutationFn: async (payload: { name?: string; company?: string; profileImage?: string }) => {
      const res = await apiRequest('PATCH', '/api/user', payload);
      return await res.json();
    },
    onSuccess: (updated: User) => {
      setUser(updated);
      queryClient.invalidateQueries({ queryKey: ['user'] });
      toast({ title: 'Profil aktualisiert' });
    },
    onError: (err: Error) => {
      setError(err);
      toast({ title: 'Profil konnte nicht aktualisiert werden', description: err.message, variant: 'destructive' });
    }
  });

  const updatePassword = useMutation({
    mutationFn: async (payload: { currentPassword: string; newPassword: string }) => {
      await apiRequest('POST', '/api/user/password', payload);
    },
    onSuccess: () => {
      toast({ title: 'Passwort geändert' });
    },
    onError: (err: Error) => {
      setError(err);
      toast({ title: 'Passwortänderung fehlgeschlagen', description: err.message, variant: 'destructive' });
    }
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
        updateProfile,
        updatePassword,
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

// Helper function to fetch current user
async function fetchCurrentUser() {
  const response = await apiRequest('GET', '/api/user');
  if (response.ok) {
    return await response.json();
  } else {
    throw new Error('Failed to fetch current user');
  }
}
