import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { getCached, setCached, CacheTTL } from '@/lib/redis'
import { UserRole, ProjectStatus } from '@prisma/client'

const INTERNAL_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ANALYST]
const PUBLISHED_STATUSES: ProjectStatus[] = [ProjectStatus.ACTIVE, ProjectStatus.FUNDED, ProjectStatus.CLOSED]

// Country coordinates for African countries and major economies
const COUNTRY_COORDS: Record<string, [number, number]> = {
  // Africa
  'nigeria': [9.0820, 8.6753],
  'ghana': [7.9465, -1.0232],
  'kenya': [-0.0236, 37.9062],
  'ethiopia': [9.1450, 40.4897],
  'tanzania': [-6.3690, 34.8888],
  'uganda': [1.3733, 32.2903],
  'mozambique': [-18.6657, 35.5296],
  'zambia': [-13.1339, 27.8493],
  'zimbabwe': [-19.0154, 29.1549],
  'south africa': [-30.5595, 22.9375],
  'senegal': [14.4974, -14.4524],
  'ivory coast': [7.5400, -5.5471],
  "cote d'ivoire": [7.5400, -5.5471],
  'cameroon': [7.3697, 12.3547],
  'morocco': [31.7917, -7.0926],
  'egypt': [26.8206, 30.8025],
  'tunisia': [33.8869, 9.5375],
  'angola': [-11.2027, 17.8739],
  'namibia': [-22.9576, 18.4904],
  'botswana': [-22.3285, 24.6849],
  'rwanda': [-1.9403, 29.8739],
  'malawi': [-13.2543, 34.3015],
  'madagascar': [-18.7669, 46.8691],
  'congo': [-4.0383, 21.7587],
  'drc': [-4.0383, 21.7587],
  'sudan': [12.8628, 30.2176],
  'somalia': [5.1521, 46.1996],
  'liberia': [6.4281, -9.4295],
  'sierra leone': [8.4606, -11.7799],
  'togo': [8.6195, 0.8248],
  'benin': [9.3077, 2.3158],
  'niger': [17.6078, 8.0817],
  'mali': [17.5707, -3.9962],
  'burkina faso': [12.2383, -1.5616],
  'guinea': [9.9456, -9.6966],
  'chad': [15.4542, 18.7322],
  'eritrea': [15.1794, 39.7823],
  'djibouti': [11.8251, 42.5903],
  'lesotho': [-29.6100, 28.2336],
  'eswatini': [-26.5225, 31.4659],
  'swaziland': [-26.5225, 31.4659],
  'gabon': [-0.8037, 11.6094],
  'mauritius': [-20.3484, 57.5522],
  'seychelles': [-4.6796, 55.4920],
  // Other regions for reference
  'india': [20.5937, 78.9629],
  'pakistan': [30.3753, 69.3451],
  'bangladesh': [23.6850, 90.3563],
  'indonesia': [-0.7893, 113.9213],
  'vietnam': [14.0583, 108.2772],
  'thailand': [15.8700, 100.9925],
  'philippines': [12.8797, 121.7740],
  'malaysia': [4.2105, 101.9758],
  'brazil': [-14.2350, -51.9253],
  'colombia': [4.5709, -74.2973],
  'peru': [-9.1900, -75.0152],
  'chile': [-35.6751, -71.5430],
  'mexico': [23.6345, -102.5528],
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userRole = session.user.role as UserRole
  const isInternal = INTERNAL_ROLES.includes(userRole)

  // Generate cache key
  const cacheKey = `projects:map:${userRole}`

  // Try cache first
  const cached = await getCached<{ type: string; features: unknown[] }>(cacheKey)
  if (cached) {
    return NextResponse.json(cached)
  }

  try {
    // Fetch projects based on user role
    // Internal staff: all projects with valid countries
    // External partners: only published projects (ACTIVE, FUNDED, CLOSED)
    const projects = await prisma.project.findMany({
      where: {
        ...(!isInternal ? { status: { in: PUBLISHED_STATUSES } } : {}),
        country: { not: null },
        archived: false,
      },
      select: {
        id: true,
        title: true,
        country: true,
        sector: true,
        dealStage: true,
        status: true,
        totalCost: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Build GeoJSON features
    const features = projects
      .filter((p) => {
        const country = p.country?.toLowerCase()
        return country && COUNTRY_COORDS[country]
      })
      .map((p) => {
        const country = p.country!.toLowerCase()
        const coords = COUNTRY_COORDS[country]!

        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [coords[1], coords[0]], // [lng, lat] for GeoJSON
          },
          properties: {
            id: p.id,
            title: p.title || 'Untitled Project',
            country: p.country,
            sector: p.sector || 'Other',
            stage: p.dealStage || p.status || 'CONCEPT',
            totalCost: p.totalCost,
          },
        }
      })

    const geojson = {
      type: 'FeatureCollection',
      features,
    }

    // Cache for 5 minutes
    await setCached(cacheKey, geojson, CacheTTL.MEDIUM)

    return NextResponse.json(geojson)
  } catch (error) {
    console.error('[GET /api/projects/map-data] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
