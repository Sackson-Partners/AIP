/**
 * Soft Delete Tests
 *
 * Tests for archive/restore functionality with cascade support.
 */

import {
  archiveProject,
  restoreProject,
  archiveInvestor,
  archiveDocument,
  cleanupArchivedProjects,
  getArchivedCounts,
  includeArchived,
  onlyArchived,
} from '../soft-delete'
import { prisma } from '../prisma'
import { createAuditLog } from '../audit'

// Mock dependencies
jest.mock('../prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    project: {
      update: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    milestone: {
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    document: {
      updateMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    dealRoom: {
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    verification: {
      updateMany: jest.fn(),
    },
    investor: {
      update: jest.fn(),
      count: jest.fn(),
    },
  },
}))

jest.mock('../audit', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('archiveProject', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock transaction to execute callback
    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      return await callback(mockPrisma)
    })
  })

  it('should archive project with cascade', async () => {
    mockPrisma.project.update.mockResolvedValue({
      id: 'proj-123',
      code: 'AIP-2025-001',
      title: 'Test Project',
    } as any)

    mockPrisma.milestone.updateMany.mockResolvedValue({ count: 5 })
    mockPrisma.document.updateMany.mockResolvedValue({ count: 12 })
    mockPrisma.dealRoom.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.verification.updateMany.mockResolvedValue({ count: 2 })

    const result = await archiveProject('proj-123', {
      archivedBy: 'user-456',
      reason: 'Test archive',
      cascade: true,
      auditLog: true,
    })

    expect(result.success).toBe(true)
    expect(result.archivedCount).toBe(1)
    expect(result.cascadedEntities).toEqual({
      milestones: 5,
      documents: 12,
      dealRooms: 1,
      verifications: 2,
    })

    expect(mockPrisma.project.update).toHaveBeenCalledWith({
      where: { id: 'proj-123' },
      data: expect.objectContaining({
        archived: true,
        archivedBy: 'user-456',
      }),
      select: expect.any(Object),
    })

    expect(createAuditLog).toHaveBeenCalledWith({
      userId: 'user-456',
      action: 'PROJECT_ARCHIVED',
      tableName: 'Project',
      recordId: 'proj-123',
      newValues: {
        archived: true,
        reason: 'Test archive',
        cascaded: true,
      },
    })
  })

  it('should archive project without cascade', async () => {
    mockPrisma.project.update.mockResolvedValue({
      id: 'proj-123',
      code: 'AIP-2025-001',
      title: 'Test Project',
    } as any)

    const result = await archiveProject('proj-123', {
      archivedBy: 'user-456',
      cascade: false,
      auditLog: false,
    })

    expect(result.success).toBe(true)
    expect(result.cascadedEntities).toBeUndefined()
    expect(mockPrisma.milestone.updateMany).not.toHaveBeenCalled()
    expect(createAuditLog).not.toHaveBeenCalled()
  })

  it('should handle errors gracefully', async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error('Database error'))

    const result = await archiveProject('proj-123', {
      archivedBy: 'user-456',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Database error')
    expect(result.archivedCount).toBe(0)
  })
})

describe('restoreProject', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      return await callback(mockPrisma)
    })
  })

  it('should restore project with cascade', async () => {
    mockPrisma.project.update.mockResolvedValue({
      id: 'proj-123',
    } as any)

    mockPrisma.milestone.updateMany.mockResolvedValue({ count: 5 })
    mockPrisma.document.updateMany.mockResolvedValue({ count: 12 })
    mockPrisma.dealRoom.updateMany.mockResolvedValue({ count: 1 })

    const result = await restoreProject('proj-123', 'admin-789', true)

    expect(result.success).toBe(true)
    expect(result.cascadedEntities).toEqual({
      milestones: 5,
      documents: 12,
      dealRooms: 1,
    })

    expect(mockPrisma.project.update).toHaveBeenCalledWith({
      where: { id: 'proj-123' },
      data: {
        archived: false,
        archivedAt: null,
        archivedBy: null,
      },
    })

    expect(createAuditLog).toHaveBeenCalledWith({
      userId: 'admin-789',
      action: 'PROJECT_RESTORED',
      tableName: 'Project',
      recordId: 'proj-123',
      newValues: {
        archived: false,
        cascaded: true,
      },
    })
  })

  it('should restore project without cascade', async () => {
    mockPrisma.project.update.mockResolvedValue({
      id: 'proj-123',
    } as any)

    const result = await restoreProject('proj-123', 'admin-789', false)

    expect(result.success).toBe(true)
    expect(result.cascadedEntities).toBeUndefined()
    expect(mockPrisma.milestone.updateMany).not.toHaveBeenCalled()
  })
})

describe('archiveInvestor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      return await callback(mockPrisma)
    })
  })

  it('should archive investor profile', async () => {
    mockPrisma.investor.update.mockResolvedValue({
      id: 'inv-123',
    } as any)

    const result = await archiveInvestor('inv-123', {
      archivedBy: 'admin-456',
      reason: 'Inactive investor',
      auditLog: true,
    })

    expect(result.success).toBe(true)
    expect(result.archivedCount).toBe(1)

    expect(mockPrisma.investor.update).toHaveBeenCalledWith({
      where: { id: 'inv-123' },
      data: expect.objectContaining({
        archived: true,
      }),
    })

    expect(createAuditLog).toHaveBeenCalledWith({
      userId: 'admin-456',
      action: 'INVESTOR_ARCHIVED',
      tableName: 'Investor',
      recordId: 'inv-123',
      newValues: {
        archived: true,
        reason: 'Inactive investor',
      },
    })
  })
})

describe('archiveDocument', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      return await callback(mockPrisma)
    })
  })

  it('should archive document', async () => {
    mockPrisma.document.update.mockResolvedValue({
      id: 'doc-123',
    } as any)

    const result = await archiveDocument('doc-123', {
      archivedBy: 'user-456',
      reason: 'Outdated',
      auditLog: true,
    })

    expect(result.success).toBe(true)
    expect(result.archivedCount).toBe(1)

    expect(createAuditLog).toHaveBeenCalledWith({
      userId: 'user-456',
      action: 'DOCUMENT_ARCHIVED',
      tableName: 'Document',
      recordId: 'doc-123',
      newValues: {
        archived: true,
        reason: 'Outdated',
      },
    })
  })
})

describe('cleanupArchivedProjects', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should delete old archived projects', async () => {
    const oldDate = new Date('2025-01-01')
    mockPrisma.project.findMany.mockResolvedValue([
      { id: 'proj-1', code: 'AIP-2024-001' },
      { id: 'proj-2', code: 'AIP-2024-002' },
    ] as any)

    mockPrisma.project.deleteMany.mockResolvedValue({ count: 2 })

    const deletedCount = await cleanupArchivedProjects(365, 'system')

    expect(deletedCount).toBe(2)

    expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
      where: {
        archived: true,
        archivedAt: {
          lt: expect.any(Date),
        },
      },
      select: { id: true, code: true },
    })

    expect(mockPrisma.project.deleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['proj-1', 'proj-2'] },
      },
    })

    expect(createAuditLog).toHaveBeenCalledWith({
      userId: 'system',
      action: 'CLEANUP_ARCHIVED_PROJECTS',
      tableName: 'Project',
      recordId: 'bulk',
      newValues: expect.objectContaining({
        deletedCount: 2,
        olderThanDays: 365,
      }),
    })
  })

  it('should handle no projects to cleanup', async () => {
    mockPrisma.project.findMany.mockResolvedValue([])

    const deletedCount = await cleanupArchivedProjects(365, 'system')

    expect(deletedCount).toBe(0)
    expect(mockPrisma.project.deleteMany).not.toHaveBeenCalled()
  })

  it('should handle cleanup errors', async () => {
    mockPrisma.project.findMany.mockRejectedValue(new Error('Database error'))

    const deletedCount = await cleanupArchivedProjects(365, 'system')

    expect(deletedCount).toBe(0)
  })
})

describe('getArchivedCounts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return counts of archived entities', async () => {
    mockPrisma.project.count.mockResolvedValue(45)
    mockPrisma.investor.count.mockResolvedValue(12)
    mockPrisma.document.count.mockResolvedValue(234)
    mockPrisma.dealRoom.count.mockResolvedValue(8)
    mockPrisma.milestone.count.mockResolvedValue(156)

    const counts = await getArchivedCounts()

    expect(counts).toEqual({
      projects: 45,
      investors: 12,
      documents: 234,
      dealRooms: 8,
      milestones: 156,
    })

    expect(mockPrisma.project.count).toHaveBeenCalledWith({
      where: { archived: true },
    })
  })
})

describe('Query helpers', () => {
  describe('includeArchived', () => {
    it('should return query options to include archived', () => {
      const result = includeArchived()
      expect(result).toEqual({
        where: {},
      })
    })

    it('should merge with existing where clause', () => {
      const result = includeArchived({ status: 'ACTIVE' })
      expect(result).toEqual({
        where: {
          status: 'ACTIVE',
        },
      })
    })
  })

  describe('onlyArchived', () => {
    it('should return query options for only archived', () => {
      const result = onlyArchived()
      expect(result).toEqual({
        where: {
          archived: true,
        },
      })
    })

    it('should merge with existing where clause', () => {
      const result = onlyArchived({ country: 'Kenya' })
      expect(result).toEqual({
        where: {
          country: 'Kenya',
          archived: true,
        },
      })
    })
  })
})
