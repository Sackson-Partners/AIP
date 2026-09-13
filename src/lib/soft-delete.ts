/**
 * Soft Delete Utilities
 *
 * Provides consistent soft delete functionality with cascading archives,
 * audit trails, and Prisma query extensions.
 */

import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { logger } from '@/lib/logger'

/**
 * Soft delete options
 */
export interface SoftDeleteOptions {
  /** User ID performing the archive */
  archivedBy: string
  /** Reason for archiving (optional) */
  reason?: string
  /** Whether to cascade archive to related entities */
  cascade?: boolean
  /** Create audit log entry */
  auditLog?: boolean
}

/**
 * Soft delete result
 */
export interface SoftDeleteResult {
  success: boolean
  archivedCount: number
  cascadedEntities?: {
    [entity: string]: number
  }
  error?: string
}

/**
 * Archive a project and optionally cascade to related entities
 *
 * @param projectId Project ID to archive
 * @param options Soft delete options
 * @returns Result with archived count
 */
export async function archiveProject(
  projectId: string,
  options: SoftDeleteOptions
): Promise<SoftDeleteResult> {
  const { archivedBy, reason, cascade = true, auditLog = true } = options

  try {
    const now = new Date()
    let cascadedEntities: Record<string, number> = {}

    await prisma.$transaction(async (tx) => {
      // Archive the project
      const project = await tx.project.update({
        where: { id: projectId },
        data: {
          archived: true,
          archivedAt: now,
          archivedBy,
        },
        select: {
          id: true,
          code: true,
          title: true,
        },
      })

      logger.info('Project archived', {
        projectId: project.id,
        projectCode: project.code,
        archivedBy,
        reason,
      })

      // Cascade archive to related entities
      if (cascade) {
        // Archive milestones
        const milestones = await tx.milestone.updateMany({
          where: {
            projectId,
            archived: false,
          },
          data: {
            archived: true,
            archivedAt: now,
          },
        })
        cascadedEntities.milestones = milestones.count

        // Archive documents
        const documents = await tx.document.updateMany({
          where: {
            projectId,
            archived: false,
          },
          data: {
            archived: true,
            archivedAt: now,
          },
        })
        cascadedEntities.documents = documents.count

        // Archive deal rooms (if any)
        const dealRooms = await tx.dealRoom.updateMany({
          where: {
            projectId,
            archived: false,
          },
          data: {
            archived: true,
            archivedAt: now,
          },
        })
        cascadedEntities.dealRooms = dealRooms.count

        // Close verifications (don't archive, just mark as closed)
        const verifications = await tx.verification.updateMany({
          where: {
            projectId,
            status: { in: ['PENDING', 'IN_PROGRESS'] },
          },
          data: {
            status: 'CANCELLED',
          },
        })
        cascadedEntities.verifications = verifications.count

        logger.info('Cascaded archive to related entities', {
          projectId,
          cascaded: cascadedEntities,
        })
      }

      // Create audit log
      if (auditLog) {
        await createAuditLog({
          userId: archivedBy,
          action: 'PROJECT_ARCHIVED',
          tableName: 'Project',
          recordId: projectId,
          newValues: {
            archived: true,
            reason,
            cascaded: cascade,
          },
        })
      }
    })

    return {
      success: true,
      archivedCount: 1,
      ...(cascade && { cascadedEntities }),
    }
  } catch (error) {
    logger.error('Failed to archive project', error, {
      projectId,
      archivedBy,
    })

    return {
      success: false,
      archivedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Restore an archived project and optionally restore related entities
 *
 * @param projectId Project ID to restore
 * @param restoredBy User ID performing the restore
 * @param cascade Whether to restore related entities
 * @returns Result with restored count
 */
export async function restoreProject(
  projectId: string,
  restoredBy: string,
  cascade = true
): Promise<SoftDeleteResult> {
  try {
    let cascadedEntities: Record<string, number> = {}

    await prisma.$transaction(async (tx) => {
      // Restore the project
      await tx.project.update({
        where: { id: projectId },
        data: {
          archived: false,
          archivedAt: null,
          archivedBy: null,
        },
      })

      logger.info('Project restored', {
        projectId,
        restoredBy,
      })

      // Cascade restore to related entities
      if (cascade) {
        // Restore milestones
        const milestones = await tx.milestone.updateMany({
          where: {
            projectId,
            archived: true,
          },
          data: {
            archived: false,
            archivedAt: null,
          },
        })
        cascadedEntities.milestones = milestones.count

        // Restore documents
        const documents = await tx.document.updateMany({
          where: {
            projectId,
            archived: true,
          },
          data: {
            archived: false,
            archivedAt: null,
          },
        })
        cascadedEntities.documents = documents.count

        // Restore deal rooms
        const dealRooms = await tx.dealRoom.updateMany({
          where: {
            projectId,
            archived: true,
          },
          data: {
            archived: false,
            archivedAt: null,
          },
        })
        cascadedEntities.dealRooms = dealRooms.count

        logger.info('Cascaded restore to related entities', {
          projectId,
          cascaded: cascadedEntities,
        })
      }

      // Create audit log
      await createAuditLog({
        userId: restoredBy,
        action: 'PROJECT_RESTORED',
        tableName: 'Project',
        recordId: projectId,
        newValues: {
          archived: false,
          cascaded: cascade,
        },
      })
    })

    return {
      success: true,
      archivedCount: 1,
      ...(cascade && { cascadedEntities }),
    }
  } catch (error) {
    logger.error('Failed to restore project', error, {
      projectId,
      restoredBy,
    })

    return {
      success: false,
      archivedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Archive an investor profile
 *
 * @param investorId Investor ID to archive
 * @param options Soft delete options
 * @returns Result with archived count
 */
export async function archiveInvestor(
  investorId: string,
  options: SoftDeleteOptions
): Promise<SoftDeleteResult> {
  const { archivedBy, reason, auditLog = true } = options

  try {
    await prisma.$transaction(async (tx) => {
      await tx.investor.update({
        where: { id: investorId },
        data: {
          archived: true,
          archivedAt: new Date(),
        },
      })

      if (auditLog) {
        await createAuditLog({
          userId: archivedBy,
          action: 'INVESTOR_ARCHIVED',
          tableName: 'Investor',
          recordId: investorId,
          newValues: {
            archived: true,
            reason,
          },
        })
      }
    })

    logger.info('Investor archived', {
      investorId,
      archivedBy,
      reason,
    })

    return {
      success: true,
      archivedCount: 1,
    }
  } catch (error) {
    logger.error('Failed to archive investor', error, {
      investorId,
      archivedBy,
    })

    return {
      success: false,
      archivedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Archive a document
 *
 * @param documentId Document ID to archive
 * @param options Soft delete options
 * @returns Result with archived count
 */
export async function archiveDocument(
  documentId: string,
  options: SoftDeleteOptions
): Promise<SoftDeleteResult> {
  const { archivedBy, reason, auditLog = true } = options

  try {
    await prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: documentId },
        data: {
          archived: true,
          archivedAt: new Date(),
        },
      })

      if (auditLog) {
        await createAuditLog({
          userId: archivedBy,
          action: 'DOCUMENT_ARCHIVED',
          tableName: 'Document',
          recordId: documentId,
          newValues: {
            archived: true,
            reason,
          },
        })
      }
    })

    logger.info('Document archived', {
      documentId,
      archivedBy,
      reason,
    })

    return {
      success: true,
      archivedCount: 1,
    }
  } catch (error) {
    logger.error('Failed to archive document', error, {
      documentId,
      archivedBy,
    })

    return {
      success: false,
      archivedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Permanently delete archived projects older than specified days
 * (Hard delete for cleanup)
 *
 * @param olderThanDays Delete projects archived more than N days ago
 * @param performedBy User ID performing cleanup
 * @returns Number of projects deleted
 */
export async function cleanupArchivedProjects(
  olderThanDays: number,
  performedBy: string
): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

  try {
    const archivedProjects = await prisma.project.findMany({
      where: {
        archived: true,
        archivedAt: {
          lt: cutoffDate,
        },
      },
      select: { id: true, code: true },
    })

    if (archivedProjects.length === 0) {
      logger.info('No archived projects to clean up', {
        olderThanDays,
        cutoffDate,
      })
      return 0
    }

    // Hard delete projects (will cascade delete related entities via DB constraints)
    const deleted = await prisma.project.deleteMany({
      where: {
        id: { in: archivedProjects.map(p => p.id) },
      },
    })

    logger.warn('Permanently deleted archived projects', {
      count: deleted.count,
      olderThanDays,
      performedBy,
      projectCodes: archivedProjects.map(p => p.code),
    })

    await createAuditLog({
      userId: performedBy,
      action: 'CLEANUP_ARCHIVED_PROJECTS',
      tableName: 'Project',
      recordId: 'bulk',
      newValues: {
        deletedCount: deleted.count,
        olderThanDays,
        cutoffDate: cutoffDate.toISOString(),
      },
    })

    return deleted.count
  } catch (error) {
    logger.error('Failed to cleanup archived projects', error, {
      olderThanDays,
      performedBy,
    })
    return 0
  }
}

/**
 * Get count of archived entities by type
 *
 * @returns Counts of archived entities
 */
export async function getArchivedCounts(): Promise<{
  projects: number
  investors: number
  documents: number
  dealRooms: number
  milestones: number
}> {
  const [projects, investors, documents, dealRooms, milestones] = await Promise.all([
    prisma.project.count({ where: { archived: true } }),
    prisma.investor.count({ where: { archived: true } }),
    prisma.document.count({ where: { archived: true } }),
    prisma.dealRoom.count({ where: { archived: true } }),
    prisma.milestone.count({ where: { archived: true } }),
  ])

  return {
    projects,
    investors,
    documents,
    dealRooms,
    milestones,
  }
}

/**
 * Prisma middleware to automatically exclude archived records
 * Add this to your Prisma client initialization
 *
 * @example
 * import { addSoftDeleteMiddleware } from '@/lib/soft-delete'
 * addSoftDeleteMiddleware(prisma)
 */
export function addSoftDeleteMiddleware(prismaClient: typeof prisma) {
  prismaClient.$use(async (params, next) => {
    // Models that support soft delete
    const softDeleteModels = ['project', 'investor', 'document', 'dealRoom', 'milestone']

    if (softDeleteModels.includes(params.model?.toLowerCase() ?? '')) {
      // Exclude archived records from queries unless explicitly requested
      if (params.action === 'findUnique' || params.action === 'findFirst') {
        params.action = 'findFirst'
        params.args.where = {
          ...params.args.where,
          archived: false,
        }
      }

      if (params.action === 'findMany') {
        if (params.args.where) {
          if (params.args.where.archived === undefined) {
            params.args.where = {
              ...params.args.where,
              archived: false,
            }
          }
        } else {
          params.args.where = { archived: false }
        }
      }
    }

    return next(params)
  })
}

/**
 * Query helper to explicitly include archived records
 * Use this when you want to query archived items
 *
 * @example
 * const allProjects = await prisma.project.findMany(includeArchived())
 * const specificArchived = await prisma.project.findMany(includeArchived({ status: 'CLOSED' }))
 */
export function includeArchived(where?: Record<string, unknown>) {
  return {
    where: {
      ...where,
      // Don't filter by archived field (show both archived and non-archived)
    },
  }
}

/**
 * Query helper to explicitly show only archived records
 *
 * @example
 * const archivedProjects = await prisma.project.findMany(onlyArchived())
 */
export function onlyArchived(where?: Record<string, unknown>) {
  return {
    where: {
      ...where,
      archived: true,
    },
  }
}
