const fs = require('fs');

const layout = `'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      
        
      
    );
  }

  if (!isAuthenticated) return null;

  return (
    
      <sidebar>
      
        
          {children}
        
      
    
  );
}
`;

const login = `'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

interface LoginForm {
  email: string;
  password: string;
}

export default function Login() {
  const { register, handleSubmit, formState: { errors } } = useForm<loginform>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError(null);
    try {
      await login(data.email, data.password);
      const redirectTo = searchParams.get('redirectTo') || '/dashboard';
      router.push(redirectTo);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    
      
        
          
            
              A
            
          
          Sign in to your account
          
            Or{' '}
            
              create a new account
            
          
        

        {error && (
          
            {error}
          
        )}

        
          
            Email address
            
            {errors.email && {errors.email.message}}
          

          
            Password
            
            {errors.password && {errors.password.message}}
          

          
            
            
              Forgot your password?
            
          

          
            {isLoading ? (
              
                
                Signing in...
              
            ) : (
              'Sign in'
            )}
          
        
      
    
  );
}
`;

const register = `'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

interface RegisterForm {
  full_name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: string;
  organization: string;
}

const ROLES = [
  { value: 'private_fund',       label: 'Private Infrastructure Fund' },
  { value: 'dfi',                label: 'Development Finance Institution' },
  { value: 'epc_contractor',     label: 'EPC Contractor' },
  { value: 'government',         label: 'African Government' },
  { value: 'academic',           label: 'Academic / Think Tank' },
  { value: 'journalist_analyst', label: 'Journalist / Analyst' },
];

export default function Register() {
  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const router = useRouter();
  const { signUp } = useAuth();
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const password = watch('password');

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    setError(null);
    try {
      await signUp({
        email: data.email,
        password: data.password,
        fullName: data.full_name,
        role: data.role,
        organization: data.organization,
      });
      setSuccess(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      
        
          
            
              
            
          
          Account Created
          Check your email to confirm your account. Redirecting...
        
      
    );
  }

  return (
    
      
        
          
            
              A
            
          
          Create your account
          
            Or{' '}
            
              sign in to existing account
            
          
        

        {error && (
          
            {error}
          
        )}

        
          
            Full name
            
            {errors.full_name && {errors.full_name.message}}
          

          
            Email address
            
            {errors.email && {errors.email.message}}
          

          
            Your role
            
              Select your role...
              {ROLES.map((r) => (
                {r.label}
              ))}
            
            {errors.role && {errors.role.message}}
          

          
            Organization name
            
            {errors.organization && {errors.organization.message}}
          

          
            Password
            
            {errors.password && {errors.password.message}}
          

          
            Confirm password
             v === password || 'Passwords do not match',
              })}
              type="password"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
            {errors.confirmPassword && {errors.confirmPassword.message}}
          

          
            {isLoading ? (
              
                
                Creating account...
              
            ) : (
              'Create account'
            )}
          
        
      
    
  );
}
`;

const sidebar = `'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRBAC, Permission, USER_ROLES } from '@/hooks/useRBAC';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermissions?: Permission[];
  adminOnly?: boolean;
}

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    
      
    
  );
}

const ICONS = {
  home:     "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  folder:   "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z",
  file:     "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  clip:     "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  doc:      "M9 12h6m-6 4h6M5 8h14M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z",
  bolt:     "M13 10V3L4 14h7v7l9-11h-7z",
  gavel:    "M3 6l3 1m0 0l-3 9a5 5 0 006.516 6.916M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5 5 0 01-6.516 6.916M18 7l3 9m-3-9l-6-2M6 7H3m15 0h3M6 7v1m12-1v1",
  users:    "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  shield:   "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  database: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
  deal:     "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  chart:    "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  calendar: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  group:    "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  puzzle:   "M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z",
  logout:   "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
};

const makeIcon = (d: string) => ({ className }: { className?: string }) => ;

const navigation: NavItem[] = [
  { name: 'Dashboard',     href: '/dashboard',               icon: makeIcon(ICONS.home) },
  { name: 'Projects',      href: '/dashboard/projects',      icon: makeIcon(ICONS.folder),   requiredPermissions: ['view_all_projects','view_own_projects','view_curated_projects','view_approved_projects'] },
  { name: 'PIS',           href: '/dashboard/pis',           icon: makeIcon(ICONS.file),     requiredPermissions: ['view_all_projects','view_own_projects','view_curated_projects','view_approved_projects'] },
  { name: 'PESTEL',        href: '/dashboard/pestel',        icon: makeIcon(ICONS.clip),     requiredPermissions: ['run_pestel','view_pestel_full','view_pestel_summary'] },
  { name: 'EIN',           href: '/dashboard/ein',           icon: makeIcon(ICONS.doc),      requiredPermissions: ['generate_ein','edit_ein','view_approved_ein','view_ein_approved_only'] },
  { name: 'Pipeline',      href: '/dashboard/pipeline',      icon: makeIcon(ICONS.bolt),     requiredPermissions: ['view_pipeline'] },
  { name: 'IC',            href: '/dashboard/ic',            icon: makeIcon(ICONS.gavel),    requiredPermissions: ['vote_ic','manage_ic'] },
  { name: 'Investors',     href: '/dashboard/investors',     icon: makeIcon(ICONS.users),    requiredPermissions: ['view_all_projects','view_curated_projects'] },
  { name: 'Verifications', href: '/dashboard/verifications', icon: makeIcon(ICONS.shield),   requiredPermissions: ['view_all_projects','run_pestel'] },
  { name: 'Data Rooms',    href: '/dashboard/data-rooms',    icon: makeIcon(ICONS.database), requiredPermissions: ['upload_documents','upload_own_documents'] },
  { name: 'Deal Rooms',    href: '/dashboard/deal-rooms',    icon: makeIcon(ICONS.deal),     requiredPermissions: ['view_all_projects','view_approved_projects'] },
  { name: 'Analytics',     href: '/dashboard/analytics',     icon: makeIcon(ICONS.chart),    requiredPermissions: ['view_analytics','view_all_projects'] },
  { name: 'Events',        href: '/dashboard/events',        icon: makeIcon(ICONS.calendar), requiredPermissions: ['view_all_projects','view_approved_projects'] },
  { name: 'Users',         href: '/dashboard/users',         icon: makeIcon(ICONS.group),    requiredPermissions: ['manage_users'],        adminOnly: true },
  { name: 'Integrations',  href: '/dashboard/integrations',  icon: makeIcon(ICONS.puzzle),   requiredPermissions: ['manage_integrations'], adminOnly: true },
];

const ROLE_BADGE_COLORS: Record = {
  admin:       'bg-red-500',
  analyst:     'bg-blue-500',
  ic_member:   'bg-purple-500',
  gov_partner: 'bg-green-500',
  epc:         'bg-yellow-500',
  investor:    'bg-teal-500',
  viewer:      'bg-gray-500',
};

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const { role, canAny } = useRBAC();

  const visibleNavigation = useMemo(() => {
    return navigation.filter((item) => {
      if (!item.requiredPermissions) return true;
      return canAny(item.requiredPermissions);
    });
  }, [canAny]);

  const roleInfo = USER_ROLES[role];

  return (
    

      
        
          A
        
        AIP Platform
      

      {user && (
        
          
            
              
                {(user.user_metadata?.full_name || user.email || 'U').charAt(0).toUpperCase()}
              
            
            
              
                {user.user_metadata?.full_name || user.email}
              
              {roleInfo && (
                
                  {roleInfo.label}
                
              )}
            
          
        
      )}

      
        {visibleNavigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            
              
              {item.name}
              {item.adminOnly && (
                Admin
              )}
            
          );
        })}
      

      
        
          
          Sign Out
        
      
    
  );
}
`;

fs.mkdirSync('src/app/dashboard', { recursive: true });
fs.mkdirSync('src/app/login',     { recursive: true });
fs.mkdirSync('src/app/register',  { recursive: true });
fs.mkdirSync('src/components',    { recursive: true });

fs.writeFileSync('src/app/dashboard/layout.tsx', layout);
fs.writeFileSync('src/app/login/page.tsx',        login);
fs.writeFileSync('src/app/register/page.tsx',     register);
fs.writeFileSync('src/components/Sidebar.tsx',    sidebar);

console.log('Done - all 4 files written');
