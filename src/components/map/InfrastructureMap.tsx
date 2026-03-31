'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster' // augments L with markerClusterGroup()
import {
  type InfrastructureProject,
  TYPE_COLORS,
  STATUS_COLORS,
  COUNTRY_FLAGS,
} from '../../data/infrastructure'

// Patch Leaflet default icon URLs for webpack/Next.js
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function getIcon(type: string, status: string) {
  const color = TYPE_COLORS[type] || '#666'
  const isPulse = status === 'construction'
  return L.divIcon({
    html: `
      <div style="position:relative;width:16px;height:16px;">
        ${isPulse ? `<div style="position:absolute;inset:-4px;border-radius:50%;background:${color};opacity:0.25;animation:aip-ping 1.8s cubic-bezier(0,0,0.2,1) infinite;"></div>` : ''}
        <div style="width:16px;height:16px;background:${color};border-radius:50%;border:2.5px solid rgba(255,255,255,0.9);box-shadow:0 2px 10px rgba(0,0,0,0.6);"></div>
      </div>`,
    className: '',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  })
}

function createPopupContent(p: InfrastructureProject): string {
  const typeColor  = TYPE_COLORS[p.type]   || '#666'
  const statusColor = STATUS_COLORS[p.status] || '#666'
  const flag       = COUNTRY_FLAGS[p.country] || '🌍'
  const typeLabel  = p.type.charAt(0).toUpperCase() + p.type.slice(1)
  const statusLabel = p.status.charAt(0).toUpperCase() + p.status.slice(1)

  return `
    <div style="min-width:230px;max-width:270px;font-family:Inter,system-ui,sans-serif;padding:2px 0;">
      <div style="font-weight:700;font-size:14px;color:#0B1220;margin-bottom:4px;line-height:1.35;">${p.name}</div>
      <div style="font-size:12px;color:#64748B;margin-bottom:8px;">${flag} ${p.country}</div>
      <div style="display:flex;gap:5px;margin-bottom:9px;flex-wrap:wrap;">
        <span style="background:${typeColor}20;color:${typeColor};border:1px solid ${typeColor}50;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:600;">${typeLabel}</span>
        <span style="background:${statusColor}20;color:${statusColor};border:1px solid ${statusColor}50;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:600;">${statusLabel}</span>
      </div>
      <div style="font-size:22px;font-weight:800;color:#C9A84C;margin-bottom:4px;letter-spacing:-0.5px;">${p.value}</div>
      <div style="font-size:12px;color:#64748B;margin-bottom:11px;line-height:1.55;">${p.description}</div>
      <a href="/login" style="display:block;text-align:center;background:#1A73E8;color:#fff;padding:8px 12px;border-radius:7px;font-size:12px;font-weight:600;text-decoration:none;">View Details →</a>
    </div>`
}

function ClusteredMarkers({ projects }: { projects: InfrastructureProject[] }) {
  const map = useMap()

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mcg = (L as any).markerClusterGroup({
      disableClusteringAtZoom: 7,
      maxClusterRadius: 55,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster: { getChildCount: () => number }) => {
        const count = cluster.getChildCount()
        const size  = count < 10 ? 34 : count < 50 ? 40 : 46
        return L.divIcon({
          html: `<div style="width:${size}px;height:${size}px;background:rgba(26,115,232,0.85);backdrop-filter:blur(4px);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;border:2px solid rgba(255,255,255,0.7);box-shadow:0 3px 12px rgba(26,115,232,0.5);">${count}</div>`,
          className: '',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        })
      },
    })

    projects.forEach((p) => {
      const marker = L.marker(p.coordinates as [number, number], { icon: getIcon(p.type, p.status) })
      marker.bindPopup(createPopupContent(p), {
        maxWidth: 290,
        className: 'aip-popup',
        closeButton: true,
      })
      mcg.addLayer(marker)
    })

    map.addLayer(mcg)
    return () => { map.removeLayer(mcg) }
  }, [map, projects])

  return null
}

interface Props {
  projects: InfrastructureProject[]
}

export default function InfrastructureMap({ projects }: Props) {
  return (
    <MapContainer
      center={[1.5, 17]}
      zoom={4}
      minZoom={3}
      maxZoom={18}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
      attributionControl={true}
      scrollWheelZoom={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
      />
      <ClusteredMarkers projects={projects} />
    </MapContainer>
  )
}
