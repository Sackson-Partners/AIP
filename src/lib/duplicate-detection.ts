/**
 * Duplicate Detection for Projects
 *
 * Uses fuzzy matching to identify potential duplicate projects based on:
 * - Title similarity (Levenshtein distance)
 * - Location proximity (geographic coordinates)
 * - Project characteristics (sector, country, cost range)
 */

import { prisma } from '@/lib/prisma'
import { ProjectSector } from '@prisma/client'

/**
 * Calculate Levenshtein distance (edit distance) between two strings
 * Measures how many single-character edits are needed to transform one string into another
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length
  const len2 = str2.length
  const matrix: number[][] = []

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      )
    }
  }

  return matrix[len1][len2]
}

/**
 * Calculate similarity score between two strings (0-1, where 1 is identical)
 */
function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()

  if (s1 === s2) return 1.0

  const distance = levenshteinDistance(s1, s2)
  const maxLength = Math.max(s1.length, s2.length)

  if (maxLength === 0) return 1.0

  return 1 - distance / maxLength
}

/**
 * Calculate geographic distance between two coordinates (in kilometers)
 * Uses Haversine formula
 */
function geographicDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Potential duplicate match
 */
export interface DuplicateMatch {
  projectId: string
  projectCode: string
  projectTitle: string
  projectCountry?: string
  projectSector?: string
  projectStatus: string
  createdAt: Date
  similarity: number
  reasons: string[]
}

/**
 * Options for duplicate detection
 */
export interface DuplicateDetectionOptions {
  title: string
  country?: string
  sector?: ProjectSector
  totalCost?: number
  latitude?: number
  longitude?: number
  excludeProjectId?: string // Exclude this project ID from results (for updates)
}

/**
 * Thresholds for duplicate detection
 */
const THRESHOLDS = {
  // Title similarity threshold (0-1)
  titleSimilarity: 0.75, // 75% similar titles trigger warning
  // Geographic distance threshold (kilometers)
  locationProximity: 10, // 10km proximity triggers warning
  // Cost similarity threshold (ratio)
  costSimilarity: 0.2, // Within 20% of cost triggers warning
}

/**
 * Detect potential duplicate projects
 *
 * @param options Project details to check for duplicates
 * @returns Array of potential duplicate matches, sorted by similarity score
 */
export async function detectDuplicates(
  options: DuplicateDetectionOptions
): Promise<DuplicateMatch[]> {
  const { title, country, sector, totalCost, latitude, longitude, excludeProjectId } = options

  // Build query to find candidate projects
  const whereClause: any = {
    // Exclude archived projects
    archived: false,
    // Exclude the project being updated
    ...(excludeProjectId ? { id: { not: excludeProjectId } } : {}),
  }

  // Narrow down candidates by country and sector if provided
  if (country) {
    whereClause.country = country
  }
  if (sector) {
    whereClause.sector = sector
  }

  // Query potential duplicates
  const candidates = await prisma.project.findMany({
    where: whereClause,
    select: {
      id: true,
      code: true,
      title: true,
      country: true,
      sector: true,
      status: true,
      totalCost: true,
      latitude: true,
      longitude: true,
      createdAt: true,
    },
    take: 100, // Limit to 100 candidates for performance
  })

  // Calculate similarity scores
  const matches: DuplicateMatch[] = []

  for (const candidate of candidates) {
    const reasons: string[] = []
    let similarityScore = 0
    let matchFactors = 0

    // 1. Title similarity (most important factor)
    const titleScore = stringSimilarity(title, candidate.title)
    if (titleScore >= THRESHOLDS.titleSimilarity) {
      similarityScore += titleScore * 0.5 // Weight: 50%
      matchFactors++
      reasons.push(`Similar title (${Math.round(titleScore * 100)}% match)`)
    }

    // 2. Geographic proximity (if coordinates provided)
    if (latitude && longitude && candidate.latitude && candidate.longitude) {
      const distance = geographicDistance(
        latitude,
        longitude,
        candidate.latitude,
        candidate.longitude
      )
      if (distance <= THRESHOLDS.locationProximity) {
        const proximityScore = 1 - distance / THRESHOLDS.locationProximity
        similarityScore += proximityScore * 0.3 // Weight: 30%
        matchFactors++
        reasons.push(`Within ${Math.round(distance)}km`)
      }
    }

    // 3. Cost similarity (if cost provided)
    if (totalCost && candidate.totalCost) {
      const costRatio = Math.min(totalCost, candidate.totalCost) / Math.max(totalCost, candidate.totalCost)
      if (costRatio >= (1 - THRESHOLDS.costSimilarity)) {
        similarityScore += costRatio * 0.2 // Weight: 20%
        matchFactors++
        const diff = Math.abs(totalCost - candidate.totalCost)
        const avgCost = (totalCost + candidate.totalCost) / 2
        const percentDiff = (diff / avgCost) * 100
        reasons.push(`Similar cost (${Math.round(percentDiff)}% difference)`)
      }
    }

    // 4. Same country and sector
    if (country && country === candidate.country) {
      reasons.push(`Same country: ${country}`)
    }
    if (sector && sector === candidate.sector) {
      reasons.push(`Same sector: ${sector}`)
    }

    // Only include if at least one strong match factor
    if (matchFactors > 0 && reasons.length > 0) {
      matches.push({
        projectId: candidate.id,
        projectCode: candidate.code,
        projectTitle: candidate.title,
        projectCountry: candidate.country ?? undefined,
        projectSector: candidate.sector ?? undefined,
        projectStatus: candidate.status,
        createdAt: candidate.createdAt,
        similarity: similarityScore,
        reasons,
      })
    }
  }

  // Sort by similarity score (highest first)
  matches.sort((a, b) => b.similarity - a.similarity)

  return matches
}

/**
 * Check if a project is a likely duplicate (high confidence)
 *
 * @param options Project details to check
 * @returns True if likely duplicate detected
 */
export async function isLikelyDuplicate(
  options: DuplicateDetectionOptions
): Promise<boolean> {
  const matches = await detectDuplicates(options)

  // High confidence duplicate if:
  // - Title similarity > 90% OR
  // - Multiple strong match factors (title + location + cost)
  for (const match of matches) {
    const titleScore = stringSimilarity(options.title, match.projectTitle)
    if (titleScore >= 0.9) return true

    // Multiple factors indicate likely duplicate
    if (match.reasons.length >= 3 && match.similarity >= 0.7) return true
  }

  return false
}

/**
 * Get duplicate warning message for API response
 *
 * @param matches Array of duplicate matches
 * @returns Warning message or null if no matches
 */
export function getDuplicateWarning(matches: DuplicateMatch[]): string | null {
  if (matches.length === 0) return null

  const topMatch = matches[0]

  if (matches.length === 1) {
    return `Potential duplicate detected: "${topMatch.projectTitle}" (${topMatch.projectCode}). Reasons: ${topMatch.reasons.join(', ')}.`
  }

  return `${matches.length} potential duplicates detected. Top match: "${topMatch.projectTitle}" (${topMatch.projectCode}). Reasons: ${topMatch.reasons.join(', ')}.`
}

/**
 * Format duplicate matches for user display
 */
export function formatDuplicateMatches(matches: DuplicateMatch[]): Array<{
  id: string
  code: string
  title: string
  country?: string
  sector?: string
  status: string
  similarity: number
  reasons: string[]
}> {
  return matches.map(match => ({
    id: match.projectId,
    code: match.projectCode,
    title: match.projectTitle,
    country: match.projectCountry,
    sector: match.projectSector,
    status: match.projectStatus,
    similarity: Math.round(match.similarity * 100) / 100, // Round to 2 decimals
    reasons: match.reasons,
  }))
}
