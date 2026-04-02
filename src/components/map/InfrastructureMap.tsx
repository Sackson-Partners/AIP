'use client'

import { useEffect, useRef } from 'react'
// CSS imports are safe at top-level — this file is only loaded client-side (ssr:false in page.tsx)
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import type { Project } from '@/types'
import { CATEGORIES, STATUS_COLORS, COUNTRY_FLAGS } from '@/data/infrastructure'

// ── Popup HTML ───────────────────────────────────────────────────────────────

function createPopupHTML(p: Project): string {
  const cat       = CATEGORIES.find(c => c.id === p.type)
  const typeColor = cat?.color   ?? '#666'
  const typeIcon  = cat?.icon    ?? '📍'
  const typeLabel = cat?.label   ?? p.type
  const statusColor = STATUS_COLORS[p.status] ?? '#666'
  const statusLabel = p.status.charAt(0).toUpperCase() + p.status.slice(1)
  const flag        = COUNTRY_FLAGS[p.country] ?? '🌍'

  return `
    <div style="min-width:230px;max-width:265px;font-family:Inter,system-ui,sans-serif;padding:2px 0;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
        <span style="background:${typeColor}22;color:${typeColor};border:1px solid ${typeColor}50;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;">${typeIcon} ${typeLabel}</span>
        <span style="background:${statusColor}22;color:${statusColor};border:1px solid ${statusColor}50;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;">${statusLabel}</span>
      </div>
      <div style="font-weight:700;font-size:14px;color:#0B1220;margin-bottom:4px;line-height:1.35;">${p.name}</div>
      <div style="font-size:12px;color:#64748B;margin-bottom:8px;">${flag} ${p.country} · ${p.region}</div>
      <div style="font-size:12px;color:#64748B;line-height:1.55;margin-bottom:9px;">${p.description}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:11px;">
        <span style="font-size:20px;font-weight:800;color:#C9A84C;letter-spacing:-0.5px;">${p.value}</span>
        <span style="font-size:11px;color:#94A3B8;">${p.year}</span>
      </div>
      <a href="/login" style="display:block;text-align:center;background:#1A73E8;color:#fff;padding:7px 12px;border-radius:7px;font-size:12px;font-weight:600;text-decoration:none;">View Details →</a>
    </div>`
}

// ── Marker helpers ───────────────────────────────────────────────────────────

function addMarkers(
  L: typeof import('leaflet'),
  mcg: any,
  projects: Project[],
  onProjectClick?: (p: Project) => void,
) {
  projects.forEach(p => {
    const cat   = CATEGORIES.find(c => c.id === p.type)
    const color = cat?.color ?? '#666'
    const icon  = cat?.icon  ?? '📍'
    const isPulse = p.status === 'construction'

    const divIcon = L.divIcon({
      className: '',
      html: `
        <div style="position:relative;width:32px;height:32px;">
          ${isPulse ? `<div style="position:absolute;inset:-5px;border-radius:50%;background:${color};opacity:0.2;animation:aip-ping 1.8s cubic-bezier(0,0,0.2,1) infinite;"></div>` : ''}
          <div style="width:32px;height:32px;background:${color};border-radius:50%;border:3px solid white;box-shadow:0 2px 12px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:15px;line-height:1;">${icon}</div>
        </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -18],
    })

    const marker = L.marker(p.coordinates, { icon: divIcon })

    if (onProjectClick) {
      marker.on('click', () => onProjectClick(p))
    } else {
      marker.bindPopup(createPopupHTML(p), {
        maxWidth: 285,
        className: 'aip-popup',
        closeButton: true,
      })
    }

    mcg.addLayer(marker)
  })
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  projects: Project[]
  onProjectClick?: (project: Project) => void
}

export default function InfrastructureMap({ projects, onProjectClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<any>(null)
  const clusterRef   = useRef<any>(null)
  const LRef         = useRef<any>(null)
  const onClickRef   = useRef(onProjectClick)
  onClickRef.current = onProjectClick

  // ── Init map (once) ────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let mounted = true

    ;(async () => {
      // 1. Leaflet core (dynamic so it never runs on the server)
      const L = (await import('leaflet')).default

      // 2. Plugin JS — must come AFTER leaflet is loaded; augments L with markerClusterGroup()
      await import('leaflet.markercluster')

      if (!mounted || !containerRef.current || mapRef.current) return

      // 4. Fix broken default icon paths (webpack/Next.js)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      // 5. Create map centred on Africa
      const map = L.map(containerRef.current, {
        center: [2, 20],
        zoom: 4,
        minZoom: 3,
        maxZoom: 18,
        zoomControl: true,
        scrollWheelZoom: true,
      })

      // 6. OpenStreetMap tiles (no API key, no {r} placeholder)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }).addTo(map)

      // 7. Marker cluster group
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mcg = (L as any).markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 60,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        iconCreateFunction: (cluster: any) => {
          const count = cluster.getChildCount()
          const size  = count < 10 ? 34 : count < 50 ? 40 : 46
          return L.divIcon({
            html: `<div style="width:${size}px;height:${size}px;background:rgba(26,115,232,0.88);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;border:2px solid rgba(255,255,255,0.8);box-shadow:0 3px 12px rgba(26,115,232,0.45);">${count}</div>`,
            className: '',
            iconSize:   [size, size],
            iconAnchor: [size / 2, size / 2],
          })
        },
      })

      map.addLayer(mcg)

      // 8. Store refs and add initial markers
      LRef.current      = L
      mapRef.current    = map
      clusterRef.current = mcg
      addMarkers(L, mcg, projects, onClickRef.current)
    })()

    return () => {
      mounted = false
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current    = null
        clusterRef.current = null
        LRef.current      = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update markers when filter changes ────────────────────────────────
  useEffect(() => {
    if (!clusterRef.current || !LRef.current) return
    clusterRef.current.clearLayers()
    addMarkers(LRef.current, clusterRef.current, projects, onClickRef.current)
  }, [projects])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
      aria-label="Africa infrastructure map"
    />
  )
}
