'use client';

import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

interface LoginForm {
  email: string;
  password: string;
}

function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const callbackError = searchParams.get('error');
  const [error, setError] = useState<string | null>(callbackError);
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
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600 mb-4">
            <span className="text-2xl font-bold text-white">A</span>
          </div>
          <h2 className="text-2xl font-bold text-white">Sign in to your account</h2>
          <p className="mt-2 text-gray-400">
            Or{' '}
            <Link href="/register" className="text-blue-400 hover:text-blue-300">
              create a new account
            </Link>
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Email address
            </label>
            <input
              {...register('email', { required: 'Email is required' })}
              type="email"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@example.com"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <input
              {...register('password', { required: 'Password is required' })}
              type="password"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
            )}
          </div>

          <div className="flex items-center justify-end">
            <Link href="#" className="text-sm text-blue-400 hover:text-blue-300">
              Forgot your password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium rounded-lg transition-colors"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                Signing in...
              </span>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-gray-600">
          <a href="https://www.africa-infra.com" className="hover:text-gray-500 transition-colors">www.africa-infra.com</a>
          {' · '}AIP — Africa Infrastructure Partners
        </p>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
