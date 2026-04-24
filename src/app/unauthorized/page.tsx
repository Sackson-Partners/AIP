"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { ShieldX } from "lucide-react"
import { getDashboardPath } from "@/lib/auth/role-dashboard"

export default function UnauthorizedPage() {
  const { data: session } = useSession()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-10 text-center shadow-2xl">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 mb-6">
          <ShieldX className="w-8 h-8 text-red-400" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">Access Denied</h1>
        <p className="text-slate-400 mb-3">
          You don&apos;t have permission to access this page.
        </p>

        {session?.user?.role && (
          <p className="text-sm text-slate-500 mb-8">
            Your current role:{" "}
            <span className="text-slate-300 font-medium">
              {session.user.role.replace(/_/g, " ")}
            </span>
          </p>
        )}

        <div className="flex flex-col gap-3">
          <Link
            href={getDashboardPath(session?.user?.role ?? "")}
            className="block w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition text-sm"
          >
            Go to My Dashboard
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            className="w-full py-3 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition text-sm"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
