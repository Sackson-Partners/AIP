'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { Project } from '../../lib/api';

// Country coordinate lookup
const COUNTRY_COORDS: Record<string, [number, number]> = {
  // Africa
  nigeria:         [9.0, 8.0],
  ghana:           [7.9, -1.0],
  kenya:           [-0.02, 37.9],
  'south africa':  [-29.0, 25.0],
  ethiopia:        [9.0, 40.0],
  egypt:           [27.0, 30.0],
  morocco:         [32.0, -5.0],
  tanzania:        [-6.0, 35.0],
  uganda:          [1.0, 32.0],
  mozambique:      [-18.0, 35.0],
  angola:          [-11.2, 17.9],
  zambia:          [-13.1, 27.8],
  zimbabwe:        [-19.0, 29.9],
  senegal:         [14.7, -14.4],
  cameroon:        [3.9, 11.5],
  'ivory coast':   [7.5, -5.5],
  "cote d'ivoire": [7.5, -5.5],
  drc:             [-4.0, 24.0],
  'democratic republic of the congo': [-4.0, 24.0],
  rwanda:          [-1.9, 29.8],
  malawi:          [-13.3, 34.3],
  botswana:        [-22.3, 24.7],
  namibia:         [-22.0, 17.0],
  tunisia:         [34.0, 9.0],
  algeria:         [28.0, 3.0],
  sudan:           [12.0, 30.0],
  somalia:         [2.0, 46.0],
  madagascar:      [-20.0, 47.0],
  'burkina faso':  [12.4, -1.6],
  mali:            [12.7, -8.0],
  niger:           [13.5, 2.1],
  togo:            [8.0, 1.1],
  benin:           [9.3, 2.3],
  gabon:           [-0.8, 11.6],
  congo:           [0.2, 15.8],
  'republic of the congo': [0.2, 15.8],
  chad:            [15.5, 18.7],
  liberia:         [6.4, -9.4],
  'sierra leone':  [8.5, -11.8],
  guinea:          [11.0, -10.9],
  eritrea:         [15.2, 39.8],
  djibouti:        [11.8, 42.6],
  lesotho:         [-29.6, 28.2],
  eswatini:        [-26.5, 31.5],
  swaziland:       [-26.5, 31.5],
  mauritius:       [-20.3, 57.5],
  seychelles:      [-4.7, 55.5],
  // Global
  india:           [20.6, 78.9],
  pakistan:        [30.4, 69.3],
  bangladesh:      [23.7, 90.4],
  indonesia:       [-0.8, 113.9],
  vietnam:         [14.1, 108.3],
  thailand:        [15.9, 100.9],
  philippines:     [12.9, 121.8],
  malaysia:        [4.2, 108.0],
  brazil:          [-14.2, -51.9],
  colombia:        [4.6, -74.1],
  peru:            [-9.2, -75.0],
  chile:           [-35.7, -71.5],
  mexico:          [23.6, -102.6],
  usa:             [37.1, -95.7],
  'united states': [37.1, -95.7],
  uk:              [55.4, -3.4],
  'united kingdom': [55.4, -3.4],
  france:          [46.2, 2.2],
  germany:         [51.2, 10.5],
  china:           [35.9, 104.2],
  japan:           [36.2, 138.3],
  australia:       [-25.3, 133.8],
  canada:          [56.1, -106.3],
  netherlands:     [52.1, 5.3],
  uae:             [23.4, 53.8],
  'united arab emirates': [23.4, 53.8],
  'saudi arabia':  [23.9, 45.1],
  qatar:           [25.4, 51.2],
};

function getCoords(country?: string | null): [number, number] | null {
  if (!country) return null;
  return COUNTRY_COORDS[country.toLowerCase()] ?? null;
}

function projectTitle(p: Project): string {
  return p.title ?? p.project_name ?? p.name ?? String(p.id);
}

function projectStage(p: Project): string {
  return p.dealStage ?? p.stage ?? p.status ?? '—';
}

interface MapPanelProps {
  projects: Project[];
}

export default function MapPanel({ projects }: MapPanelProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Dynamic import to ensure this only runs client-side
    let isMounted = true;

    (async () => {
      const L = (await import('leaflet')).default;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { MarkerClusterGroup } = (await import('leaflet.markercluster')) as any;

      if (!isMounted || !mapRef.current) return;

      // Fix default marker icon
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current, {
        center: [0, 20],
        zoom: 3,
        zoomControl: true,
        scrollWheelZoom: false,
      });

      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      const clusterGroup = new MarkerClusterGroup({
        maxClusterRadius: 50,
        showCoverageOnHover: false,
      });

      projects.forEach((project) => {
        const coords = getCoords(project.country);
        if (!coords) return;

        // Jitter markers slightly so same-country projects don't stack exactly
        const jitter = () => (Math.random() - 0.5) * 0.8;
        const marker = L.marker([coords[0] + jitter(), coords[1] + jitter()]);

        const stage = projectStage(project);
        const title = projectTitle(project);

        marker.bindPopup(
          `<div style="min-width:160px">
            <strong style="font-size:13px;color:#1a2e44">${title}</strong>
            <div style="margin-top:4px;font-size:11px;color:#555">${project.country ?? ''}</div>
            ${project.sector ? `<div style="margin-top:2px;font-size:11px;color:#777">${project.sector}</div>` : ''}
            <span style="display:inline-block;margin-top:6px;padding:2px 6px;border-radius:9999px;font-size:10px;font-weight:600;background:#f0f4ff;color:#3b4fc0">${stage}</span>
          </div>`,
          { maxWidth: 220 }
        );

        clusterGroup.addLayer(marker);
      });

      map.addLayer(clusterGroup);
    })();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [projects]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full rounded-xl overflow-hidden"
      style={{ minHeight: 320 }}
    />
  );
}
