import type { Project, Category, InfraType } from '@/types'

// ── Category definitions ────────────────────────────────────────────────────

export const CATEGORIES: Category[] = [
  { id: 'road',       label: 'Roads',        icon: '🛣️',  color: '#FF6B35' },
  { id: 'rail',       label: 'Railways',     icon: '🚆',  color: '#4A4A4A' },
  { id: 'airport',    label: 'Airports',     icon: '✈️',  color: '#1A73E8' },
  { id: 'port',       label: 'Ports',        icon: '⚓',  color: '#0077B6' },
  { id: 'dam',        label: 'Dams/Energy',  icon: '⚡',  color: '#F5A623' },
  { id: 'hospital',   label: 'Hospitals',    icon: '🏥',  color: '#E63946' },
  { id: 'water',      label: 'Water',        icon: '💧',  color: '#48CAE4' },
  { id: 'mining',     label: 'Mining',       icon: '⛏️',  color: '#8B5E3C' },
  { id: 'datacenter', label: 'Data Centers', icon: '🖥️',  color: '#6A0DAD' },
  { id: 'coastal',    label: 'Coastal',      icon: '🌊',  color: '#00B4D8' },
  { id: 'inland',     label: 'Inland',       icon: '🌍',  color: '#52B788' },
]

export const TYPE_COLORS: Record<InfraType, string> = Object.fromEntries(
  CATEGORIES.filter(c => !['coastal', 'inland'].includes(c.id)).map(c => [c.id, c.color])
) as Record<InfraType, string>

export const STATUS_COLORS: Record<string, string> = {
  planned:      '#F59E0B',
  construction: '#3B82F6',
  operational:  '#10B981',
}

export const COUNTRY_FLAGS: Record<string, string> = {
  "Kenya":          '🇰🇪',
  "Nigeria":        '🇳🇬',
  "South Africa":   '🇿🇦',
  "Ethiopia":       '🇪🇹',
  "Egypt":          '🇪🇬',
  "Tanzania":       '🇹🇿',
  "Côte d'Ivoire":  '🇨🇮',
  "Zimbabwe":       '🇿🇼',
  "Mozambique":     '🇲🇿',
  "Lesotho":        '🇱🇸',
  "DR Congo":       '🇨🇩',
  "Ghana":          '🇬🇭',
  "Rwanda":         '🇷🇼',
  "Algeria":        '🇩🇿',
  "Senegal":        '🇸🇳',
  "Zambia":         '🇿🇲',
  "Cameroon":       '🇨🇲',
  "Togo":           '🇹🇬',
  "Multiple":       '🌍',
  "West Africa":    '🌍',
  "Djibouti":       '🇩🇯',
}

// ── Project data ────────────────────────────────────────────────────────────

export const projects: Project[] = [
  // ── PORTS ────────────────────────────────────────────────────────────────
  { id: 1,  name: 'Abidjan Port Expansion',        type: 'port',       category: 'coastal', country: "Côte d'Ivoire", region: 'West Africa',    status: 'construction', value: '$2.3B',  description: 'Major West African port expansion increasing container capacity.', coordinates: [5.3, -4.0],    year: 2024 },
  { id: 2,  name: 'Mombasa Port Development',       type: 'port',       category: 'coastal', country: 'Kenya',         region: 'East Africa',    status: 'operational',  value: '$1.5B',  description: 'East African gateway port — berth expansion and terminal upgrade.', coordinates: [-4.05, 39.66], year: 2022 },
  { id: 3,  name: 'Durban Port Upgrade',            type: 'port',       category: 'coastal', country: 'South Africa',  region: 'Southern Africa',status: 'operational',  value: '$3.1B',  description: 'Largest African container port capacity upgrade.', coordinates: [-29.87, 31.03], year: 2023 },
  { id: 4,  name: 'Dar es Salaam Port',             type: 'port',       category: 'coastal', country: 'Tanzania',      region: 'East Africa',    status: 'construction', value: '$1.2B',  description: 'Tanzania main seaport — new container berths.', coordinates: [-6.82, 39.28], year: 2025 },
  { id: 5,  name: 'Lekki Deep Sea Port',            type: 'port',       category: 'coastal', country: 'Nigeria',       region: 'West Africa',    status: 'operational',  value: '$1.5B',  description: 'Nigeria first deep seaport with 16.5m draft capacity.', coordinates: [6.44, 3.78], year: 2023 },
  { id: 6,  name: 'Maputo Port Expansion',          type: 'port',       category: 'coastal', country: 'Mozambique',    region: 'Southern Africa',status: 'construction', value: '$800M',  description: 'Expansion of container and bulk cargo facilities.', coordinates: [-25.97, 32.57], year: 2025 },
  { id: 7,  name: 'Lomé Container Terminal',        type: 'port',       category: 'coastal', country: 'Togo',          region: 'West Africa',    status: 'operational',  value: '$400M',  description: 'Deep water container terminal serving landlocked countries.', coordinates: [6.13, 1.28], year: 2022 },
  { id: 8,  name: 'Dangote Fertilizer Plant Port',  type: 'port',       category: 'coastal', country: 'Nigeria',       region: 'West Africa',    status: 'operational',  value: '$2.5B',  description: 'Dedicated port for Africa\'s largest fertilizer plant.', coordinates: [6.35, 3.5], year: 2023 },

  // ── AIRPORTS ─────────────────────────────────────────────────────────────
  { id: 9,  name: 'Nairobi Airport Expansion',      type: 'airport',    category: 'inland',  country: 'Kenya',         region: 'East Africa',    status: 'construction', value: '$800M',  description: 'JKIA terminal expansion and capacity upgrade.', coordinates: [-1.32, 36.93], year: 2025 },
  { id: 10, name: 'Addis Ababa Bole Airport',        type: 'airport',    category: 'inland',  country: 'Ethiopia',      region: 'East Africa',    status: 'operational',  value: '$1.1B',  description: 'Africa\'s main aviation hub — terminal expansion complete.', coordinates: [8.97, 38.79], year: 2023 },
  { id: 11, name: 'Lagos Airport Modernization',     type: 'airport',    category: 'inland',  country: 'Nigeria',       region: 'West Africa',    status: 'planned',      value: '$500M',  description: 'MMA2 terminal expansion and modernization project.', coordinates: [6.58, 3.32], year: 2026 },
  { id: 12, name: 'Cairo International Expansion',   type: 'airport',    category: 'inland',  country: 'Egypt',         region: 'North Africa',   status: 'construction', value: '$2.0B',  description: 'New terminal and runway expansion for North Africa\'s busiest airport.', coordinates: [30.11, 31.41], year: 2025 },
  { id: 13, name: 'OR Tambo Upgrade',                type: 'airport',    category: 'inland',  country: 'South Africa',  region: 'Southern Africa',status: 'operational',  value: '$1.3B',  description: 'Johannesburg airport capacity and infrastructure upgrade.', coordinates: [-26.13, 28.24], year: 2022 },
  { id: 14, name: 'Dakar Diass International Airport', type: 'airport',  category: 'coastal', country: 'Senegal',       region: 'West Africa',    status: 'operational',  value: '$575M',  description: 'New international airport replacing Léopold Sédar Senghor.', coordinates: [14.67, -17.07], year: 2022 },

  // ── ROADS ────────────────────────────────────────────────────────────────
  { id: 15, name: 'Trans-African Highway N1',        type: 'road',       category: 'inland',  country: 'Multiple',      region: 'Central Africa', status: 'construction', value: '$4.2B',  description: 'Central African highway corridor spanning multiple countries.', coordinates: [1.5, 15.0], year: 2026 },
  { id: 16, name: 'Lagos-Abidjan Corridor',          type: 'road',       category: 'coastal', country: 'West Africa',   region: 'West Africa',    status: 'planned',      value: '$3.8B',  description: 'West African coastal road linking major economic hubs.', coordinates: [5.5, 0.5], year: 2027 },
  { id: 17, name: 'Nairobi Expressway',              type: 'road',       category: 'inland',  country: 'Kenya',         region: 'East Africa',    status: 'operational',  value: '$668M',  description: '27km elevated expressway from Mlolongo to Westlands.', coordinates: [-1.28, 36.82], year: 2022 },
  { id: 18, name: 'Cairo Ring Road',                 type: 'road',       category: 'inland',  country: 'Egypt',         region: 'North Africa',   status: 'operational',  value: '$1.5B',  description: 'Greater Cairo ring road network expansion.', coordinates: [30.05, 31.25], year: 2022 },
  { id: 19, name: 'Trans-Saharan Highway',           type: 'road',       category: 'inland',  country: 'Algeria',       region: 'North Africa',   status: 'construction', value: '$2.3B',  description: '4,000 km highway connecting Algeria to Nigeria via Sahara.', coordinates: [28.0, 2.0], year: 2026 },
  { id: 20, name: 'South Africa N3 Highway Upgrade', type: 'road',       category: 'inland',  country: 'South Africa',  region: 'Southern Africa',status: 'construction', value: '$900M',  description: 'Dual-carriageway upgrade from Johannesburg to Durban.', coordinates: [-29.0, 30.0], year: 2025 },

  // ── RAILWAYS ─────────────────────────────────────────────────────────────
  { id: 21, name: 'Standard Gauge Railway Kenya',    type: 'rail',       category: 'inland',  country: 'Kenya',         region: 'East Africa',    status: 'operational',  value: '$3.6B',  description: 'Mombasa-Nairobi SGR electrified standard gauge railway.', coordinates: [-1.5, 37.5], year: 2021 },
  { id: 22, name: 'Ethiopia-Djibouti Railway',       type: 'rail',       category: 'inland',  country: 'Ethiopia',      region: 'East Africa',    status: 'operational',  value: '$4.0B',  description: 'Fully electrified rail corridor to the Red Sea coast.', coordinates: [9.5, 42.0], year: 2022 },
  { id: 23, name: 'Tanzania SGR',                    type: 'rail',       category: 'inland',  country: 'Tanzania',      region: 'East Africa',    status: 'construction', value: '$7.6B',  description: 'Dar es Salaam-Mwanza standard gauge railway network.', coordinates: [-6.5, 35.0], year: 2026 },
  { id: 24, name: 'Lagos Rail Mass Transit',         type: 'rail',       category: 'inland',  country: 'Nigeria',       region: 'West Africa',    status: 'construction', value: '$1.2B',  description: 'Urban rail mass transit network for Lagos metropolitan area.', coordinates: [6.5, 3.4], year: 2025 },
  { id: 25, name: 'Lagos-Kano Railway',              type: 'rail',       category: 'inland',  country: 'Nigeria',       region: 'West Africa',    status: 'planned',      value: '$11.1B', description: 'Standard gauge railway connecting Lagos to Kano across Nigeria.', coordinates: [9.0, 7.5], year: 2027 },
  { id: 26, name: 'Accra-Kumasi Rail Revival',       type: 'rail',       category: 'inland',  country: 'Ghana',         region: 'West Africa',    status: 'planned',      value: '$1.8B',  description: 'Rehabilitation of rail line connecting capital to second city.', coordinates: [6.68, -1.62], year: 2026 },
  { id: 27, name: 'Copper Belt Mining Railway',      type: 'rail',       category: 'inland',  country: 'Zambia',        region: 'Southern Africa',status: 'planned',      value: '$1.2B',  description: 'Rail line serving copper mining operations in the Copperbelt.', coordinates: [-13.0, 28.0], year: 2026 },

  // ── DAMS / ENERGY ────────────────────────────────────────────────────────
  { id: 28, name: 'Grand Ethiopian Renaissance Dam', type: 'dam',        category: 'inland',  country: 'Ethiopia',      region: 'East Africa',    status: 'construction', value: '$4.8B',  description: 'Largest African hydropower dam at 6,450 MW on the Blue Nile.', coordinates: [11.21, 35.09], year: 2024 },
  { id: 29, name: 'Julius Nyerere Hydropower',       type: 'dam',        category: 'inland',  country: 'Tanzania',      region: 'East Africa',    status: 'construction', value: '$2.9B',  description: '2,115 MW run-of-river hydropower project on the Rufiji River.', coordinates: [-7.5, 36.5], year: 2024 },
  { id: 30, name: 'Kariba Dam Rehabilitation',       type: 'dam',        category: 'inland',  country: 'Zimbabwe',      region: 'Southern Africa',status: 'construction', value: '$294M',  description: 'Critical dam wall rehabilitation on the Zambezi River.', coordinates: [-16.52, 28.77], year: 2025 },
  { id: 31, name: 'Cahora Bassa Expansion',          type: 'dam',        category: 'inland',  country: 'Mozambique',    region: 'Southern Africa',status: 'planned',      value: '$1.2B',  description: 'Hydropower capacity expansion on the Zambezi River.', coordinates: [-15.57, 32.7], year: 2027 },
  { id: 32, name: 'Inga 3 Hydropower Dam',           type: 'dam',        category: 'inland',  country: 'DR Congo',      region: 'Central Africa', status: 'planned',      value: '$14B',   description: '11,000 MW hydropower project on the Congo River — largest planned in Africa.', coordinates: [-5.5, 13.6], year: 2028 },
  { id: 33, name: 'Nachtigal Hydropower',            type: 'dam',        category: 'inland',  country: 'Cameroon',      region: 'Central Africa', status: 'construction', value: '$1.3B',  description: '420 MW run-of-river hydropower on Sanaga River.', coordinates: [4.33, 11.63], year: 2024 },
  { id: 34, name: 'Zambia-Tanzania Power Link',      type: 'dam',        category: 'inland',  country: 'Zambia',        region: 'Southern Africa',status: 'planned',      value: '$750M',  description: '400 kV transmission line interconnecting Zambia and Tanzania grids.', coordinates: [-13.13, 28.63], year: 2026 },

  // ── HOSPITALS ────────────────────────────────────────────────────────────
  { id: 35, name: 'Aga Khan Hospital Nairobi',       type: 'hospital',   category: 'inland',  country: 'Kenya',         region: 'East Africa',    status: 'operational',  value: '$150M',  description: 'World-class tertiary care medical facility.', coordinates: [-1.26, 36.82], year: 2022 },
  { id: 36, name: 'Lagos University Teaching Hospital', type: 'hospital', category: 'inland', country: 'Nigeria',       region: 'West Africa',    status: 'construction', value: '$200M',  description: 'Major teaching hospital capacity expansion.', coordinates: [6.52, 3.39], year: 2025 },
  { id: 37, name: 'Chris Hani Baragwanath Expansion',type: 'hospital',   category: 'inland',  country: 'South Africa',  region: 'Southern Africa',status: 'planned',      value: '$180M',  description: 'Expansion of one of the world\'s largest hospitals.', coordinates: [-26.27, 27.94], year: 2026 },
  { id: 38, name: 'Muhimbili National Hospital',     type: 'hospital',   category: 'inland',  country: 'Tanzania',      region: 'East Africa',    status: 'construction', value: '$150M',  description: 'Expansion of Tanzania\'s largest national referral hospital.', coordinates: [-6.8, 39.27], year: 2024 },

  // ── WATER ────────────────────────────────────────────────────────────────
  { id: 39, name: 'Nairobi Water Supply',            type: 'water',      category: 'inland',  country: 'Kenya',         region: 'East Africa',    status: 'construction', value: '$400M',  description: 'Greater Nairobi integrated water supply system.', coordinates: [-1.29, 36.79], year: 2025 },
  { id: 40, name: 'Lesotho Highlands Water',         type: 'water',      category: 'inland',  country: 'Lesotho',       region: 'Southern Africa',status: 'operational',  value: '$1.0B',  description: 'Regional water transfer scheme supplying South Africa.', coordinates: [-29.5, 28.5], year: 2021 },
  { id: 41, name: 'Nile Water Treatment Cairo',      type: 'water',      category: 'inland',  country: 'Egypt',         region: 'North Africa',   status: 'operational',  value: '$800M',  description: 'Cairo integrated water treatment and distribution plant.', coordinates: [30.06, 31.22], year: 2022 },
  { id: 42, name: 'West Africa Water Treatment',     type: 'water',      category: 'inland',  country: 'Ghana',         region: 'West Africa',    status: 'operational',  value: '$400M',  description: 'Water treatment plants serving 3 million people across Ghana.', coordinates: [7.94, -1.02], year: 2023 },
  { id: 43, name: 'Abuja Water Supply Project',      type: 'water',      category: 'inland',  country: 'Nigeria',       region: 'West Africa',    status: 'planned',      value: '$600M',  description: 'Integrated water supply infrastructure for 3 million residents.', coordinates: [9.07, 7.4], year: 2026 },

  // ── MINING ───────────────────────────────────────────────────────────────
  { id: 44, name: 'Kibali Gold Mine Infrastructure', type: 'mining',     category: 'inland',  country: 'DR Congo',      region: 'Central Africa', status: 'operational',  value: '$2.5B',  description: 'Gold mining infrastructure including roads, power, and water systems.', coordinates: [3.1, 29.5], year: 2022 },
  { id: 45, name: 'Sirius Phosphate Mine',           type: 'mining',     category: 'inland',  country: 'Tanzania',      region: 'East Africa',    status: 'planned',      value: '$3.0B',  description: 'Large-scale phosphate mining and processing complex.', coordinates: [-8.0, 34.5], year: 2027 },
  { id: 46, name: 'Obuasi Gold Mine Redevelopment',  type: 'mining',     category: 'inland',  country: 'Ghana',         region: 'West Africa',    status: 'operational',  value: '$1.0B',  description: 'Underground gold mine redevelopment and modern processing plant.', coordinates: [6.2, -1.67], year: 2023 },

  // ── DATA CENTERS ─────────────────────────────────────────────────────────
  { id: 47, name: 'Cairo Data Center Hub',           type: 'datacenter', category: 'inland',  country: 'Egypt',         region: 'North Africa',   status: 'construction', value: '$250M',  description: 'Tier-4 data center hub serving North Africa and Middle East.', coordinates: [30.06, 31.24], year: 2024 },
  { id: 48, name: 'Kigali Innovation City',          type: 'datacenter', category: 'inland',  country: 'Rwanda',        region: 'East Africa',    status: 'construction', value: '$2.0B',  description: 'Tech hub with data centers, fiber networks, and smart city infrastructure.', coordinates: [-1.94, 30.06], year: 2025 },
  { id: 49, name: 'Lagos Digital Hub',               type: 'datacenter', category: 'inland',  country: 'Nigeria',       region: 'West Africa',    status: 'planned',      value: '$400M',  description: 'Hyperscale data center complex serving West African digital economy.', coordinates: [6.6, 3.3], year: 2026 },
]

/** Unique sorted countries for the filter dropdown */
export const ALL_COUNTRIES = Array.from(
  new Set(projects.map(p => p.country))
).sort()
