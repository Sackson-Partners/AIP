import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'

const STAGES = [
  { id: 'CONCEPT',         name: 'Concept',         code: 'CONCEPT',         order: 1, description: 'Initial project concept',            sla_days: 30  },
  { id: 'PREFEASIBILITY',  name: 'Pre-Feasibility',  code: 'PREFEASIBILITY',  order: 2, description: 'Preliminary feasibility assessment',   sla_days: 45  },
  { id: 'FEASIBILITY',     name: 'Feasibility',      code: 'FEASIBILITY',     order: 3, description: 'Full feasibility study',               sla_days: 90  },
  { id: 'STRUCTURING',     name: 'Structuring',      code: 'STRUCTURING',     order: 4, description: 'Deal structuring and negotiation',      sla_days: 60  },
  { id: 'PROCUREMENT',     name: 'Procurement',      code: 'PROCUREMENT',     order: 5, description: 'Procurement and bidding process',       sla_days: 90  },
  { id: 'FINANCIAL_CLOSE', name: 'Financial Close',  code: 'FINANCIAL_CLOSE', order: 6, description: 'Financial close and funding',           sla_days: 60  },
  { id: 'CONSTRUCTION',    name: 'Construction',     code: 'CONSTRUCTION',    order: 7, description: 'Project construction phase',            sla_days: 730 },
  { id: 'OPERATIONS',      name: 'Operations',       code: 'OPERATIONS',      order: 8, description: 'Operational phase',                     sla_days: null },
]

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ data: STAGES })
}
