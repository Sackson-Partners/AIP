'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { animate } from 'framer-motion'
import { CATEGORIES, STATUS_COLORS } from '@/data/infrastructure'
import type { FilterState, CategoryId } from '@/types'

// ── Animated stat counter ────────────────────────────────────────────────────

function AnimatedCounter({
  target,
  prefix = '',
  suffix = '',
}: {
  target: number
  prefix?: string
  suffix?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const controls = animate(0, target, {
      duration: 1.6,
      ease: [0.16, 1, 0.3, 1], // spring-like ease-out
      onUpdate(v) {
        if (ref.current) ref.current.textContent = prefix + Math.round(v).toLocaleString() + suffix
      },
    })
    return controls.stop
  }, [target, prefix, suffix])

  return <span ref={ref}>{prefix}0{suffix}</span>
}

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  planned:      'Planned',
  construction: 'Under Construction',
  operational:  'Operational',
}

const INFRA_TYPES = CATEGORIES.filter(c => !['coastal', 'inland'].includes(c.id))
const LOCATION_CATS = CATEGORIES.filter(c => ['coastal', 'inland'].includes(c.id))

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  filters: FilterState
  onFiltersChange: (f: FilterState) => void
  filteredCount: number
  totalCount: number
  countries: string[]
}

// ── Component ────────────────────────────────────────────────────────────────

export default function LeftPanel({
  filters,
  onFiltersChange,
  filteredCount,
  totalCount,
  countries,
}: Props) {
  const toggleCategory = (id: CategoryId) => {
    const next = filters.categories.includes(id)
      ? filters.categories.filter(c => c !== id)
      : [...filters.categories, id]
    onFiltersChange({ ...filters, categories: next })
  }

  const clearFilters = () => onFiltersChange({ categories: [], status: 'all', country: 'all' })

  const hasActiveFilters =
    filters.categories.length > 0 ||
    filters.status !== 'all' ||
    filters.country !== 'all'

  const allActive = filters.categories.length === 0

  return (
    <aside className="flex flex-col h-full bg-white border-r border-gray-200 shadow-xl overflow-y-auto">

      {/* ── Brand ── */}
      <div className="px-5 pt-20 pb-4 border-b border-gray-100">
        <div className="bg-brand-navy rounded px-2 py-1 inline-block mb-3">
          <Image src="/logo.png" alt="AIP" width={80} height={22} className="h-5 w-auto" />
        </div>
        <h1 className="text-[15px] font-bold text-brand-navy leading-tight">
          Africa Infrastructure Map
        </h1>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-[11px] text-gray-400">
            {filteredCount} / {totalCount} projects
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-[11px] text-brand-gold hover:text-brand-gold-dark font-medium transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 px-5 py-4 space-y-5">

        {/* ── Infrastructure Type ── */}
        <section>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Infrastructure Type
          </p>

          {/* All toggle */}
          <button
            onClick={() => onFiltersChange({ ...filters, categories: [] })}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-1 ${
              allActive ? 'bg-brand-navy text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <span>🌍</span>
            <span>All Types</span>
          </button>

          <div className="space-y-1">
            {INFRA_TYPES.map(cat => {
              const active = filters.categories.includes(cat.id as CategoryId)
              return (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id as CategoryId)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all hover:bg-gray-50"
                  style={active ? {
                    background: `${cat.color}15`,
                    color: cat.color,
                    outline: `1.5px solid ${cat.color}40`,
                  } : {}}
                >
                  <span className="text-base">{cat.icon}</span>
                  <span className={active ? 'font-semibold' : 'text-gray-600'}>{cat.label}</span>
                  {active && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: cat.color }} />
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Location ── */}
        <section>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Location
          </p>
          <div className="flex gap-1.5">
            {(['all', 'coastal', 'inland'] as const).map(cat => {
              const isAll    = cat === 'all'
              const locCat   = LOCATION_CATS.find(c => c.id === cat)
              const active   = isAll
                ? !filters.categories.some(c => ['coastal', 'inland'].includes(c))
                : filters.categories.includes(cat as CategoryId)

              const handleClick = () => {
                if (isAll) {
                  onFiltersChange({
                    ...filters,
                    categories: filters.categories.filter(c => !['coastal', 'inland'].includes(c)),
                  })
                } else {
                  toggleCategory(cat as CategoryId)
                }
              }

              return (
                <button
                  key={cat}
                  onClick={handleClick}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    active ? 'bg-brand-navy text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {isAll ? 'All' : locCat?.label ?? cat}
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Status ── */}
        <section>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Status
          </p>
          <div className="space-y-1">
            {(['all', 'planned', 'construction', 'operational'] as const).map(s => {
              const active = filters.status === s
              const color  = s !== 'all' ? STATUS_COLORS[s] : undefined
              return (
                <button
                  key={s}
                  onClick={() => onFiltersChange({ ...filters, status: s })}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all hover:bg-gray-50"
                  style={active && color ? {
                    background: `${color}15`,
                    color,
                    outline: `1.5px solid ${color}40`,
                  } : active ? { background: '#0B122015', color: '#0B1220', outline: '1.5px solid #0B122030' } : {}}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: color ?? '#9CA3AF' }}
                  />
                  <span className={active ? 'font-semibold' : 'text-gray-600'}>
                    {s === 'all' ? 'All Statuses' : STATUS_LABELS[s]}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Country ── */}
        <section>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Country
          </p>
          <select
            value={filters.country}
            onChange={e => onFiltersChange({ ...filters, country: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold transition-colors"
          >
            <option value="all">All Countries</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </section>

        {/* ── Status Legend ── */}
        <section>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Legend
          </p>
          <div className="space-y-1.5">
            {(['planned', 'construction', 'operational'] as const).map(s => (
              <div key={s} className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_COLORS[s] }} />
                {STATUS_LABELS[s]}
                {s === 'construction' && (
                  <span className="ml-auto text-[10px] text-gray-300 italic">pulse</span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Animated Stats ── */}
      <div className="mx-5 mb-4 rounded-xl bg-brand-navy p-4">
        <p className="text-[10px] font-semibold text-brand-gold/70 uppercase tracking-widest mb-3">
          Platform Stats
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-2xl font-black text-brand-gold leading-none">
              <AnimatedCounter target={49} suffix="+" />
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Projects</div>
          </div>
          <div>
            <div className="text-2xl font-black text-brand-gold leading-none">
              $<AnimatedCounter target={120} suffix="B+" />
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Pipeline</div>
          </div>
          <div>
            <div className="text-2xl font-black text-brand-gold leading-none">
              <AnimatedCounter target={19} />
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Countries</div>
          </div>
          <div>
            <div className="text-2xl font-black text-brand-gold leading-none">
              <AnimatedCounter target={9} />
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">Sectors</div>
          </div>
        </div>
      </div>

      {/* ── CTAs ── */}
      <div className="px-5 pb-6 space-y-2">
        <Link
          href="/login"
          className="block w-full text-center py-3 bg-brand-gold hover:bg-brand-gold-dark text-brand-navy font-bold text-sm rounded-xl transition-colors shadow-sm"
        >
          Login to Explore
        </Link>
        <Link
          href="/register"
          className="block w-full text-center py-2.5 border border-gray-200 hover:border-gray-300 text-gray-600 hover:text-brand-navy font-medium text-sm rounded-xl transition-colors"
        >
          Request Access
        </Link>
        <p className="text-center text-[10px] text-gray-400 pt-1">
          Full platform access for verified members
        </p>
      </div>
    </aside>
  )
}
