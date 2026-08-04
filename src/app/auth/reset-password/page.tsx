// src/app/auth/reset-password/page.tsx
// MIGRATED: Supabase code exchange → NextAuth change-password flow
// Internal users: redirected to /auth/change-password
// Azure AD users: redirected to Microsoft account management

'use client'

import { useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { Building2, Loader2, Shield, Globe } from 'lucide-react'
import Link from 'next/link'

function ResetPasswordInner() {
  const router = useRouter()
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status === 'loading') return

    if (session) {
      // Logged in internal user → force change password
      if (session.user.authProvider === 'INTERNAL') {
        router.push('/auth/change-password')
        return
      }
      // Logged in Azure AD user → go to dashboard
      router.push('/dashboard')
      return
    }

    // Not logged in → go to sign in
    router.push('/auth/signin')
  }, [session, status, router])

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm text-center"
      >
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30 mx-auto mb-6">
          <Building2 className="w-6 h-6 text-white" />
        </div>

        <Loader2 className="w-6 h-6 text-slate-400 animate-spin mx-auto mb-3" />
        <p className="text-white font-semibold mb-1">Redirecting...</p>
        <p className="text-slate-400 text-sm mb-8">Setting up your password reset</p>

        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 space-y-3 text-left">
          <div className="flex items-start gap-3">
            <Globe className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-slate-200 text-xs font-semibold">Microsoft Account</p>
              <p className="text-slate-400 text-xs">Reset at account.microsoft.com</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Shield className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-slate-200 text-xs font-semibold">Internal Account</p>
              <p className="text-slate-400 text-xs">
                Contact{' '}
                <a href="mailto:support@africa-infra.com" className="text-blue-400 hover:underline">
                  support@africa-infra.com
                </a>
              </p>
            </div>
          </div>
        </div>

        <Link
          href="/auth/signin"
          className="mt-6 inline-block text-slate-400 hover:text-white text-sm transition-colors"
        >
          ← Back to Sign In
        </Link>
      </motion.div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
        </div>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  )
}
