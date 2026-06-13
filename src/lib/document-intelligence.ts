import Anthropic from '@anthropic-ai/sdk'
import { prisma } from './prisma'

export interface DocumentSummary {
  summary: string
  keyInsights: {
    mainTopics: string[]
    criticalFindings: string[]
    recommendations: string[]
    risks: string[]
  }
}

/**
 * Generate AI summary for a document
 * @param documentId Document ID
 * @param content Document text content (extracted from PDF/DOCX)
 * @returns Summary and key insights
 */
export async function summarizeDocument(
  documentId: string,
  content: string
): Promise<DocumentSummary> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  // Update status to PROCESSING
  await prisma.document.update({
    where: { id: documentId },
    data: { summarizationStatus: 'PROCESSING' },
  })

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // Truncate content if too long (Claude has 200k context but we want to be conservative)
    const maxChars = 100000
    const truncated = content.length > maxChars ? content.substring(0, maxChars) + '...' : content

    const prompt = `You are analyzing an infrastructure project document for Africa Infrastructure Partners (AIP).

Document content:
${truncated}

Please provide:
1. A concise executive summary (2-3 paragraphs, max 300 words)
2. Main topics covered in the document
3. Critical findings or key data points
4. Recommendations or action items (if any)
5. Risks or concerns identified (if any)

Format your response as JSON with this structure:
{
  "summary": "Executive summary text here",
  "mainTopics": ["topic1", "topic2", ...],
  "criticalFindings": ["finding1", "finding2", ...],
  "recommendations": ["rec1", "rec2", ...],
  "risks": ["risk1", "risk2", ...]
}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: prompt,
      }],
    })

    const text = response.content[0].type === 'text'
      ? response.content[0].text
      : '{}'

    // Parse JSON response
    const parsed = JSON.parse(text) as {
      summary: string
      mainTopics: string[]
      criticalFindings: string[]
      recommendations: string[]
      risks: string[]
    }

    const result: DocumentSummary = {
      summary: parsed.summary,
      keyInsights: {
        mainTopics: parsed.mainTopics || [],
        criticalFindings: parsed.criticalFindings || [],
        recommendations: parsed.recommendations || [],
        risks: parsed.risks || [],
      },
    }

    // Update document with summary
    await prisma.document.update({
      where: { id: documentId },
      data: {
        summary: result.summary,
        keyInsights: result.keyInsights as never,
        summarizedAt: new Date(),
        summarizationStatus: 'COMPLETED',
      },
    })

    return result
  } catch (error) {
    console.error('[summarizeDocument] Error:', error)

    // Update status to FAILED
    await prisma.document.update({
      where: { id: documentId },
      data: { summarizationStatus: 'FAILED' },
    })

    throw error
  }
}

/**
 * Track document event (view, download, etc.)
 */
export async function trackDocumentEvent(params: {
  documentId: string
  userId?: string
  userEmail?: string
  eventType: 'VIEW' | 'DOWNLOAD' | 'SHARE' | 'UPDATE' | 'DELETE'
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}): Promise<void> {
  await prisma.documentEvent.create({
    data: {
      documentId: params.documentId,
      userId: params.userId || undefined,
      userEmail: params.userEmail || undefined,
      eventType: params.eventType,
      metadata: params.metadata ? (params.metadata as never) : undefined,
      ipAddress: params.ipAddress || undefined,
      userAgent: params.userAgent || undefined,
    },
  })
}

/**
 * Get document analytics
 */
export async function getDocumentAnalytics(documentId: string) {
  const [totalViews, totalDownloads, uniqueUsers, recentEvents] = await Promise.all([
    prisma.documentEvent.count({
      where: { documentId, eventType: 'VIEW' },
    }),
    prisma.documentEvent.count({
      where: { documentId, eventType: 'DOWNLOAD' },
    }),
    prisma.documentEvent.findMany({
      where: { documentId },
      distinct: ['userId'],
      select: { userId: true },
    }),
    prisma.documentEvent.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        eventType: true,
        userEmail: true,
        createdAt: true,
      },
    }),
  ])

  return {
    totalViews,
    totalDownloads,
    uniqueUsersCount: uniqueUsers.filter(u => u.userId).length,
    recentEvents,
  }
}
