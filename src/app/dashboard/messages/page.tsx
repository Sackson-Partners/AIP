'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { PermissionGuard } from '@/components/PermissionGuard'

interface Channel {
  id: string
  type: string
  name: string | null
  description: string | null
  projectId: string | null
  memberCount: number
  lastMessage: { content: string; createdAt: string; senderId: string } | null
  lastReadAt: string | null
  role: string
}

interface Message {
  id: string
  channelId: string
  senderId: string
  content: string
  threadId: string | null
  attachmentUrl: string | null
  attachmentName: string | null
  createdAt: string
}

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  PROJECT:          'Project',
  DIRECT:           'Direct',
  GROUP:            'Group',
  PARTNER_INTERNAL: 'Partner ↔ Internal',
  GOV_INTERNAL:     'Government ↔ Internal',
}

const CHANNEL_TYPE_COLORS: Record<string, string> = {
  PROJECT:          'bg-blue-100 text-blue-700',
  DIRECT:           'bg-gray-100 text-gray-600',
  GROUP:            'bg-purple-100 text-purple-700',
  PARTNER_INTERNAL: 'bg-amber-100 text-amber-700',
  GOV_INTERNAL:     'bg-green-100 text-green-700',
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString()
}

export default function MessagesPage() {
  const { data: session } = useSession()
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingChannels, setLoadingChannels] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [newChannelForm, setNewChannelForm] = useState({ type: 'GROUP', name: '', description: '' })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch('/api/channels')
      const json = await res.json()
      setChannels(json.data ?? [])
    } catch { /* non-fatal */ }
    finally { setLoadingChannels(false) }
  }, [])

  useEffect(() => { fetchChannels() }, [fetchChannels])

  const fetchMessages = useCallback(async (channelId: string) => {
    setLoadingMessages(true)
    try {
      const res = await fetch(`/api/channels/${channelId}/messages`)
      const json = await res.json()
      setMessages(json.data ?? [])
    } catch { /* non-fatal */ }
    finally { setLoadingMessages(false) }
  }, [])

  // Poll active channel every 5s
  useEffect(() => {
    if (!activeChannel) return
    fetchMessages(activeChannel.id)

    pollRef.current = setInterval(() => {
      fetchMessages(activeChannel.id)
    }, 5000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [activeChannel, fetchMessages])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || !activeChannel || sending) return
    setSending(true)
    const content = input.trim()
    setInput('')
    try {
      const res = await fetch(`/api/channels/${activeChannel.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const json = await res.json()
      if (json.data) {
        setMessages(prev => [...prev, json.data])
      }
    } catch { /* non-fatal */ }
    finally { setSending(false) }
  }

  const createChannel = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newChannelForm),
      })
      const json = await res.json()
      if (json.data) {
        setShowNewChannel(false)
        setNewChannelForm({ type: 'GROUP', name: '', description: '' })
        await fetchChannels()
      }
    } catch { /* non-fatal */ }
  }

  const myId = session?.user?.id

  return (
    <div className="h-[calc(100vh-3.5rem)] flex gap-0 -m-4 lg:-m-6">

      {/* Sidebar — channel list */}
      <div className="w-72 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Messages</h2>
          <PermissionGuard requireAny={['message_all', 'message_partners_internal', 'message_gov_internal']}>
            <button
              onClick={() => setShowNewChannel(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition"
              title="New channel"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </PermissionGuard>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingChannels ? (
            <div className="p-4 text-center text-sm text-gray-400">Loading…</div>
          ) : channels.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-gray-400 mb-3">No channels yet</p>
              <PermissionGuard requireAny={['message_all', 'message_partners_internal', 'message_gov_internal']}>
                <button
                  onClick={() => setShowNewChannel(true)}
                  className="text-sm text-brand-gold hover:underline"
                >
                  Create one
                </button>
              </PermissionGuard>
            </div>
          ) : (
            channels.map(ch => (
              <button
                key={ch.id}
                onClick={() => setActiveChannel(ch)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition ${
                  activeChannel?.id === ch.id ? 'bg-brand-gold/5 border-l-2 border-l-brand-gold' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {ch.name ?? CHANNEL_TYPE_LABELS[ch.type] ?? ch.type}
                  </span>
                  {ch.lastMessage && (
                    <span className="text-xs text-gray-400 shrink-0 ml-2">{formatTime(ch.lastMessage.createdAt)}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${CHANNEL_TYPE_COLORS[ch.type] ?? 'bg-gray-100 text-gray-600'}`}>
                    {CHANNEL_TYPE_LABELS[ch.type] ?? ch.type}
                  </span>
                  <span className="text-xs text-gray-400">{ch.memberCount} member{ch.memberCount !== 1 ? 's' : ''}</span>
                </div>
                {ch.lastMessage && (
                  <p className="text-xs text-gray-500 truncate mt-1">{ch.lastMessage.content}</p>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main — message thread */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
        {activeChannel ? (
          <>
            {/* Channel header */}
            <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 shrink-0">
              <div>
                <h3 className="font-semibold text-gray-900">
                  {activeChannel.name ?? CHANNEL_TYPE_LABELS[activeChannel.type] ?? activeChannel.type}
                </h3>
                {activeChannel.description && (
                  <p className="text-xs text-gray-400">{activeChannel.description}</p>
                )}
              </div>
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${CHANNEL_TYPE_COLORS[activeChannel.type] ?? 'bg-gray-100 text-gray-600'}`}>
                {CHANNEL_TYPE_LABELS[activeChannel.type] ?? activeChannel.type}
              </span>
              <span className="text-xs text-gray-400">{activeChannel.memberCount} members</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingMessages ? (
                <div className="text-center text-sm text-gray-400 pt-12">Loading messages…</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-sm text-gray-400 pt-12">
                  No messages yet. Say hello!
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderId === myId
                  return (
                    <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                        isMe ? 'bg-brand-gold text-brand-navy' : 'bg-gray-300 text-gray-700'
                      }`}>
                        {msg.senderId.charAt(0).toUpperCase()}
                      </div>
                      <div className={`max-w-xs lg:max-w-md ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                        <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                          isMe
                            ? 'bg-brand-gold text-brand-navy rounded-tr-sm'
                            : 'bg-white border border-gray-200 text-gray-900 rounded-tl-sm'
                        }`}>
                          {msg.content}
                        </div>
                        {msg.attachmentUrl && (
                          <a
                            href={msg.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            {msg.attachmentName ?? 'Attachment'}
                          </a>
                        )}
                        <span className="text-xs text-gray-400">{formatTime(msg.createdAt)}</span>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="bg-white border-t border-gray-200 p-4 shrink-0">
              <div className="flex items-end gap-3">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                  placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                  rows={1}
                  className="flex-1 resize-none border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold focus:border-transparent"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  className="w-10 h-10 bg-brand-gold text-brand-navy rounded-xl flex items-center justify-center hover:bg-amber-400 transition disabled:opacity-40 shrink-0"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-700 mb-1">Select a channel</h3>
              <p className="text-sm text-gray-400">Choose a channel from the left to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* New Channel Modal */}
      {showNewChannel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">New Channel</h3>
              <button
                onClick={() => setShowNewChannel(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={createChannel} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Channel Type</label>
                <select
                  value={newChannelForm.type}
                  onChange={e => setNewChannelForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold bg-white"
                >
                  <option value="GROUP">Group Chat</option>
                  <option value="PARTNER_INTERNAL">Partner ↔ Internal</option>
                  <option value="GOV_INTERNAL">Government ↔ Internal</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Channel Name</label>
                <input
                  type="text"
                  required
                  value={newChannelForm.name}
                  onChange={e => setNewChannelForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                  placeholder="e.g. Kenya Solar Project Team"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={newChannelForm.description}
                  onChange={e => setNewChannelForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold"
                  placeholder="What's this channel for?"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewChannel(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-gold text-brand-navy font-medium rounded-lg text-sm hover:bg-amber-400 transition"
                >
                  Create Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
