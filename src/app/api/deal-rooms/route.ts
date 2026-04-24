import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth/auth.config'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rooms = await prisma.dealRoom.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      projectId: true,
      name: true,
      description: true,
      isPublic: true,
      createdAt: true,
    },
  })

  return NextResponse.json(rooms)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { projectId, name, description, isPublic, password } = body

  if (!projectId || !name) {
    return NextResponse.json({ error: 'projectId and name are required' }, { status: 400 })
  }

  const hashedPassword = password ? await bcrypt.hash(password, 12) : null

  const room = await prisma.dealRoom.create({
    data: {
      projectId,
      name,
      description: description ?? null,
      isPublic: isPublic ?? false,
      password: hashedPassword,
    },
    select: {
      id: true,
      projectId: true,
      name: true,
      description: true,
      isPublic: true,
      createdAt: true,
    },
  })

  return NextResponse.json(room, { status: 201 })
}
