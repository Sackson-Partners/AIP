"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Lock, Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { getDashboardPath } from "@/lib/auth/role-dashboard"

function getStrength(p: string): number {
  if (!p) return 0
  if (p.length < 8) return 1
  const checks = [/[A-Z]/, /[a-z]/, /[0-9]/, /[@$!%*?&]/]
  const score = checks.filter((r) => r.test(p)).length
  if (p.length >= 12 && score === 4) return 4
  if (score >= 3) return 3
  return 2
}

const STRENGTH_LABELS = ["", "Too weak", "Weak", "Good", "Strong"]
const STRENGTH_COLORS = ["", "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500"]
const STRENGTH_TEXT   = ["", "text-red-400", "text-orange-400", "text-yellow-400", "text-green-400"]

function Req({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 text-xs ${ok ? "text-green-400" : "text-slate-500"}`}>
      {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      {label}
    </div>
  )
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className="block text-sm text-slate-400 mb-1.5">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required
          className="w-full bg-slate-800/60 border border-slate-700 rounded-xl py-3 pl-10 pr-12 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

export default function ChangePasswordPage() {
  const { data: session, update } = useSession()
  const router = useRouter()

  const [current, setCurrent]   = useState("")
  const [next, setNext]         = useState("")
  const [confirm, setConfirm]   = useState("")
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState(false)

  const strength = getStrength(next)
  const reqs = [
    { ok: next.length >= 12,    label: "At least 12 characters" },
    { ok: /[A-Z]/.test(next),   label: "One uppercase letter" },
    { ok: /[a-z]/.test(next),   label: "One lowercase letter" },
    { ok: /[0-9]/.test(next),   label: "One number" },
    { ok: /[@$!%*?&]/.test(next), label: "One special character (@$!%*?&)" },
  ]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (next !== confirm) { setError("Passwords do not match"); return }
    setLoading(true)
    setError(null)

    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next, confirmPassword: confirm }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) { setError(data.error ?? "Failed to change password"); return }

    setSuccess(true)
    await update() // refresh session to clear mustChangePass
    const path = getDashboardPath(session?.user?.role ?? "")
    setTimeout(() => router.push(path), 1500)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-8 border-b border-white/10 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 mb-4">
            <Lock className="w-5 h-5 text-blue-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Change Password</h1>
          <p className="text-slate-400 text-sm mt-1">You must set a new password before continuing</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-300 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-green-300 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Password updated — redirecting…
            </div>
          )}

          <PasswordField
            label="Current Password"
            value={current}
            onChange={setCurrent}
            placeholder="Enter current password"
          />

          <div>
            <PasswordField
              label="New Password"
              value={next}
              onChange={setNext}
              placeholder="Enter new password"
            />
            {/* Strength bar */}
            {next && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all ${
                        i <= strength ? STRENGTH_COLORS[strength] : "bg-slate-700"
                      }`}
                    />
                  ))}
                </div>
                <span className={`text-xs ${STRENGTH_TEXT[strength]}`}>
                  {STRENGTH_LABELS[strength]}
                </span>
              </div>
            )}
          </div>

          <PasswordField
            label="Confirm New Password"
            value={confirm}
            onChange={setConfirm}
            placeholder="Confirm new password"
          />

          {/* Requirements checklist */}
          <div className="bg-slate-800/40 rounded-xl p-4 space-y-1.5">
            {reqs.map((r) => <Req key={r.label} ok={r.ok} label={r.label} />)}
          </div>

          <button
            type="submit"
            disabled={loading || success || reqs.some((r) => !r.ok)}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Update Password
          </button>
        </form>
      </div>
    </div>
  )
}
