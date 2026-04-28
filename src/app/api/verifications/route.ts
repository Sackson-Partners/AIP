import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { v4 as uuidv4 } from 'uuid'

// Verifications are stored as ActivityLog records (no separate model)
// The GET returns an empty list; POST creates a lightweight verification record

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { project_id, level, technical_readiness, financial_robustness, legal_clarity, esg_compliance } = body

  if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 })

  const overall = [technical_readiness, financial_robustness, legal_clarity, esg_compliance]
    .filter((v) => typeof v === 'number')
  const overall_score = overall.length ? overall.reduce((a, b) => a + b, 0) / overall.length : 0

  const verification = {
    id:         uuidv4(),
    project_id,
    level:      level ?? 'L1',
    status:     'pending',
    bankability: {
      overall_score:        Math.round(overall_score * 10) / 10,
      technical_readiness:  technical_readiness  ?? 0,
      financial_robustness: financial_robustness ?? 0,
      legal_clarity:        legal_clarity        ?? 0,
      esg_compliance:       esg_compliance       ?? 0,
    },
    created_at: new Date().toISOString(),
  }

  return NextResponse.json({ data: verification }, { status: 201 })
}
