/**
 * Duplicate Detection Tests
 *
 * Tests for fuzzy matching, geographic distance, and duplicate scoring algorithms.
 */

import {
  detectDuplicates,
  isLikelyDuplicate,
  formatDuplicateMatches,
} from '../duplicate-detection'
import { prisma } from '../prisma'

// Mock Prisma
jest.mock('../prisma', () => ({
  prisma: {
    project: {
      findMany: jest.fn(),
    },
  },
}))

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('detectDuplicates', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should detect exact title match', async () => {
    mockPrisma.project.findMany.mockResolvedValue([
      {
        id: 'proj-123',
        code: 'AIP-2025-001',
        title: 'Solar Power Plant Kenya',
        country: 'Kenya',
        sector: 'Energy',
        totalCost: 50000000,
        latitude: -1.2921,
        longitude: 36.8219,
        status: 'ACTIVE',
        archived: false,
      },
    ] as any)

    const matches = await detectDuplicates({
      title: 'Solar Power Plant Kenya',
      country: 'Kenya',
      sector: 'Energy',
      totalCost: 50000000,
    })

    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0].similarity).toBeGreaterThan(0.5)
    expect(matches[0].reasons.some(r => r.includes('Similar title'))).toBe(true)
  })

  it('should detect similar title with typos', async () => {
    mockPrisma.project.findMany.mockResolvedValue([
      {
        id: 'proj-123',
        code: 'AIP-2025-001',
        title: 'Solar Power Plant in Kenya',
        country: 'Kenya',
        sector: 'Energy',
        totalCost: 50000000,
        latitude: null,
        longitude: null,
        status: 'ACTIVE',
        archived: false,
      },
    ] as any)

    const matches = await detectDuplicates({
      title: 'Solar Power Plant Kenya',
      country: 'Kenya',
      sector: 'Energy',
    })

    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0].reasons.some(r => r.includes('Similar title'))).toBe(true)
  })

  it('should detect geographic proximity', async () => {
    mockPrisma.project.findMany.mockResolvedValue([
      {
        id: 'proj-123',
        code: 'AIP-2025-001',
        title: 'Nairobi Infrastructure',
        country: 'Kenya',
        sector: 'Transport',
        totalCost: 30000000,
        latitude: -1.2864, // ~0.6km from test location
        longitude: 36.8172,
        status: 'ACTIVE',
        archived: false,
      },
    ] as any)

    const matches = await detectDuplicates({
      title: 'Nairobi Road Project',
      country: 'Kenya',
      sector: 'Transport',
      latitude: -1.2921,
      longitude: 36.8219,
    })

    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0].reasons.some(r => r.includes('km'))).toBe(true)
  })

  it('should detect similar cost', async () => {
    mockPrisma.project.findMany.mockResolvedValue([
      {
        id: 'proj-123',
        code: 'AIP-2025-001',
        title: 'Different Project',
        country: 'Kenya',
        sector: 'Energy',
        totalCost: 51000000, // Within 20% of 50M
        latitude: null,
        longitude: null,
        status: 'ACTIVE',
        archived: false,
      },
    ] as any)

    const matches = await detectDuplicates({
      title: 'Test Project',
      country: 'Kenya',
      sector: 'Energy',
      totalCost: 50000000,
    })

    expect(matches.length).toBeGreaterThan(0)
  })

  it('should exclude specific project ID', async () => {
    mockPrisma.project.findMany.mockResolvedValue([])

    await detectDuplicates({
      title: 'Test Project',
      country: 'Kenya',
      excludeProjectId: 'proj-exclude',
    })

    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: 'proj-exclude' },
        }),
      })
    )
  })

  it('should filter by country when provided', async () => {
    mockPrisma.project.findMany.mockResolvedValue([])

    await detectDuplicates({
      title: 'Test Project',
      country: 'Kenya',
    })

    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          country: 'Kenya',
        }),
      })
    )
  })

  it('should filter by sector when provided', async () => {
    mockPrisma.project.findMany.mockResolvedValue([])

    await detectDuplicates({
      title: 'Test Project',
      sector: 'Energy',
    })

    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sector: 'Energy',
        }),
      })
    )
  })

  it('should return empty array when no candidates found', async () => {
    mockPrisma.project.findMany.mockResolvedValue([])

    const matches = await detectDuplicates({
      title: 'Unique Project',
      country: 'Rwanda',
    })

    expect(matches).toEqual([])
  })
})

describe('isLikelyDuplicate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return true for high confidence duplicates', async () => {
    mockPrisma.project.findMany.mockResolvedValue([
      {
        id: 'proj-123',
        code: 'AIP-2025-001',
        title: 'Solar Power Plant Kenya',
        country: 'Kenya',
        sector: 'Energy',
        totalCost: 50000000,
        latitude: -1.2921,
        longitude: 36.8219,
        status: 'ACTIVE',
        archived: false,
      },
    ] as any)

    const isLikely = await isLikelyDuplicate({
      title: 'Solar Power Plant Kenya',
      country: 'Kenya',
      sector: 'Energy',
      totalCost: 50000000,
      latitude: -1.2921,
      longitude: 36.8219,
    })

    expect(isLikely).toBe(true)
  })

  it('should return false when no strong matches', async () => {
    mockPrisma.project.findMany.mockResolvedValue([
      {
        id: 'proj-123',
        code: 'AIP-2025-001',
        title: 'Completely Different Project',
        country: 'Tanzania',
        sector: 'Water',
        totalCost: 10000000,
        latitude: null,
        longitude: null,
        status: 'ACTIVE',
        archived: false,
      },
    ] as any)

    const isLikely = await isLikelyDuplicate({
      title: 'Solar Power Plant Kenya',
      country: 'Kenya',
      sector: 'Energy',
      totalCost: 50000000,
    })

    expect(isLikely).toBe(false)
  })
})

describe('formatDuplicateMatches', () => {
  it('should format matches for API response', () => {
    const matches = [
      {
        projectId: 'proj-123',
        projectCode: 'AIP-2025-001',
        projectTitle: 'Solar Plant Kenya',
        country: 'Kenya',
        sector: 'Energy',
        status: 'ACTIVE',
        similarity: 0.92,
        reasons: ['Similar title', 'Same location', 'Similar cost'],
      },
    ]

    const formatted = formatDuplicateMatches(matches)

    expect(formatted).toHaveLength(1)
    expect(formatted[0]).toMatchObject({
      id: 'proj-123',
      code: 'AIP-2025-001',
      title: 'Solar Plant Kenya',
      similarity: 0.92,
      reasons: ['Similar title', 'Same location', 'Similar cost'],
    })
  })

  it('should format all matches', () => {
    const matches = Array.from({ length: 5 }, (_, i) => ({
      projectId: `proj-${i}`,
      projectCode: `AIP-2025-${i.toString().padStart(3, '0')}`,
      projectTitle: `Project ${i}`,
      country: 'Kenya',
      sector: 'Energy',
      status: 'ACTIVE' as const,
      similarity: 0.8,
      reasons: ['Similar title'],
    }))

    const formatted = formatDuplicateMatches(matches)
    expect(formatted).toHaveLength(5)
    expect(formatted[0].id).toBe('proj-0')
  })

  it('should handle empty array', () => {
    const formatted = formatDuplicateMatches([])
    expect(formatted).toEqual([])
  })
})
