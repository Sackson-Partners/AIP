"use client"

import { Suspense, useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Building2,
  Globe,
  Shield,
  Mail,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  AlertCircle,
  ArrowRight,
  Loader2,
} from "lucide-react"

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "Invalid email or password.",
  ACCOUNT_SUSPENDED:   "Account suspended. Contact support.",
  ACCOUNT_DEACTIVATED: "Account has been deactivated.",
  ACCOUNT_PENDING:     "Account pending admin approval.",
  USE_AZURE_LOGIN:     "Please use Microsoft sign-in for this account.",
  TOTP_REQUIRED:       "Enter your authentication code below.",
  INVALID_TOTP:        "Invalid authentication code.",
  EMAIL_PASSWORD_REQUIRED: "Please enter your email and password.",
  OAuthSignin:         "Error initiating Microsoft sign-in.",
  OAuthCallback:       "Authentication error. Please try again.",
  AccountBlocked:      "Account blocked. Contact support.",
  Default:             "Sign-in error. Please try again.",
}

type Tab = "azure" | "internal"

function SignInContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard"

  const [tab, setTab]           = useState<Tab>("azure")
  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [totp, setTotp]         = useState("")
  const [showPass, setShowPass] = useState(false)
  const [showTotp, setShowTotp] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  // Read ?error= from URL on mount
  useEffect(() => {
    const err = searchParams.get("error")
    if (err) {
      setError(ERROR_MESSAGES[err] ?? ERROR_MESSAGES.Default)
      if (err === "TOTP_REQUIRED") setShowTotp(true)
    }
  }, [searchParams])

  async function handleMicrosoftSignIn() {
    setLoading(true)
    setError(null)
    await signIn("azure-ad", { callbackUrl })
  }

  async function handleInternalSignIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await signIn("internal-credentials", {
      redirect: false,
      email,
      password,
      totp,
    })

    setLoading(false)

    if (result?.error) {
      const msg = ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.Default
      setError(msg)
      if (result.error === "TOTP_REQUIRED") setShowTotp(true)
      return
    }

    router.push(callbackUrl)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4 relative overflow-hidden">
      {/* Decorative background circles */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-blue-600/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-indigo-600/5 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="p-8 pb-6 text-center border-b border-white/10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 mb-4 shadow-lg shadow-blue-600/30">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">AIP Platform</h1>
            <p className="text-slate-400 text-sm mt-1">Africa Infrastructure Pipeline</p>
          </div>

          {/* Tab toggle */}
          <div className="px-8 pt-6">
            <div className="flex bg-slate-800/60 rounded-xl p-1 gap-1">
              {(["azure", "internal"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setError(null) }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    tab === t
                      ? "bg-blue-600 text-white shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {t === "azure" ? <Globe className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                  {t === "azure" ? "Microsoft Sign In" : "Internal Access"}
                </button>
              ))}
            </div>
          </div>

          <div className="p-8 pt-6">
            {/* Error alert */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-red-300 text-sm">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {tab === "azure" ? (
                <motion.div
                  key="azure"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Microsoft button */}
                  <button
                    onClick={handleMicrosoftSignIn}
                    disabled={loading}
                    className="group w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl font-medium text-white transition-all duration-200 disabled:opacity-50"
                    style={{ background: "#2F2F2F" }}
                    onMouseEnter={(e) => {
                      if (!loading) (e.currentTarget as HTMLElement).style.background = "#1a1a1a"
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "#2F2F2F"
                    }}
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        {/* Microsoft logo */}
                        <svg width="20" height="20" viewBox="0 0 21 21">
                          <rect x="1"  y="1"  width="9" height="9" fill="#f35325" />
                          <rect x="11" y="1"  width="9" height="9" fill="#81bc06" />
                          <rect x="1"  y="11" width="9" height="9" fill="#05a6f0" />
                          <rect x="11" y="11" width="9" height="9" fill="#ffba08" />
                        </svg>
                        <span>Continue with Microsoft</span>
                        <ArrowRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>

                  {/* Supported users */}
                  <div className="mt-6 space-y-2">
                    <p className="text-slate-500 text-xs text-center mb-3">Supported account types</p>
                    {[
                      ["🏛️", "Governments & PPP Units"],
                      ["🏗️", "Sponsors & Developers"],
                      ["⚙️", "EPCs & Operators"],
                      ["💼", "Institutional Investors"],
                    ].map(([icon, label]) => (
                      <div key={label} className="flex items-center gap-2 text-slate-400 text-sm">
                        <span>{icon}</span>
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>

                  <p className="mt-6 text-center text-sm text-slate-500">
                    Don&apos;t have access?{" "}
                    <a href="/auth/register" className="text-blue-400 hover:text-blue-300">
                      Request access
                    </a>
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="internal"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Internal badge */}
                  <div className="flex flex-col items-center mb-6">
                    <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 text-amber-400 text-sm font-medium">
                      <Shield className="w-3.5 h-3.5" />
                      Internal Staff Access
                    </div>
                    <p className="text-slate-500 text-xs mt-2">Super Admins &amp; Analysts only</p>
                  </div>

                  <form onSubmit={handleInternalSignIn} className="space-y-4">
                    {/* Email */}
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email address"
                        required
                        className="w-full bg-slate-800/60 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
                      />
                    </div>

                    {/* Password */}
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type={showPass ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        required
                        className="w-full bg-slate-800/60 border border-slate-700 rounded-xl py-3 pl-10 pr-12 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* TOTP (conditional) */}
                    <AnimatePresence>
                      {showTotp && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="relative"
                        >
                          <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input
                            type="text"
                            value={totp}
                            onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                            placeholder="6-digit code"
                            maxLength={6}
                            inputMode="numeric"
                            className="w-full bg-slate-800/60 border border-blue-500/50 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 text-sm text-center font-mono tracking-[0.5em] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Sign In Securely
                    </button>
                  </form>

                  <p className="mt-4 text-center text-xs text-slate-500">
                    Support:{" "}
                    <a href="mailto:it@aip.com" className="text-blue-400 hover:text-blue-300">
                      it@aip.com
                    </a>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-8 pb-6 text-center border-t border-white/5 pt-4">
            <p className="text-slate-600 text-xs">
              Protected by Azure Entra ID &amp; Enterprise Security
            </p>
            <p className="text-slate-700 text-xs mt-1">
              © {new Date().getFullYear()} AIP Platform
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  )
}
