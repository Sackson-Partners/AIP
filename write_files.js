const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Written:', filePath);
}

// dashboard/layout.tsx
write('src/app/dashboard/layout.tsx', `'use client';

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
`);

// login/page.tsx
write('src/app/login/page.tsx', `'use client';

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
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { login }    = useAuth();
  const [error, setError]         = useState(null);
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
    
      
        
          Sign in to your account
        
        
          Or{' '}
          
            create a new account
          
        
      
      
        
          
            {error && (
              
                {error}
              
            )}
            
              
                Email address
              
              
                
                {errors.email && (
                  {errors.email.message}
                )}
              
            
            
              
                Password
              
              
                
                {errors.password && (
                  {errors.password.message}
                )}
              
            
            
              
                {isLoading ? 'Signing in...' : 'Sign in'}
              
            
          
        
      
    
  );
}
`);

// register/page.tsx
write('src/app/register/page.tsx', `'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

interface RegisterForm {
  email: string;
  full_name: string;
  phone?: string;
  password: string;
  confirmPassword: string;
}

export default function Register() {
  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const router   = useRouter();
  const { register: registerUser } = useAuth();
  const [error, setError]         = useState(null);
  const [success, setSuccess]     = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const password = watch('password');

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    setError(null);
    try {
      await registerUser(data.email, data.password, data.full_name, data.phone);
      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      
        
          ✓
          Account Created
          Check your email to confirm your account. Redirecting...
        
      
    );
  }

  return (
    
      
        
          Create your account
        
        
          Or{' '}
          
            sign in to existing account
          
        
      
      
        
          
            {error && (
              
                {error}
              
            )}
            
              
                Full name
              
              
                
                {errors.full_name && (
                  {errors.full_name.message}
                )}
              
            
            
              
                Email address
              
              
                
                {errors.email && (
                  {errors.email.message}
                )}
              
            
            
              
                Phone (optional)
              
              
                
              
            
            
              
                Password
              
              
                
                {errors.password && (
                  {errors.password.message}
                )}
              
            
            
              
                Confirm password
              
              
                 v === password || 'Passwords do not match',
                  })}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                {errors.confirmPassword && (
                  {errors.confirmPassword.message}
                )}
              
            
            
              
                {isLoading ? 'Creating account...' : 'Create account'}
              
            
          
        
      
    
  );
}
`);

// Sidebar.tsx
write('src/components/Sidebar.tsx', `'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRBAC, UserRole, Permission, USER_ROLES } from '@/hooks/useRBAC';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermissions?: Permission[];
  adminOnly?: boolean;
}

const navigation: NavItem[] = [
  { name: 'Dashboard',     href: '/dashboard',               icon: HomeIcon },
  { name: 'Projects',      href: '/dashboard/projects',      icon: FolderIcon,       requiredPermissions: ['view_all_projects','view_own_projects','view_curated_projects','view_approved_projects'] },
  { name: 'PIS',           href: '/dashboard/pis',           icon: FileIcon,         requiredPermissions: ['view_all_projects','view_own_projects','view_curated_projects','view_approved_projects'] },
  { name: 'PETFEL',        href: '/dashboard/petfel',        icon: ClipboardIcon,    requiredPermissions: ['run_petfel','view_petfel_full','view_petfel_summary'] },
  { name: 'EIN',           href: '/dashboard/ein',           icon: DocumentTextIcon, requiredPermissions: ['generate_ein','edit_ein','view_approved_ein','view_ein_approved_only'] },
  { name: 'Pipeline',      href: '/dashboard/pipeline',      icon: PipelineIcon,     requiredPermissions: ['view_pipeline'] },
  { name: 'IC',            href: '/dashboard/ic',            icon: GavelIcon,        requiredPermissions: ['vote_ic','manage_ic'] },
  { name: 'Investors',     href: '/dashboard/investors',     icon: UsersIcon,        requiredPermissions: ['view_all_projects','view_curated_projects'] },
  { name: 'Verifications', href: '/dashboard/verifications', icon: ShieldIcon,       requiredPermissions: ['view_all_projects','run_petfel'] },
  { name: 'Data Rooms',    href: '/dashboard/data-rooms',    icon: DatabaseIcon,     requiredPermissions: ['upload_documents','upload_own_documents'] },
  { name: 'Deal Rooms',    href: '/dashboard/deal-rooms',    icon: DealRoomIcon,     requiredPermissions: ['view_all_projects','view_approved_projects'] },
  { name: 'Analytics',     href: '/dashboard/analytics',     icon: ChartIcon,        requiredPermissions: ['view_analytics','view_all_projects'] },
  { name: 'Events',        href: '/dashboard/events',        icon: CalendarIcon,     requiredPermissions: ['view_all_projects','view_approved_projects'] },
  { name: 'Users',         href: '/dashboard/users',         icon: UserGroupIcon,    requiredPermissions: ['manage_users'], adminOnly: true },
  { name: 'Integrations',  href: '/dashboard/integrations',  icon: PuzzleIcon,       requiredPermissions: ['manage_integrations'], adminOnly: true },
];

const ROLE_BADGE_COLORS: Record = {
  admin: 'bg-red-500', analyst: 'bg-blue-500', ic_member: 'bg-purple-500',
  gov_partner: 'bg-green-500', epc: 'bg-yellow-500', investor: 'bg-teal-500', viewer: 'bg-gray-500',
};

export default function Sidebar() {
  const pathname         = usePathname();
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
    
      
        AIP Platform
      

      {user && (
        
          
            
              
                {(user.user_metadata?.full_name || user.email || 'U').charAt(0).toUpperCase()}
              
            
            
              
                {user.user_metadata?.full_name || user.email}
              
              
                {roleInfo?.displayName || role}
              
            
          
        
      )}

      
        {visibleNavigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            
              
              {item.name}
              {item.adminOnly && }
            
          );
        })}
      

      
        
          
          Sign Out
        
      
    
  );
}

function HomeIcon({ className }: { className?: string }) { return ; }
function FolderIcon({ className }: { className?: string }) { return ; }
function FileIcon({ className }: { className?: string }) { return ; }
function ClipboardIcon({ className }: { className?: string }) { return ; }
function DocumentTextIcon({ className }: { className?: string }) { return ; }
function PipelineIcon({ className }: { className?: string }) { return ; }
function GavelIcon({ className }: { className?: string }) { return ; }
function UsersIcon({ className }: { className?: string }) { return ; }
function UserGroupIcon({ className }: { className?: string }) { return ; }
function ShieldIcon({ className }: { className?: string }) { return ; }
function DatabaseIcon({ className }: { className?: string }) { return ; }
function DealRoomIcon({ className }: { className?: string }) { return ; }
function ChartIcon({ className }: { className?: string }) { return ; }
function CalendarIcon({ className }: { className?: string }) { return ; }
function PuzzleIcon({ className }: { className?: string }) { return ; }
function LockIcon({ className }: { className?: string }) { return ; }
function LogoutIcon({ className }: { className?: string }) { return ; }
`);

console.log('All files written successfully');
