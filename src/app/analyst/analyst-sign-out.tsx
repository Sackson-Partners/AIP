"use client"

import { signOut } from "next-auth/react"
import { LogOut } from "lucide-react"

export function AnalystSignOut() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/auth/signin" })}
      className="w-full flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-white hover:bg-slate-800/50 rounded-lg text-xs transition"
    >
      <LogOut className="w-3.5 h-3.5" />
      Sign Out
    </button>
  )
}
