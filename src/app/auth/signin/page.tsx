"use client"

import { Suspense, useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import {
  Globe,
  Shield,
  Mail,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  AlertCircle,
  LockKeyhole,
  ArrowRight,
  Loader2,
  Users,
  CheckCircle2,
} from "lucide-react"

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS:     "Invalid email or password.",
  ACCOUNT_SUSPENDED:       "Account suspended. Contact support.",
  ACCOUNT_DEACTIVATED:     "Account has been deactivated.",
  ACCOUNT_PENDING:         "Account pending admin approval.",
  USE_AZURE_LOGIN:         "Please use Microsoft sign-in for this account.",
  TOTP_REQUIRED:           "Enter your authentication code below.",
  INVALID_TOTP:            "Invalid authentication code.",
  EMAIL_PASSWORD_REQUIRED: "Please enter your email and password.",
  OAuthSignin:             "Error initiating Microsoft sign-in.",
  OAuthCallback:           "Authentication error. Please try again.",
  AccountBlocked:          "Account blocked. Contact support.",
  ACCOUNT_LOCKED:          "Your account has been temporarily locked for 15 minutes due to too many failed sign-in attempts. Please try again later or contact your administrator.",
  CredentialsSignin:       "Invalid email or password. Please check your credentials and try again.",
  AccessDenied:            "You do not have permission to access this application. Contact your administrator.",
  Default:                 "Sign-in error. Please try again.",
}

type Tab = "azure" | "partner" | "internal"

function CredentialForm({
  onSubmit,
  email, setEmail,
  password, setPassword,
  totp, setTotp,
  showPass, setShowPass,
  showTotp,
  loading,
}: {
  onSubmit: (e: React.FormEvent) => void
  email: string; setEmail: (v: string) => void
  password: string; setPassword: (v: string) => void
  totp: string; setTotp: (v: string) => void
  showPass: boolean; setShowPass: (v: boolean) => void
  showTotp: boolean
  loading: boolean
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
  )
}

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
  const [errorCode, setErrorCode] = useState<string | null>(null)

  useEffect(() => {
    const err = searchParams.get("error")
    if (err) {
      setErrorCode(err)
      setError(ERROR_MESSAGES[err] ?? ERROR_MESSAGES.Default)
      if (err === "TOTP_REQUIRED") setShowTotp(true)
    }
  }, [searchParams])

  function clearError() {
    setError(null)
    setErrorCode(null)
  }

  async function handleMicrosoftSignIn() {
    setLoading(true)
    clearError()
    await signIn("azure-ad", { callbackUrl })
  }

  async function handleCredentialSignIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    clearError()

    const result = await signIn("internal-credentials", {
      redirect: false,
      email,
      password,
      totp,
    })

    setLoading(false)

    if (result?.error) {
      setErrorCode(result.error)
      setError(ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.Default)
      if (result.error === "TOTP_REQUIRED") setShowTotp(true)
      return
    }

    router.push(callbackUrl)
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "azure",    label: "Microsoft",  icon: <Globe className="w-4 h-4" /> },
    { id: "partner",  label: "Partners",   icon: <Users className="w-4 h-4" /> },
    { id: "internal", label: "Staff",      icon: <Shield className="w-4 h-4" /> },
  ]

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT: Login panel (dark blue) ─────────────────────────────── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-8 relative overflow-hidden">
        {/* Background glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-blue-600/8 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-indigo-600/8 blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md relative z-10"
        >
          {/* Mobile-only logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center bg-white rounded-xl px-4 py-2 shadow-md mb-3">
              <Image src="/aip-logo.jpeg" alt="Africa Infrastructure Partners" width={160} height={60} className="object-contain" />
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            {/* Form header */}
            <div className="p-8 pb-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">Welcome back</h2>
              <p className="text-slate-400 text-sm mt-1">Sign in to access your dashboard</p>
            </div>

            {/* Tabs */}
            <div className="px-8 pt-6">
              <div className="flex bg-slate-800/60 rounded-xl p-1 gap-1">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setTab(t.id); clearError() }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                      tab === t.id
                        ? "bg-blue-600 text-white shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-8 pt-6">
              {/* Error alert */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    role="alert"
                    aria-live="assertive"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`flex items-start gap-3 rounded-xl p-4 mb-6 border ${
                      errorCode === "ACCOUNT_LOCKED"
                        ? "bg-red-500/10 border-red-500/20"
                        : "bg-amber-500/10 border-amber-500/20"
                    }`}
                  >
                    {errorCode === "ACCOUNT_LOCKED"
                      ? <LockKeyhole className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                      : <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    }
                    <p className={`text-sm ${errorCode === "ACCOUNT_LOCKED" ? "text-red-300" : "text-amber-300"}`}>
                      {error}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {/* ── Microsoft tab ─────────────────────────────────────── */}
                {tab === "azure" && (
                  <motion.div
                    key="azure"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <button
                      onClick={handleMicrosoftSignIn}
                      disabled={loading}
                      className="group w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl font-medium text-white transition-all duration-200 disabled:opacity-50"
                      style={{ background: "#2F2F2F" }}
                      onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.background = "#1a1a1a" }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#2F2F2F" }}
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
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

                    <div className="mt-6 space-y-2">
                      <p className="text-slate-500 text-xs text-center mb-3">Sign in with your organisation Microsoft account</p>
                      {[
                        ["🏛️", "Governments & PPP Units"],
                        ["🏗️", "Sponsors & Developers"],
                        ["⚙️",  "EPCs & Operators"],
                        ["💼", "Institutional Investors"],
                        ["🔒", "AIP Internal Staff"],
                      ].map(([icon, label]) => (
                        <div key={label} className="flex items-center gap-2 text-slate-400 text-sm">
                          <span>{icon}</span>
                          <span>{label}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ── Partners tab ──────────────────────────────────────── */}
                {tab === "partner" && (
                  <motion.div
                    key="partner"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex flex-col items-center mb-6">
                      <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 text-blue-400 text-sm font-medium">
                        <Users className="w-3.5 h-3.5" />
                        Partner Portal Access
                      </div>
                      <p className="text-slate-500 text-xs mt-2">Governments · Investors · Sponsors · EPCs</p>
                    </div>

                    <CredentialForm
                      onSubmit={handleCredentialSignIn}
                      email={email} setEmail={setEmail}
                      password={password} setPassword={setPassword}
                      totp={totp} setTotp={setTotp}
                      showPass={showPass} setShowPass={setShowPass}
                      showTotp={showTotp}
                      loading={loading}
                    />

                    <p className="mt-4 text-center text-xs text-slate-500">
                      Credentials issued by AIP administration.
                    </p>
                  </motion.div>
                )}

                {/* ── Internal staff tab ────────────────────────────────── */}
                {tab === "internal" && (
                  <motion.div
                    key="internal"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex flex-col items-center mb-6">
                      <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 text-amber-400 text-sm font-medium">
                        <Shield className="w-3.5 h-3.5" />
                        Internal Staff Access
                      </div>
                      <p className="text-slate-500 text-xs mt-2">Super Admins &amp; Analysts only</p>
                    </div>

                    <CredentialForm
                      onSubmit={handleCredentialSignIn}
                      email={email} setEmail={setEmail}
                      password={password} setPassword={setPassword}
                      totp={totp} setTotp={setTotp}
                      showPass={showPass} setShowPass={setShowPass}
                      showTotp={showTotp}
                      loading={loading}
                    />

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

      {/* ── RIGHT: Branding panel (white) ──────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-white px-16 relative overflow-hidden">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-blue-50 -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-slate-50 translate-y-1/2 -translate-x-1/2" />
          {/* Grid dots */}
          <svg className="absolute inset-0 w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="#cbd5e1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="relative z-10 max-w-sm text-center"
        >
          {/* Logo */}
          <div className="flex items-center justify-center mb-10">
            <Image
              src="/aip-logo.jpeg"
              alt="Africa Infrastructure Partners"
              width={320}
              height={120}
              className="object-contain"
              priority
            />
          </div>

          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            A secure intelligence platform connecting governments, investors, and developers
            to accelerate bankable infrastructure projects across Africa.
          </p>

          {/* Feature list */}
          <div className="mt-8 space-y-3 text-left">
            {[
              "Project discovery & deal pipeline",
              "AI-powered investment analysis",
              "Verified project information sheets",
              "Secure multi-party data rooms",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="text-sm text-slate-600">{item}</span>
              </div>
            ))}
          </div>

          {/* Request access CTA */}
          <div className="mt-10 p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-sm text-slate-600 font-medium">
              Don&apos;t have an account yet?
            </p>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Access is by invitation only. Submit a request and our team will be in touch.
            </p>
            <a
              href="/request-access"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors shadow-sm shadow-blue-200"
            >
              Request an Invitation
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          <p className="text-xs text-slate-400 mt-6">
            © {new Date().getFullYear()} AIP Platform · All rights reserved
          </p>
        </motion.div>
      </div>

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
