import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

const API_URL = import.meta.env.VITE_API_URL ?? '/api';

export type AuthSession = {
  session: { id: string; expiresAt: string };
  user: {
    id: string;
    email: string;
    name: string;
    username: string | null;
    role: 'USER' | 'ADMIN';
    status: 'ACTIVE' | 'DISABLED';
    preferredLanguage: 'ar' | 'en';
  };
};
type Credentials = { identifier: string; password: string };
type AuthContextValue = {
  session: AuthSession | null | undefined;
  isLoading: boolean;
  login(credentials: Credentials): Promise<void>;
  logout(): Promise<void>;
  refresh(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const authKey = ['auth-session'] as const;

async function authRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(API_URL + '/auth' + path, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(payload?.message ?? 'Authentication failed', response.status);
  return payload as T;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const sessionQuery = useQuery({
    queryKey: authKey,
    queryFn: async () => {
      const response = await fetch(API_URL + '/auth/get-session', { credentials: 'include', cache: 'no-store' });
      if (response.status === 401) return null;
      if (!response.ok) throw new ApiError('Authentication failed', response.status);
      const data = await response.json();
      return data?.user ? data as AuthSession : null;
    },
    retry: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    const unauthorized = () => queryClient.setQueryData(authKey, null);
    window.addEventListener('nazemni:unauthorized', unauthorized);
    return () => window.removeEventListener('nazemni:unauthorized', unauthorized);
  }, [queryClient]);

  const login = async ({ identifier, password }: Credentials) => {
    const isEmail = identifier.includes('@');
    await authRequest(isEmail ? '/sign-in/email' : '/sign-in/username', {
      method: 'POST',
      body: JSON.stringify(isEmail ? { email: identifier.trim().toLowerCase(), password } : { username: identifier.trim().toLowerCase(), password }),
    });
    await queryClient.invalidateQueries({ queryKey: authKey });
    await queryClient.fetchQuery({ queryKey: authKey });
  };

  const logout = async () => {
    try {
      await authRequest('/sign-out', { method: 'POST', body: '{}' });
    } finally {
      queryClient.setQueryData(authKey, null);
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== authKey[0] });
    }
  };

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: authKey });
  };

  return (
    <AuthContext.Provider value={{
      session: sessionQuery.data,
      isLoading: sessionQuery.isPending,
      login,
      logout,
      refresh,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
