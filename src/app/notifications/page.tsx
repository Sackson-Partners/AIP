'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import Link from 'next/link'
import { Bell, CheckCheck, Trash2 } from 'lucide-react'

interface Notification {
  id: string
  title: string
  message: string
  type: string
  link?: string | null
  read: boolean
  readAt?: string | null
  createdAt: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const load = async () => {
    try {
      const endpoint = filter === 'unread' ? '/notifications?unread=true' : '/notifications'
      const res = await api.get<{
        data: Notification[]
        unreadCount: number
      }>(endpoint)
      setNotifications(res.data.data ?? [])
      setUnreadCount(res.data.unreadCount ?? 0)
    } catch (err) {
      console.error('Failed to load notifications:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
    // Poll every 30 seconds for new notifications
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [filter])

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}`)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n))
      )
      setUnreadCount((c) => Math.max(0, c - 1))
    } catch (err) {
      console.error('Failed to mark as read:', err)
    }
  }

  const markAllRead = async () => {
    try {
      await api.patch('/notifications')
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() })))
      setUnreadCount(0)
    } catch (err) {
      console.error('Failed to mark all as read:', err)
    }
  }

  const deleteNotification = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`)
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    } catch (err) {
      console.error('Failed to delete notification:', err)
    }
  }

  const filteredNotifications = notifications

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold text-white">Notifications</h1>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'unread'
                ? 'bg-blue-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-slate-400 text-sm">Loading notifications...</div>
      ) : filteredNotifications.length === 0 ? (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-12 text-center">
          <Bell className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 text-lg">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </p>
          <p className="text-slate-500 text-sm mt-2">
            {filter === 'unread'
              ? "You're all caught up!"
              : "You'll be notified when something important happens"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`bg-slate-800/40 border rounded-xl p-5 transition-all ${
                notification.read
                  ? 'border-slate-700/50'
                  : 'border-blue-500/30 bg-blue-500/5'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3
                      className={`font-semibold ${
                        notification.read ? 'text-slate-300' : 'text-white'
                      }`}
                    >
                      {notification.title}
                    </h3>
                    {!notification.read && (
                      <span className="bg-blue-500 w-2 h-2 rounded-full shrink-0"></span>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm mb-3">{notification.message}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>{new Date(notification.createdAt).toLocaleString()}</span>
                    <span className="text-slate-600">•</span>
                    <span className="uppercase">{notification.type}</span>
                  </div>
                  {notification.link && (
                    <Link
                      href={notification.link}
                      className="inline-block mt-3 text-blue-400 hover:text-blue-300 text-sm font-medium"
                    >
                      View details →
                    </Link>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  {!notification.read && (
                    <button
                      onClick={() => markAsRead(notification.id)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                      title="Mark as read"
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(notification.id)}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
