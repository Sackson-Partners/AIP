import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { detectDuplicates, formatDuplicateMatches, isLikelyDuplicate } from '@/lib/duplicate-detection'
import { ProjectSector } from '@prisma/client'
import { z } from 'zod'
import { logger } from '@/lib/logger'

/**
 * POST /api/projects/check-duplicates
 *
 * Check for potential duplicate projects before creating/updating
 * Allows frontend to warn users proactively
 */

const CheckDuplicatesSchema = z.object({
  title: z.string().min(1),
  country: z.string().optional(),
  sector: z.nativeEnum(ProjectSector).optional(),
  totalCost: z.number().positive().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  excludeProjectId: z.string().optional(), // For updates
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CheckDuplicatesSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const data = parsed.data

  try {
    // Detect duplicates
    const matches = await detectDuplicates({
      title: data.title,
      country: data.country,
      sector: data.sector,
      totalCost: data.totalCost,
      latitude: data.latitude,
      longitude: data.longitude,
      excludeProjectId: data.excludeProjectId,
    })

    // Check if likely duplicate (high confidence)
    const isLikely = await isLikelyDuplicate({
      title: data.title,
      country: data.country,
      sector: data.sector,
      totalCost: data.totalCost,
      latitude: data.latitude,
      longitude: data.longitude,
      excludeProjectId: data.excludeProjectId,
    })

    // Log duplicate check
    logger.info('Duplicate check performed', {
      userId: session.user.id,
      title: data.title,
      matchCount: matches.length,
      isLikely,
    })

    return NextResponse.json({
      hasDuplicates: matches.length > 0,
      isLikelyDuplicate: isLikely,
      matchCount: matches.length,
      matches: formatDuplicateMatches(matches.slice(0, 10)), // Top 10 matches
    })
  } catch (error) {
    logger.error('Duplicate check failed', error, {
      userId: session.user.id,
      title: data.title,
    })
    return NextResponse.json(
      { error: 'Failed to check for duplicates' },
      { status: 500 }
    )
  }
}
