'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  TYPE_COLORS,
  STATUS_COLORS,
  TYPE_ICONS,
} from '../../data/infrastructure'

const ALL_TYPES = ['port', 'airport', 'road', 'railway', 'dam', 'hospital', 'water'] as const
const ALL_STATUSES = ['planned', 'construction', 'operational'] as const
const CATEGORIES = ['all', 'coastal', 'inland'] as const

interface Props {
  activeTypes: Set<string>
  onTypeToggle: (type: string) => void
  activeStatus: string
  onStatusChange: (status: string) => void
  activeCategory: string
  onCategoryChange: (cat: string) => void
  selectedCountry: string
  onCountryChange: (country: string) => void
  filteredCount: number
  countries: string[]
}

function AnimatedStat({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let start = 0
    const duration = 1400
    const startTime = performance.now()

    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(eased * target)
      el.textContent = current + suffix
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, suffix])

  return <span ref={ref}>0{suffix}</span>
}

const STATUS_LABELS: Record<string, string> = {
  planned:      'Planned',
  construction: 'Under Construction',
  operational:  'Operational',
}

const CATEGORY_LABELS: Record<string, string> = {
  all:     'All',
  coastal: 'Coastal',
  inland:  'Inland',
}

export default function LeftPanel({
  activeTypes,
  onTypeToggle,
  activeStatus,
  onStatusChange,
  activeCategory,
  onCategoryChange,
  selectedCountry,
  onCountryChange,
  filteredCount,
  countries,
}: Props) {
  const allTypesActive = activeTypes.size === 0

  return (
    <aside className="flex flex-col h-full bg-white border-r border-gray-200 shadow-xl overflow-y-auto">

      {/* Logo + Brand */}
      <div className="px-5 pt-20 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-1">
          <div className="bg-brand-navy rounded px-2 py-1 shrink-0">
            <Image src="/logo.png" alt="AIP" width={80} height={22} className="h-5 w-auto" />
          </div>
        </div>
        <h1 className="text-base font-bold text-brand-navy mt-3 leading-tight">
          Africa Infrastructure Map
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          {filteredCount} project{filteredCount !== 1 ? 's' : ''} shown
        </p>
      </div>

      {/* Filters */}
      <div className="flex-1 px-5 py-4 space-y-5">

        {/* Infrastructure Type */}
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
            Infrastructure Type
          </p>
          <div className="space-y-1.5">
            {/* All toggle */}
            <button
              onClick={() => ALL_TYPES.forEach((t) => activeTypes.has(t) && onTypeToggle(t))}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                allTypesActive
                  ? 'bg-brand-navy text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="text-base">🌍</span>
              <span>All Types</span>
            </button>

            {ALL_TYPES.map((type) => {
              const active = activeTypes.has(type)
              const color  = TYPE_COLORS[type]
              return (
                <button
                  key={type}
                  onClick={() => onTypeToggle(type)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all hover:bg-gray-50"
                  style={
                    active
                      ? { background: `${color}18`, color: color, outline: `1.5px solid ${color}50` }
                      : {}
                  }
                >
                  <span className="text-base">{TYPE_ICONS[type]}</span>
                  <span className={active ? '' : 'text-gray-600'}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                    {type === 'dam' ? ' / Energy' : ''}
                  </span>
                  {active && (
                    <span
                      className="ml-auto w-2 h-2 rounded-full shrink-0"
                      style={{ background: color }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Category */}
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
            Location
          </p>
          <div className="flex gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => onCategoryChange(cat)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeCategory === cat
                    ? 'bg-brand-navy text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
            Project Status
          </p>
          <div className="space-y-1.5">
            <button
              onClick={() => onStatusChange('all')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeStatus === 'all'
                  ? 'bg-brand-navy text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-gray-400 shrink-0" />
              All Statuses
            </button>
            {ALL_STATUSES.map((status) => {
              const color = STATUS_COLORS[status]
              return (
                <button
                  key={status}
                  onClick={() => onStatusChange(status)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all hover:bg-gray-50"
                  style={
                    activeStatus === status
                      ? { background: `${color}18`, color: color, outline: `1.5px solid ${color}50` }
                      : {}
                  }
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: color }}
                  />
                  <span className={activeStatus === status ? '' : 'text-gray-600'}>
                    {STATUS_LABELS[status]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Country */}
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
            Country
          </p>
          <select
            value={selectedCountry}
            onChange={(e) => onCountryChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold transition-colors"
          >
            <option value="all">All Countries</option>
            {countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Legend */}
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
            Status Legend
          </p>
          <div className="space-y-1.5">
            {ALL_STATUSES.map((s) => (
              <div key={s} className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_COLORS[s] }} />
                {STATUS_LABELS[s]}
                <span className="ml-auto text-[10px] text-gray-400 italic">
                  {s === 'construction' ? 'pulsing' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mx-5 mb-4 rounded-xl bg-brand-navy p-4">
        <p className="text-[10px] font-semibold text-brand-gold/70 uppercase tracking-widest mb-3">
          Platform Stats
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Projects',   value: 27,  suffix: '' },
            { label: 'Pipeline',   value: 45,  suffix: 'B+' },
            { label: 'Countries',  value: 18,  suffix: '' },
            { label: 'Sectors',    value: 7,   suffix: '' },
          ].map(({ label, value, suffix }) => (
            <div key={label}>
              <div className="text-xl font-black text-brand-gold leading-none">
                {label === 'Pipeline' ? '$' : ''}
                <AnimatedStat target={value} suffix={suffix} />
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
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
        <p className="text-center text-[11px] text-gray-400 pt-1">
          Full platform access for verified members
        </p>
      </div>
    </aside>
  )
}
