'use client';
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  // Start as true — loading until the initial session check resolves
  const [isLoading, setIsLoading] = useState(true);
  // Prevents setState calls after the component unmounts (race condition fix)
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Resolve initial session before rendering protected routes
    supabase.auth.getSession().then((result) => {
      if (!mountedRef.current) return;
      const initialSession: Session | null = result.data.session;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setIsLoading(false);
    });

    // Subscribe to auth state changes; keep subscription alive for the lifetime of the provider
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, updatedSession: Session | null) => {
      if (!mountedRef.current) return;
      setSession(updatedSession);
      setUser(updatedSession?.user ?? null);
      setIsLoading(false);
    });

    // Cleanup: stop receiving events and mark as unmounted to block pending async setState
    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  /** Returns a fresh access token, or null if not authenticated. */
  const getToken = async (): Promise<string | null> => {
    const { data: { session: s } } = await supabase.auth.getSession();
    return s?.access_token ?? null;
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isAuthenticated: !!session,
      isLoading,
      logout,
      getToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
