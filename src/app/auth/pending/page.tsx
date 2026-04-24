import Link from "next/link"
import { Clock, Mail } from "lucide-react"

export default function PendingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-10 text-center shadow-2xl">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-6">
          <Clock className="w-8 h-8 text-amber-400" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">Account Under Review</h1>
        <p className="text-slate-400 mb-2">
          Your account is pending approval by an administrator.
        </p>
        <p className="text-slate-400 mb-6">
          You&apos;ll receive an email once approved.
        </p>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-6 text-sm text-slate-400">
          Expected review time: <span className="text-white font-medium">1–2 business days</span>
        </div>

        <div className="flex items-center justify-center gap-2 text-slate-500 text-sm mb-8">
          <Mail className="w-4 h-4" />
          <span>
            Questions?{" "}
            <a href="mailto:support@aip.com" className="text-blue-400 hover:text-blue-300">
              support@aip.com
            </a>
          </span>
        </div>

        <Link
          href="/auth/signin"
          className="block w-full py-3 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition text-sm font-medium"
        >
          Back to Sign In
        </Link>
      </div>
    </div>
  )
}
