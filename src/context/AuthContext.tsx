'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { User, Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// Matches the confirmed profiles table schema
export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  user_type_slug: string | null; // legacy column, kept for compat
  organization: string | null;
  phone: string | null;
  country: string | null;
  is_verified: boolean;
  is_active: boolean;
  avatar_url: string | null;
  subscription_tier: string;
  created_at: string;
  updated_at: string;
}

const PROFILE_COLS =
  'id, email, full_name, role, user_type_slug, organization, phone, country, is_verified, is_active, avatar_url, subscription_tier, created_at, updated_at';

interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  role: string;
  organization: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, phone?: string) => Promise<void>;
  signUp: (data: SignUpData) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser]       = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLS)
      .eq('id', userId)
      .single();
    if (!error && data) {
      setProfile(data as UserProfile);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Fast initial state from cookies (no network call)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        // @supabase/ssr v0.9+ fires INITIAL_SESSION after a background getUser()
        // server-side verification. If that network call fails (timeout, project
        // paused, CORS), session comes back null here even though valid cookies
        // exist. Ignore this null — getSession() above already set state from
        // cookies, which is the authoritative source for initial load.
        if (event === 'INITIAL_SESSION' && !session) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
          await fetchProfile(session.user.id);
        }
        if (event === 'SIGNED_OUT') {
          setProfile(null);
        }

        setIsLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const login = async (email: string, password: string): Promise<void> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) {
      await fetchProfile(data.user.id);
    }
  };

  const register = async (
    email: string,
    password: string,
    fullName: string,
    phone?: string
  ): Promise<void> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone: phone ?? null } },
    });
    if (error) throw error;
  };

  const signUp = async (data: SignUpData): Promise<void> => {
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          role: data.role,
          organization: data.organization,
        },
      },
    });
    if (error) throw error;
  };

  const logout = async (): Promise<void> => {
    await supabase.auth.signOut();
    setProfile(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isAuthenticated: !!user,
        isLoading,
        token: session?.access_token ?? null,
        login,
        register,
        signUp,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
