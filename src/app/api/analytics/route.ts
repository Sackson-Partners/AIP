import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { getProjectVisibilityFilter } from '@/lib/project-visibility'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userRole = session.user.role as string
  const projectFilter = getProjectVisibilityFilter(userRole)

  const [
    totalProjects,
    totalInvestors,
    totalUsers,
    projectsByStatus,
    projectsByStage,
    projectsBySector,
    recentProjects,
  ] = await Promise.all([
    prisma.project.count({ where: projectFilter }),
    prisma.investor.count(),
    prisma.user.count(),
    prisma.project.groupBy({ by: ['status'],   _count: true, where: projectFilter }),
    prisma.project.groupBy({ by: ['dealStage'], _count: true, where: projectFilter }),
    prisma.project.groupBy({ by: ['sector'],   _count: true, where: projectFilter }),
    prisma.project.findMany({
      where: projectFilter,
      orderBy: { createdAt: 'desc' },
      take:    5,
      select:  { id: true, title: true, status: true, dealStage: true, sector: true, country: true, createdAt: true },
    }),
  ])

  const totalValue = await prisma.project.aggregate({ _sum: { totalCost: true }, where: projectFilter })

  return NextResponse.json({
    data: {
      summary: {
        totalProjects,
        totalInvestors,
        totalUsers,
        totalValue: totalValue._sum.totalCost ?? 0,
      },
      projectsByStatus:  projectsByStatus.map(r  => ({ status:  r.status,   count: r._count })),
      projectsByStage:   projectsByStage.map(r   => ({ stage:   r.dealStage, count: r._count })),
      projectsBySector:  projectsBySector.map(r  => ({ sector:  r.sector,   count: r._count })),
      recentProjects,
    },
  })
}
