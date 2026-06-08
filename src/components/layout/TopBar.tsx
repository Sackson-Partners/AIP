"use client"

import { useState, useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import { Bell, LogOut, User, Settings } from "lucide-react"
import Link from "next/link"

interface Notification {
  id: string
  title: string
  message: string
  read: boolean
  createdAt: string
  link?: string
}

export function TopBar() {
  const { data: session } = useSession()
  const [showNotifs, setShowNotifs] = useState(false)
  const [showUser, setShowUser]     = useState(false)
  const [notifs, setNotifs]         = useState<Notification[]>([])
  const [unread, setUnread]         = useState(0)

  useEffect(() => {
    const loadNotifications = () => {
      fetch("/api/notifications")
        .then((r) => r.json())
        .then((d) => {
          setNotifs(d.notifications ?? [])
          setUnread(d.unreadCount ?? 0)
        })
        .catch(() => {})
    }

    loadNotifications()
    // Poll every 30 seconds for new notifications
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH" })
    setUnread(0)
    setNotifs((n) => n.map((x) => ({ ...x, read: true })))
  }

  const initials =
    (
      (session?.user?.firstName?.[0] ?? "") +
      (session?.user?.lastName?.[0] ?? "") ||
      session?.user?.email?.[0]?.toUpperCase()
    ) ?? "U"

  return (
    <header className="h-14 bg-slate-950 border-b border-slate-800/50 flex items-center justify-between px-6 shrink-0">
      <span className="font-bold text-white tracking-tight">AIP Platform</span>

      <div className="flex items-center gap-3 relative">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setShowNotifs(!showNotifs); setShowUser(false) }}
            className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
          >
            <Bell className="w-4 h-4" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-10 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                <span className="text-white text-sm font-medium">Notifications</span>
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-blue-400 hover:text-blue-300 text-xs">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifs.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-8">No notifications</p>
                ) : notifs.slice(0, 5).map((n) => (
                  <Link
                    key={n.id}
                    href={n.link ?? "#"}
                    onClick={() => setShowNotifs(false)}
                    className={`block px-4 py-3 hover:bg-slate-800/50 transition border-b border-slate-800/50 ${!n.read ? "bg-blue-500/5" : ""}`}
                  >
                    <p className={`text-sm ${n.read ? "text-slate-300" : "text-white font-medium"}`}>{n.title}</p>
                    <p className="text-slate-500 text-xs mt-0.5 line-clamp-1">{n.message}</p>
                    <p className="text-slate-600 text-xs mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>
                  </Link>
                ))}
              </div>
              <Link href="/notifications" onClick={() => setShowNotifs(false)}
                className="block text-center py-3 text-blue-400 hover:text-blue-300 text-xs border-t border-slate-800">
                View all notifications
              </Link>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => { setShowUser(!showUser); setShowNotifs(false) }}
            className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-xs font-bold hover:bg-blue-600/30 transition"
          >
            {initials}
          </button>

          {showUser && (
            <div className="absolute right-0 top-10 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800">
                <p className="text-white text-sm font-medium truncate">
                  {session?.user?.firstName
                    ? `${session.user.firstName} ${session.user.lastName ?? ""}`
                    : session?.user?.email}
                </p>
                <p className="text-slate-500 text-xs truncate">{session?.user?.email}</p>
              </div>
              <div className="py-1">
                <Link href="/dashboard/profile" onClick={() => setShowUser(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-slate-400 hover:text-white hover:bg-slate-800/50 text-sm transition">
                  <User className="w-4 h-4" /> Profile
                </Link>
                <Link href="/dashboard/settings" onClick={() => setShowUser(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-slate-400 hover:text-white hover:bg-slate-800/50 text-sm transition">
                  <Settings className="w-4 h-4" /> Settings
                </Link>
                <div className="border-t border-slate-800 my-1" />
                <button
                  onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-400 hover:text-white hover:bg-slate-800/50 text-sm transition"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
