'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    const origin = window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/reset-password`,
    });
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">

          <div className="flex justify-center mb-6">
            <Image
              src="/logo.png"
              alt="Africa Infrastructure Partners"
              width={160}
              height={42}
              className="h-10 w-auto"
              priority
            />
          </div>

          {sent ? (
            <div className="text-center">
              <h2 className="text-2xl font-bold text-brand-navy mb-3">Check your email</h2>
              <p className="text-sm text-gray-500 mb-6">
                We sent a password reset link to <strong>{email}</strong>.
                Check your inbox and spam folder.
              </p>
              <Link href="/login" className="text-sm text-brand-gold hover:text-brand-gold-dark font-medium transition-colors">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-brand-navy">Reset your password</h2>
                <p className="mt-1.5 text-sm text-gray-500">
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold transition-colors"
                    placeholder="you@example.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-brand-gold hover:bg-brand-gold-dark disabled:opacity-60 text-brand-navy font-semibold rounded-lg transition-colors"
                >
                  {isLoading ? 'Sending...' : 'Send reset link'}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-gray-500">
                <Link href="/login" className="text-brand-gold hover:text-brand-gold-dark font-medium transition-colors">
                  Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          <a href="https://www.africa-infra.com" className="hover:text-gray-600 transition-colors">
            www.africa-infra.com
          </a>
        </p>
      </div>
    </div>
  );
}
