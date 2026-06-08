'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, FileText, Users, Building2, X } from 'lucide-react'
import { api } from '@/lib/api'

interface SearchResult {
  id: string
  type: 'project' | 'investor' | 'user'
  link: string
  title?: string
  name?: string
  email?: string
  description?: string
  country?: string
  sector?: string
  organization?: string
  role?: string
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Search function with debounce
  const search = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([])
      return
    }

    setIsLoading(true)
    try {
      const res = await api.get<{
        data: {
          projects: any[]
          investors: any[]
          users: any[]
        }
      }>(`/search?q=${encodeURIComponent(searchQuery)}&limit=8`)

      const allResults: SearchResult[] = [
        ...res.data.data.projects,
        ...res.data.data.investors,
        ...res.data.data.users,
      ]

      setResults(allResults)
      setSelectedIndex(0)
    } catch (err) {
      console.error('Search failed:', err)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) {
        search(query)
      } else {
        setResults([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, search])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => (i + 1) % results.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => (i - 1 + results.length) % results.length)
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault()
        router.push(results[selectedIndex].link)
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, results, selectedIndex, router, onClose])

  // Reset on open/close
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
    }
  }, [isOpen])

  if (!isOpen) return null

  const getIcon = (type: string) => {
    switch (type) {
      case 'project':
        return <FileText className="w-4 h-4" />
      case 'investor':
        return <Building2 className="w-4 h-4" />
      case 'user':
        return <Users className="w-4 h-4" />
      default:
        return <Search className="w-4 h-4" />
    }
  }

  const getLabel = (result: SearchResult) => {
    if (result.type === 'project') return result.title || 'Untitled Project'
    if (result.type === 'investor') return result.name || result.email || 'Unknown Investor'
    if (result.type === 'user') return result.name || result.email || 'Unknown User'
    return 'Unknown'
  }

  const getSubtitle = (result: SearchResult) => {
    if (result.type === 'project') {
      return [result.country, result.sector].filter(Boolean).join(' • ')
    }
    if (result.type === 'investor') {
      return [result.country, result.email].filter(Boolean).join(' • ')
    }
    if (result.type === 'user') {
      return [result.role, result.organization].filter(Boolean).join(' • ')
    }
    return ''
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Command Palette */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] pointer-events-none">
        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl pointer-events-auto">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-800">
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects, investors, users..."
              className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none text-lg"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <kbd className="px-2 py-1 text-xs text-slate-500 bg-slate-800 rounded border border-slate-700">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-slate-400 text-sm">
                Searching...
              </div>
            ) : query.length < 2 ? (
              <div className="px-4 py-8 text-center text-slate-500 text-sm">
                Type at least 2 characters to search
              </div>
            ) : results.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-400 text-sm">
                No results found for &quot;{query}&quot;
              </div>
            ) : (
              <div className="py-2">
                {results.map((result, index) => (
                  <button
                    key={result.id}
                    onClick={() => {
                      router.push(result.link)
                      onClose()
                    }}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                      index === selectedIndex
                        ? 'bg-blue-500/20 border-l-2 border-blue-500'
                        : 'hover:bg-slate-800/50 border-l-2 border-transparent'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        result.type === 'project'
                          ? 'bg-blue-500/20 text-blue-400'
                          : result.type === 'investor'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-purple-500/20 text-purple-400'
                      }`}
                    >
                      {getIcon(result.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white truncate">
                          {getLabel(result)}
                        </p>
                        <span className="text-xs text-slate-500 uppercase shrink-0">
                          {result.type}
                        </span>
                      </div>
                      {getSubtitle(result) && (
                        <p className="text-sm text-slate-400 truncate mt-0.5">
                          {getSubtitle(result)}
                        </p>
                      )}
                      {result.description && (
                        <p className="text-xs text-slate-500 truncate mt-1">
                          {result.description}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 text-xs text-slate-500">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700">↓</kbd>
                <span className="ml-1">Navigate</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700">↵</kbd>
                <span className="ml-1">Select</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700">ESC</kbd>
              <span className="ml-1">Close</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
