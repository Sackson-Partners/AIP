import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const projectId = body.project_id as string | undefined

  // If a project_id is provided, enrich with DB data
  let context = body.context as string | undefined
  if (projectId) {
    const project = await prisma.project.findUnique({
      where:   { id: projectId },
      include: { petfelAnalysis: true },
    })
    if (project) {
      context = `Project: ${project.title}, ${project.country ?? 'Africa'}, ${project.sector ?? 'Infrastructure'}, ${project.dealStage}. ${project.description ?? ''}`
      if (project.petfelAnalysis) {
        context += ` PETFEL Score: ${project.petfelAnalysis.overallScore?.toFixed(1)}/5.`
      }
    }
  }

  if (!context) return NextResponse.json({ error: 'project_id or context required' }, { status: 400 })

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let message
  try {
    message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages:   [{
        role:    'user',
        content: `Analyze this infrastructure project for an African infrastructure fund. Be concise (3-4 sentences total). Context: ${context}\n\nRespond ONLY with valid JSON (no markdown): {"summary":"<analysis>","risks":"<top 2 risks>","opportunities":"<top 2 opportunities>","recommendation":"go|hold|no_go"}`,
      }],
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'AI service error', detail: msg }, { status: 502 })
  }

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  try {
    const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
    return NextResponse.json({ data: JSON.parse(cleaned) })
  } catch {
    return NextResponse.json({ error: 'AI response was not valid JSON', raw: text.slice(0, 300) }, { status: 502 })
  }
}
