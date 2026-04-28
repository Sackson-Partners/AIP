import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { type, context, prompt: userPrompt } = body as {
    type?: string
    context?: string
    prompt?: string
  }

  const prompt = userPrompt ?? (context
    ? `Generate a concise ${type ?? 'summary'} for: ${context}`
    : null)

  if (!prompt) return NextResponse.json({ error: 'prompt or context required' }, { status: 400 })

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  let message
  try {
    message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages:   [{ role: 'user', content: prompt }],
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'AI service error', detail: msg }, { status: 502 })
  }

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  return NextResponse.json({ data: { content: text, type: type ?? 'text' } })
}
