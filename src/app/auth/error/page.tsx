"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "Invalid email or password.",
  ACCOUNT_SUSPENDED:   "Your account has been suspended. Contact support.",
  ACCOUNT_DEACTIVATED: "Your account has been deactivated.",
  ACCOUNT_PENDING:     "Your account is pending approval.",
  USE_AZURE_LOGIN:     "Please use Microsoft sign-in for this account.",
  TOTP_REQUIRED:       "Two-factor authentication is required.",
  INVALID_TOTP:        "Invalid authentication code.",
  OAuthSignin:         "Error initiating Microsoft sign-in.",
  OAuthCallback:       "Authentication error. Please try again.",
  AccountBlocked:      "Your account has been blocked. Contact support.",
  Configuration:       "Server configuration error. Contact support.",
  AccessDenied:        "Access denied. You do not have permission.",
  Verification:        "Verification failed. The link may have expired.",
  Default:             "An unexpected sign-in error occurred.",
}

function ErrorContent() {
  const params = useSearchParams()
  const errorCode = params.get("error") ?? "Default"
  const message = ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-10 text-center shadow-2xl">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 mb-6">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">Sign-In Failed</h1>
        <p className="text-slate-400 mb-8">{message}</p>

        <Link
          href="/auth/signin"
          className="block w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition text-sm mb-4"
        >
          Back to Sign In
        </Link>

        <p className="text-slate-600 text-xs">
          Error code:{" "}
          <code className="bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono text-xs">
            {errorCode}
          </code>
        </p>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <ErrorContent />
    </Suspense>
  )
}
