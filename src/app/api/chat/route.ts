import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

const ChatSchema = z.object({
  message: z.string().min(1).max(2000),
  conversationId: z.string().optional(),
})

export const maxDuration = 60

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

  const parsed = ChatSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const { message } = parsed.data

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 503 }
      )
    }

    // Fetch relevant context from database
    const projects = await prisma.project.findMany({
      where: { archived: false },
      select: {
        id: true,
        title: true,
        code: true,
        description: true,
        country: true,
        sector: true,
        status: true,
        dealStage: true,
        totalCost: true,
      },
      take: 50,
      orderBy: { updatedAt: 'desc' },
    })

    // Build context for RAG
    const projectContext = projects.map(p =>
      `Project: ${p.title || p.code}\n` +
      `Code: ${p.code}\n` +
      `Country: ${p.country || 'N/A'}\n` +
      `Sector: ${p.sector || 'N/A'}\n` +
      `Status: ${p.status}\n` +
      `Stage: ${p.dealStage || 'N/A'}\n` +
      `Cost: ${p.totalCost ? `$${p.totalCost.toLocaleString()}` : 'N/A'}\n` +
      `Description: ${p.description || 'N/A'}\n`
    ).join('\n---\n')

    // Get recent PIS reports for additional context
    const pisReports = await prisma.pISReport.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        projectId: true,
        status: true,
        projectBackground: true,
        riskFactors: true,
      },
    })

    const pisContext = pisReports.map(r =>
      `PIS Report (Project ID: ${r.projectId})\n` +
      `Status: ${r.status}\n` +
      `Background: ${r.projectBackground?.substring(0, 200) || 'N/A'}...\n` +
      `Risk Factors: ${r.riskFactors?.substring(0, 200) || 'N/A'}...`
    ).join('\n---\n')

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const systemPrompt = `You are an AI assistant for Africa Infrastructure Partners (AIP), helping investment professionals analyze and manage infrastructure projects.

You have access to the following data:

PROJECTS:
${projectContext}

RECENT PIS REPORTS:
${pisContext}

Your role:
- Answer questions about projects, sectors, countries, and investment opportunities
- Provide insights based on the data you have
- Be concise and professional
- If you don't have specific information, say so
- Reference specific projects by their code or title when relevant
- Help with analysis, comparisons, and recommendations

User question: ${message}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: systemPrompt,
        },
      ],
    })

    const assistantMessage = response.content[0].type === 'text'
      ? response.content[0].text
      : 'I apologize, but I could not generate a response.'

    const tokensUsed = response.usage
      ? (response.usage.input_tokens || 0) + (response.usage.output_tokens || 0)
      : 0

    return NextResponse.json({
      message: assistantMessage,
      tokensUsed,
    })
  } catch (error) {
    console.error('[POST /api/chat] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    )
  }
}
