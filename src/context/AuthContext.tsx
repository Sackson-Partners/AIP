'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ||
  'https://aip-api.politesea-b4c1d412.southafricanorth.azurecontainerapps.io';

interface AIPUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  organisation: string | null;
  is_active: boolean;
}

interface AuthContextType {
  user: AIPUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  token: string | null;
}

const AuthContext = createContext(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(null);
  const [isLoading, setLoading] = useState(true);

  // Load token from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('aip_token');
    const storedUser = localStorage.getItem('aip_user');
    if (stored && storedUser) {
      setToken(stored);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const form = new URLSearchParams();
    form.append('username', email);
    form.append('password', password);

    const res = await fetch(`${API_URL}/api/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Login failed');
    }

    const data = await res.json();
    const newToken = data.access_token;

    // Fetch user profile
    const meRes = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${newToken}` },
    });
    const userData = await meRes.json();

    localStorage.setItem('aip_token', newToken);
    localStorage.setItem('aip_user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('aip_token');
    localStorage.removeItem('aip_user');
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  };

  return (
    
      {children}
    
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
