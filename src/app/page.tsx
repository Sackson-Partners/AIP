'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '../context/AuthContext'
import LeftPanel from '../components/map/LeftPanel'
import { infrastructureProjects } from '../data/infrastructure'

// Leaflet must never render on the server
const InfrastructureMap = dynamic(
  () => import('../components/map/InfrastructureMap'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#1a1a2e]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-4 border-brand-gold/20" />
            <div className="absolute inset-0 rounded-full border-4 border-t-brand-gold animate-spin" />
          </div>
          <p className="text-brand-gold/70 text-sm font-medium tracking-wide">Loading map…</p>
        </div>
      </div>
    ),
  }
)

// Unique, sorted list of countries in the dataset
const ALL_COUNTRIES = Array.from(
  new Set(infrastructureProjects.map((p) => p.country))
).sort()

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  // Filter state
  const [activeTypes,     setActiveTypes]     = useState<Set<string>>(new Set())
  const [activeStatus,    setActiveStatus]    = useState('all')
  const [activeCategory,  setActiveCategory]  = useState('all')
  const [selectedCountry, setSelectedCountry] = useState('all')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) router.push('/dashboard')
  }, [isAuthenticated, isLoading, router])

  const handleTypeToggle = useCallback((type: string) => {
    setActiveTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }, [])

  const filteredProjects = useMemo(() => {
    return infrastructureProjects.filter((p) => {
      if (activeTypes.size > 0 && !activeTypes.has(p.type))      return false
      if (activeStatus    !== 'all' && p.status    !== activeStatus)    return false
      if (activeCategory  !== 'all' && p.category  !== activeCategory)  return false
      if (selectedCountry !== 'all' && p.country   !== selectedCountry) return false
      return true
    })
  }, [activeTypes, activeStatus, activeCategory, selectedCountry])

  // Auth loading spinner
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

      {/* ── Floating header ─────────────────────────────────────────────── */}
      <header
        className="absolute top-0 left-0 right-0 z-[1001] flex items-center justify-between px-4 py-3"
        style={{ background: 'linear-gradient(to bottom, rgba(11,18,32,0.92) 0%, rgba(11,18,32,0) 100%)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="bg-white rounded px-2 py-1 shrink-0">
            <Image
              src="/logo.png"
              alt="Africa Infrastructure Partners"
              width={100}
              height={26}
              className="h-6 w-auto"
              priority
            />
          </div>
          <div className="hidden sm:block">
            <p className="text-white/90 text-xs font-semibold leading-none">AIP Platform</p>
            <p className="text-white/40 text-[10px] leading-none mt-0.5">Infrastructure Intelligence</p>
          </div>
        </div>

        {/* Right nav */}
        <div className="flex items-center gap-2">
          {/* Mobile filter toggle */}
          <button
            onClick={() => setMobileFiltersOpen((v) => !v)}
            className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg transition-colors backdrop-blur-sm"
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
            className="hidden sm:block text-xs text-white/60 hover:text-white/90 transition-colors px-3 py-1.5"
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

      {/* ── Body: split layout ──────────────────────────────────────────── */}
      <div className="flex h-full">

        {/* Left panel — desktop */}
        <div className="hidden md:block w-[280px] lg:w-[300px] xl:w-[320px] h-full shrink-0 z-[999]">
          <LeftPanel
            activeTypes={activeTypes}
            onTypeToggle={handleTypeToggle}
            activeStatus={activeStatus}
            onStatusChange={setActiveStatus}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            selectedCountry={selectedCountry}
            onCountryChange={setSelectedCountry}
            filteredCount={filteredProjects.length}
            countries={ALL_COUNTRIES}
          />
        </div>

        {/* Left panel — mobile overlay */}
        {mobileFiltersOpen && (
          <div className="md:hidden absolute inset-0 z-[1002] flex">
            <div className="w-[290px] h-full z-10">
              <LeftPanel
                activeTypes={activeTypes}
                onTypeToggle={handleTypeToggle}
                activeStatus={activeStatus}
                onStatusChange={setActiveStatus}
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
                selectedCountry={selectedCountry}
                onCountryChange={setSelectedCountry}
                filteredCount={filteredProjects.length}
                countries={ALL_COUNTRIES}
              />
            </div>
            {/* Click-away backdrop */}
            <div
              className="flex-1 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileFiltersOpen(false)}
            />
          </div>
        )}

        {/* Map */}
        <div className="flex-1 h-full relative">
          <InfrastructureMap projects={filteredProjects} />

          {/* Zoom controls — positioned so they don't clash with leaflet defaults */}
          <div className="absolute bottom-8 right-4 z-[999] flex flex-col gap-1">
            <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg overflow-hidden text-xs">
              <div className="px-2 py-1 text-gray-500 text-center border-b border-gray-200">
                {filteredProjects.length} / {infrastructureProjects.length}
              </div>
              <div className="px-2 py-1 text-gray-400 text-center">projects</div>
            </div>
          </div>

          {/* Bottom attribution bar */}
          <div
            className="absolute bottom-0 left-0 right-0 z-[998] flex items-center justify-between px-4 py-2 text-[10px] text-white/40"
            style={{ background: 'linear-gradient(to top, rgba(11,18,32,0.7) 0%, rgba(11,18,32,0) 100%)' }}
          >
            <span>© Africa Infrastructure Partners · Data for illustrative purposes</span>
            <Link href="/register" className="text-brand-gold/70 hover:text-brand-gold transition-colors font-medium">
              Request full access →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
