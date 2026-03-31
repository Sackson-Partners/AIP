export interface InfrastructureProject {
  id: number
  name: string
  type: 'port' | 'airport' | 'road' | 'railway' | 'dam' | 'hospital' | 'water'
  category: 'coastal' | 'inland'
  country: string
  status: 'planned' | 'construction' | 'operational'
  coordinates: [number, number]
  value: string
  description: string
}

export const infrastructureProjects: InfrastructureProject[] = [
  // PORTS (Coastal)
  { id: 1, name: 'Abidjan Port Expansion', type: 'port', category: 'coastal', country: "Côte d'Ivoire", status: 'construction', coordinates: [5.3, -4.0], value: '$2.3B', description: 'Major West African port expansion' },
  { id: 2, name: 'Mombasa Port Development', type: 'port', category: 'coastal', country: 'Kenya', status: 'operational', coordinates: [-4.05, 39.66], value: '$1.5B', description: 'East African gateway port' },
  { id: 3, name: 'Durban Port Upgrade', type: 'port', category: 'coastal', country: 'South Africa', status: 'operational', coordinates: [-29.87, 31.03], value: '$3.1B', description: 'Largest African container port' },
  { id: 4, name: 'Dar es Salaam Port', type: 'port', category: 'coastal', country: 'Tanzania', status: 'construction', coordinates: [-6.82, 39.28], value: '$1.2B', description: 'Tanzania main seaport' },
  { id: 5, name: 'Lagos Lekki Deep Sea Port', type: 'port', category: 'coastal', country: 'Nigeria', status: 'operational', coordinates: [6.43, 3.57], value: '$1.6B', description: 'Nigeria deep sea port' },

  // AIRPORTS
  { id: 6, name: 'Nairobi Airport Expansion', type: 'airport', category: 'inland', country: 'Kenya', status: 'construction', coordinates: [-1.32, 36.93], value: '$800M', description: 'JKIA terminal expansion' },
  { id: 7, name: 'Addis Ababa Bole Airport', type: 'airport', category: 'inland', country: 'Ethiopia', status: 'operational', coordinates: [8.97, 38.79], value: '$1.1B', description: 'African aviation hub' },
  { id: 8, name: 'Lagos Airport Modernization', type: 'airport', category: 'inland', country: 'Nigeria', status: 'planned', coordinates: [6.58, 3.32], value: '$500M', description: 'MMA2 expansion project' },
  { id: 9, name: 'Cairo International Expansion', type: 'airport', category: 'inland', country: 'Egypt', status: 'construction', coordinates: [30.11, 31.41], value: '$2.0B', description: 'North Africa hub expansion' },
  { id: 10, name: 'OR Tambo Upgrade', type: 'airport', category: 'inland', country: 'South Africa', status: 'operational', coordinates: [-26.13, 28.24], value: '$1.3B', description: 'Johannesburg airport upgrade' },

  // ROADS
  { id: 11, name: 'Trans-African Highway N1', type: 'road', category: 'inland', country: 'Multiple', status: 'construction', coordinates: [1.5, 15.0], value: '$4.2B', description: 'Central African highway corridor' },
  { id: 12, name: 'Lagos-Abidjan Corridor', type: 'road', category: 'coastal', country: 'West Africa', status: 'planned', coordinates: [5.5, 0.5], value: '$3.8B', description: 'West African coastal road' },
  { id: 13, name: 'Nairobi Expressway', type: 'road', category: 'inland', country: 'Kenya', status: 'operational', coordinates: [-1.28, 36.82], value: '$668M', description: 'Nairobi-JKIA expressway' },
  { id: 14, name: 'Cairo Ring Road', type: 'road', category: 'inland', country: 'Egypt', status: 'operational', coordinates: [30.05, 31.25], value: '$1.5B', description: 'Greater Cairo road network' },

  // RAILWAYS
  { id: 15, name: 'Standard Gauge Railway Kenya', type: 'railway', category: 'inland', country: 'Kenya', status: 'operational', coordinates: [-1.5, 37.5], value: '$3.6B', description: 'Mombasa-Nairobi SGR' },
  { id: 16, name: 'Ethiopia-Djibouti Railway', type: 'railway', category: 'inland', country: 'Ethiopia', status: 'operational', coordinates: [9.5, 42.0], value: '$4.0B', description: 'Electric rail corridor' },
  { id: 17, name: 'Tanzania SGR', type: 'railway', category: 'inland', country: 'Tanzania', status: 'construction', coordinates: [-6.5, 35.0], value: '$7.6B', description: 'Dar es Salaam-Mwanza SGR' },
  { id: 18, name: 'Lagos Rail Mass Transit', type: 'railway', category: 'inland', country: 'Nigeria', status: 'construction', coordinates: [6.5, 3.4], value: '$1.2B', description: 'Urban rail network' },

  // DAMS / ENERGY
  { id: 19, name: 'Grand Ethiopian Renaissance Dam', type: 'dam', category: 'inland', country: 'Ethiopia', status: 'construction', coordinates: [11.21, 35.09], value: '$4.8B', description: 'Largest African hydropower dam' },
  { id: 20, name: 'Kariba Dam Rehabilitation', type: 'dam', category: 'inland', country: 'Zimbabwe', status: 'construction', coordinates: [-16.52, 28.77], value: '$294M', description: 'Kariba dam wall rehabilitation' },
  { id: 21, name: 'Cahora Bassa Expansion', type: 'dam', category: 'inland', country: 'Mozambique', status: 'planned', coordinates: [-15.57, 32.7], value: '$1.2B', description: 'Hydropower expansion' },

  // HOSPITALS
  { id: 22, name: 'Aga Khan Hospital Nairobi', type: 'hospital', category: 'inland', country: 'Kenya', status: 'operational', coordinates: [-1.26, 36.82], value: '$150M', description: 'World-class medical facility' },
  { id: 23, name: 'Lagos University Teaching Hospital', type: 'hospital', category: 'inland', country: 'Nigeria', status: 'construction', coordinates: [6.52, 3.39], value: '$200M', description: 'Teaching hospital upgrade' },
  { id: 24, name: 'Chris Hani Baragwanath Expansion', type: 'hospital', category: 'inland', country: 'South Africa', status: 'planned', coordinates: [-26.27, 27.94], value: '$180M', description: 'Largest hospital expansion' },

  // WATER
  { id: 25, name: 'Nairobi Water Supply', type: 'water', category: 'inland', country: 'Kenya', status: 'construction', coordinates: [-1.29, 36.79], value: '$400M', description: 'Greater Nairobi water system' },
  { id: 26, name: 'Lesotho Highlands Water', type: 'water', category: 'inland', country: 'Lesotho', status: 'operational', coordinates: [-29.5, 28.5], value: '$1.0B', description: 'Regional water transfer' },
  { id: 27, name: 'Nile Water Treatment Cairo', type: 'water', category: 'inland', country: 'Egypt', status: 'operational', coordinates: [30.06, 31.22], value: '$800M', description: 'Cairo water treatment plant' },
]

export const TYPE_COLORS: Record<string, string> = {
  port:     '#1A73E8',
  airport:  '#9C27B0',
  road:     '#FF9800',
  railway:  '#555555',
  dam:      '#2196F3',
  hospital: '#F44336',
  water:    '#00BCD4',
}

export const STATUS_COLORS: Record<string, string> = {
  operational:  '#22C55E',
  construction: '#F97316',
  planned:      '#818CF8',
}

export const TYPE_ICONS: Record<string, string> = {
  port:     '⚓',
  airport:  '✈️',
  road:     '🛣️',
  railway:  '🚆',
  dam:      '⚡',
  hospital: '🏥',
  water:    '💧',
}

export const COUNTRY_FLAGS: Record<string, string> = {
  'Kenya':          '🇰🇪',
  'Nigeria':        '🇳🇬',
  'South Africa':   '🇿🇦',
  'Ethiopia':       '🇪🇹',
  'Egypt':          '🇪🇬',
  'Tanzania':       '🇹🇿',
  "Côte d'Ivoire":  '🇨🇮',
  'Zimbabwe':       '🇿🇼',
  'Mozambique':     '🇲🇿',
  'Lesotho':        '🇱🇸',
  'Multiple':       '🌍',
  'West Africa':    '🌍',
  'Djibouti':       '🇩🇯',
}
