'use client';

import { useEffect, useRef } from 'react';
import { Project } from '../../lib/api';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

// Country coordinate lookup [lng, lat] for Mapbox (note: lng first)
const COUNTRY_COORDS: Record<string, [number, number]> = {
  // Africa
  nigeria:         [8.0, 9.0],
  ghana:           [-1.0, 7.9],
  kenya:           [37.9, -0.02],
  'south africa':  [25.0, -29.0],
  ethiopia:        [40.0, 9.0],
  egypt:           [30.0, 27.0],
  morocco:         [-5.0, 32.0],
  tanzania:        [35.0, -6.0],
  uganda:          [32.0, 1.0],
  mozambique:      [35.0, -18.0],
  angola:          [17.9, -11.2],
  zambia:          [27.8, -13.1],
  zimbabwe:        [29.9, -19.0],
  senegal:         [-14.4, 14.7],
  cameroon:        [11.5, 3.9],
  'ivory coast':   [-5.5, 7.5],
  "cote d'ivoire": [-5.5, 7.5],
  drc:             [24.0, -4.0],
  'democratic republic of the congo': [24.0, -4.0],
  rwanda:          [29.8, -1.9],
  malawi:          [34.3, -13.3],
  botswana:        [24.7, -22.3],
  namibia:         [17.0, -22.0],
  tunisia:         [9.0, 34.0],
  algeria:         [3.0, 28.0],
  sudan:           [30.0, 12.0],
  somalia:         [46.0, 2.0],
  madagascar:      [47.0, -20.0],
  'burkina faso':  [-1.6, 12.4],
  mali:            [-8.0, 12.7],
  niger:           [2.1, 13.5],
  togo:            [1.1, 8.0],
  benin:           [2.3, 9.3],
  gabon:           [11.6, -0.8],
  congo:           [15.8, 0.2],
  'republic of the congo': [15.8, 0.2],
  chad:            [18.7, 15.5],
  liberia:         [-9.4, 6.4],
  'sierra leone':  [-11.8, 8.5],
  guinea:          [-10.9, 11.0],
  eritrea:         [39.8, 15.2],
  djibouti:        [42.6, 11.8],
  lesotho:         [28.2, -29.6],
  eswatini:        [31.5, -26.5],
  mauritius:       [57.5, -20.3],
  seychelles:      [55.5, -4.7],
  // Global
  india:           [78.9, 20.6],
  pakistan:        [69.3, 30.4],
  bangladesh:      [90.4, 23.7],
  indonesia:       [113.9, -0.8],
  vietnam:         [108.3, 14.1],
  thailand:        [100.9, 15.9],
  philippines:     [121.8, 12.9],
  malaysia:        [108.0, 4.2],
  brazil:          [-51.9, -14.2],
  colombia:        [-74.1, 4.6],
  peru:            [-75.0, -9.2],
  chile:           [-71.5, -35.7],
  mexico:          [-102.6, 23.6],
  usa:             [-95.7, 37.1],
  'united states': [-95.7, 37.1],
  uk:              [-3.4, 55.4],
  'united kingdom': [-3.4, 55.4],
  france:          [2.2, 46.2],
  germany:         [10.5, 51.2],
  china:           [104.2, 35.9],
  japan:           [138.3, 36.2],
  australia:       [133.8, -25.3],
  canada:          [-106.3, 56.1],
  netherlands:     [5.3, 52.1],
  uae:             [53.8, 23.4],
  'united arab emirates': [53.8, 23.4],
  'saudi arabia':  [45.1, 23.9],
  qatar:           [51.2, 25.4],
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

// Stage → colour mapping for popup badge
const STAGE_COLORS: Record<string, string> = {
  CONCEPT:          '#6b7280',
  PRE_FEASIBILITY:  '#3b82f6',
  FEASIBILITY:      '#6366f1',
  STRUCTURING:      '#f59e0b',
  PROCUREMENT:      '#f97316',
  FINANCIAL_CLOSE:  '#10b981',
  CONSTRUCTION:     '#ef4444',
  OPERATIONS:       '#22c55e',
};

interface MapPanelProps {
  projects: Project[];
}

export default function MapPanel({ projects }: MapPanelProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    if (!MAPBOX_TOKEN) return;

    let isMounted = true;

    (async () => {
      const mapboxgl = (await import('mapbox-gl')).default;
      await import('mapbox-gl/dist/mapbox-gl.css');

      if (!isMounted || !mapContainerRef.current) return;

      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [20, 2],
        zoom: 2.8,
        scrollZoom: false,
        attributionControl: false,
      });

      mapRef.current = map;

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

      map.on('load', () => {
        if (!isMounted) return;

        // Build GeoJSON from projects
        const features = projects
          .filter((p) => getCoords(p.country) !== null)
          .map((p) => {
            const coords = getCoords(p.country)!;
            const jitter = () => (Math.random() - 0.5) * 0.6;
            return {
              type: 'Feature' as const,
              geometry: {
                type: 'Point' as const,
                coordinates: [coords[0] + jitter(), coords[1] + jitter()],
              },
              properties: {
                id:      p.id,
                title:   projectTitle(p),
                country: p.country ?? '',
                sector:  p.sector ?? '',
                stage:   projectStage(p),
                color:   STAGE_COLORS[projectStage(p).toUpperCase()] ?? '#b8860b',
              },
            };
          });

        map.addSource('projects', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features },
          cluster: true,
          clusterMaxZoom: 6,
          clusterRadius: 50,
        });

        // Cluster circles
        map.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'projects',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#b8860b',
            'circle-radius': ['step', ['get', 'point_count'], 18, 5, 24, 10, 30],
            'circle-opacity': 0.85,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff',
          },
        });

        // Cluster count labels
        map.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'projects',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-size': 12,
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          },
          paint: { 'text-color': '#fff' },
        });

        // Individual project dots
        map.addLayer({
          id: 'unclustered-point',
          type: 'circle',
          source: 'projects',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': ['get', 'color'],
            'circle-radius': 7,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff',
            'circle-opacity': 0.9,
          },
        });

        // Click on cluster → zoom in
        map.on('click', 'clusters', (e) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
          const clusterId = features[0].properties?.cluster_id;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (map.getSource('projects') as any).getClusterExpansionZoom(clusterId, (err: unknown, zoom: number) => {
            if (err) return;
            const coords = (features[0].geometry as GeoJSON.Point).coordinates as [number, number];
            map.easeTo({ center: coords, zoom });
          });
        });

        // Click on individual point → popup
        map.on('click', 'unclustered-point', (e) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const { title, country, sector, stage, color } = feature.properties as Record<string, string>;
          const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];

          new mapboxgl.Popup({ offset: 12, closeButton: false, maxWidth: '220px' })
            .setLngLat(coords)
            .setHTML(`
              <div style="font-family:system-ui,sans-serif;padding:2px 0">
                <p style="font-size:13px;font-weight:700;color:#1a2e44;margin:0 0 4px">${title}</p>
                <p style="font-size:11px;color:#666;margin:0 0 2px">${country}${sector ? ` · ${sector}` : ''}</p>
                <span style="display:inline-block;margin-top:6px;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;background:${color}22;color:${color};border:1px solid ${color}44">${stage}</span>
              </div>
            `)
            .addTo(map);
        });

        // Pointer cursor on hover
        map.on('mouseenter', 'clusters',          () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'clusters',          () => { map.getCanvas().style.cursor = ''; });
        map.on('mouseenter', 'unclustered-point', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'unclustered-point', () => { map.getCanvas().style.cursor = ''; });
      });
    })();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update source data when projects change without re-creating the map
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (!map.isStyleLoaded()) return;

    const source = map.getSource('projects');
    if (!source) return;

    const features = projects
      .filter((p) => getCoords(p.country) !== null)
      .map((p) => {
        const coords = getCoords(p.country)!;
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [coords[0], coords[1]] },
          properties: {
            id:      p.id,
            title:   projectTitle(p),
            country: p.country ?? '',
            sector:  p.sector ?? '',
            stage:   projectStage(p),
            color:   STAGE_COLORS[projectStage(p).toUpperCase()] ?? '#b8860b',
          },
        };
      });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (source as any).setData({ type: 'FeatureCollection', features });
  }, [projects]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-full rounded-xl overflow-hidden"
      style={{ minHeight: 320 }}
    />
  );
}
