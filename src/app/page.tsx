'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import LeftPanel from '../components/map/LeftPanel'
import { projects, ALL_COUNTRIES, CATEGORIES, STATUS_COLORS, COUNTRY_FLAGS } from '../data/infrastructure'
import type { FilterState, Project } from '../types'

// Leaflet must never render on the server — all imports happen inside the component
const InfrastructureMap = dynamic(
  () => import('../components/map/InfrastructureMap'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#0d1117]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-14 h-14">
            <div className="absolute inset-0 rounded-full border-4 border-brand-gold/20" />
            <div className="absolute inset-0 rounded-full border-4 border-t-brand-gold animate-spin" />
          </div>
          <p className="text-brand-gold/60 text-sm font-medium tracking-wide">Loading Africa Map…</p>
        </div>
      </div>
    ),
  }
)

const DEFAULT_FILTERS: FilterState = {
  categories: [],
  status:     'all',
  country:    'all',
}

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [filters, setFilters]           = useState<FilterState>(DEFAULT_FILTERS)
  const [mobileOpen, setMobileOpen]     = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  // Redirect authenticated users straight to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) router.push('/dashboard')
  }, [isAuthenticated, isLoading, router])

  const handleFiltersChange = useCallback((f: FilterState) => setFilters(f), [])

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      // Split active categories into infra-types and location types
      const typeIds     = filters.categories.filter(c => !['coastal', 'inland'].includes(c))
      const locationIds = filters.categories.filter(c => ['coastal', 'inland'].includes(c))

      const typeMatch     = typeIds.length === 0     || typeIds.includes(p.type)
      const locationMatch = locationIds.length === 0 || locationIds.includes(p.category)
      const statusMatch   = filters.status === 'all' || p.status  === filters.status
      const countryMatch  = filters.country === 'all'|| p.country === filters.country

      return typeMatch && locationMatch && statusMatch && countryMatch
    })
  }, [filters])

  const panelProps = {
    filters,
    onFiltersChange: handleFiltersChange,
    filteredCount: filteredProjects.length,
    totalCount: projects.length,
    countries: ALL_COUNTRIES,
  }

  // ── Auth loading ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-brand-navy">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-gold" />
      </div>
    )
  }

  if (isAuthenticated) return null

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-brand-navy">

      {/* ── Floating header ────────────────────────────────────────────── */}
      <header
        className="absolute top-0 left-0 right-0 z-[1001] flex items-center justify-between px-4 py-3"
        style={{ background: 'linear-gradient(to bottom, rgba(11,18,32,0.9) 0%, transparent 100%)' }}
      >
        <div className="flex items-center gap-3">
          <div className="bg-white rounded px-2 py-1 shrink-0">
            <Image
              src="/logo.png"
              alt="Africa Infrastructure Partners"
              width={100} height={26}
              className="h-6 w-auto"
              priority
            />
          </div>
          <span className="hidden sm:block text-white/40 text-[11px] font-medium tracking-wide">
            Infrastructure Intelligence Platform
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile filter toggle */}
          <button
            onClick={() => setMobileOpen(v => !v)}
            className="md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
            aria-label="Toggle filters"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
            </svg>
            Filters
          </button>

          <a
            href="https://www.africa-infra.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:block text-xs text-white/60 hover:text-white transition-colors px-3 py-1.5"
          >
            Learn More
          </a>
          <Link
            href="/login"
            className="text-xs font-semibold bg-brand-gold hover:bg-brand-gold-dark text-brand-navy px-4 py-2 rounded-lg transition-colors"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* ── Split layout ───────────────────────────────────────────────── */}
      <div className="flex h-full">

        {/* Desktop sidebar */}
        <div className="hidden md:block w-[280px] lg:w-[300px] xl:w-[320px] h-full shrink-0 z-[999]">
          <LeftPanel {...panelProps} />
        </div>

        {/* Map */}
        <div className="flex-1 h-full relative">
          <InfrastructureMap projects={filteredProjects} onProjectClick={setSelectedProject} />

          {/* Project count badge */}
          <div className="absolute bottom-8 right-4 z-[998] bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2 text-center">
            <div className="text-xs font-bold text-brand-navy">{filteredProjects.length}</div>
            <div className="text-[10px] text-gray-500">of {projects.length}</div>
          </div>

          {/* Bottom gradient */}
          <div
            className="absolute bottom-0 left-0 right-0 z-[997] flex items-center justify-between px-4 py-2 text-[10px] text-white/40 pointer-events-none"
            style={{ background: 'linear-gradient(to top, rgba(11,18,32,0.65) 0%, transparent 100%)' }}
          >
            <span>© Africa Infrastructure Partners · Illustrative data</span>
            <Link
              href="/register"
              className="text-brand-gold/70 hover:text-brand-gold transition-colors font-medium pointer-events-auto"
            >
              Request full access →
            </Link>
          </div>
        </div>
      </div>

      {/* ── Project slide panel ───────────────────────────────────────── */}
      <AnimatePresence>
        {selectedProject && (() => {
          const p = selectedProject
          const cat = CATEGORIES.find(c => c.id === p.type)
          const statusColor = STATUS_COLORS[p.status] ?? '#666'
          const flag = COUNTRY_FLAGS[p.country] ?? '🌍'
          return (
            <>
              {/* Backdrop */}
              <motion.div
                className="fixed inset-0 z-[1003] bg-black/40 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedProject(null)}
              />
              {/* Panel */}
              <motion.aside
                className="fixed right-0 top-0 bottom-0 z-[1004] w-full max-w-sm bg-white shadow-2xl flex flex-col overflow-hidden"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 280 }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: `${cat?.color ?? '#666'}22`, color: cat?.color ?? '#666', border: `1px solid ${cat?.color ?? '#666'}50` }}
                  >
                    {cat?.icon ?? '📍'} {cat?.label ?? p.type}
                  </span>
                  <button
                    onClick={() => setSelectedProject(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none"
                    aria-label="Close panel"
                  >
                    ×
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  <div>
                    <h2 className="text-xl font-bold text-brand-navy leading-snug">{p.name}</h2>
                    <p className="text-sm text-gray-500 mt-1">{flag} {p.country} · {p.region}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-400 mb-1">Value</p>
                      <p className="text-lg font-bold text-brand-gold">{p.value}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-400 mb-1">Year</p>
                      <p className="text-lg font-bold text-brand-navy">{p.year}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-semibold px-3 py-1 rounded-full capitalize"
                      style={{ background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}50` }}
                    >
                      {p.status}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Description</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{p.description}</p>
                  </div>
                </div>

                {/* Footer CTA */}
                <div className="px-5 py-4 border-t border-gray-100">
                  <Link
                    href="/login"
                    className="block w-full text-center py-2.5 bg-brand-gold hover:bg-brand-gold-dark text-brand-navy text-sm font-semibold rounded-lg transition-colors"
                  >
                    Sign in to view full details →
                  </Link>
                </div>
              </motion.aside>
            </>
          )
        })()}
      </AnimatePresence>

      {/* ── Mobile bottom drawer ───────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="md:hidden fixed inset-0 z-[1002] flex flex-col justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />

            {/* Drawer */}
            <motion.div
              className="relative bg-white rounded-t-2xl overflow-hidden"
              style={{ maxHeight: '85vh' }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-2 pb-1">
                <div className="w-10 h-1 rounded-full bg-gray-300" />
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 20px)' }}>
                <LeftPanel {...panelProps} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
