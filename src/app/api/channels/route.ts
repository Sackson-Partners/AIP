import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

// Roles allowed to message partners+internal
const PARTNER_INTERNAL_ROLES = new Set(['SUPER_ADMIN','ADMIN','ANALYST','SPONSOR_DEVELOPER','EPC_OPERATOR','INSTITUTIONAL_INVESTOR'])
// Roles allowed to message gov+internal
const GOV_INTERNAL_ROLES = new Set(['SUPER_ADMIN','ADMIN','ANALYST','GOVERNMENT'])

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = session.user.role as string

  // Get channels the user is a member of
  const memberships = await prisma.channelMember.findMany({
    where: { userId: session.user.id },
    include: {
      channel: {
        include: {
          members: { select: { userId: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { content: true, createdAt: true, senderId: true },
          },
        },
      },
    },
  })

  const data = memberships.map(m => ({
    id:           m.channel.id,
    type:         m.channel.type,
    name:         m.channel.name,
    description:  m.channel.description,
    projectId:    m.channel.projectId,
    memberCount:  m.channel.members.length,
    lastMessage:  m.channel.messages[0] ?? null,
    lastReadAt:   m.lastReadAt,
    role:         m.role,
  }))

  // Filter channels based on role messaging permissions
  const filtered = data.filter(c => {
    if (c.type === 'PROJECT' || c.type === 'GROUP' || c.type === 'DIRECT') return true
    if (c.type === 'PARTNER_INTERNAL') return PARTNER_INTERNAL_ROLES.has(role)
    if (c.type === 'GOV_INTERNAL') return GOV_INTERNAL_ROLES.has(role)
    return false
  })

  return NextResponse.json({ data: filtered })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { type, name, description, projectId, memberIds } = body

  if (!type) return NextResponse.json({ error: 'type required' }, { status: 400 })

  const channel = await prisma.channel.create({
    data: {
      type,
      name:        name        ?? null,
      description: description ?? null,
      projectId:   projectId   ?? null,
      createdBy:   session.user.id,
      members: {
        create: [
          { userId: session.user.id, role: 'ADMIN' },
          ...((memberIds as string[] | undefined) ?? [])
            .filter((id: string) => id !== session.user.id)
            .map((id: string) => ({ userId: id, role: 'MEMBER' })),
        ],
      },
    },
  })

  return NextResponse.json({ data: channel }, { status: 201 })
}
