// ── Infrastructure project types ───────────────────────────────────────────

export type InfraType =
  | 'road' | 'rail' | 'airport' | 'port' | 'dam'
  | 'hospital' | 'water' | 'mining' | 'datacenter'

export type LocationCategory = 'coastal' | 'inland'

/** All filterable category IDs (infrastructure types + location categories) */
export type CategoryId = InfraType | LocationCategory

export interface Project {
  id: number
  name: string
  type: InfraType
  category: LocationCategory
  country: string
  region: string
  status: 'planned' | 'construction' | 'operational'
  value: string
  description: string
  coordinates: [number, number]
  year: number
}

export interface Category {
  id: CategoryId
  label: string
  icon: string
  color: string
}

export interface FilterState {
  categories: CategoryId[]
  status: 'all' | 'planned' | 'construction' | 'operational'
  country: string
}
