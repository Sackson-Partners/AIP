import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'
import { generateReportPDF } from '@/lib/pdf-generator'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const report = await prisma.eINReport.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            title: true,
            country: true,
            sector: true,
          },
        },
      },
    })

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // Build PDF sections
    const sections = []

    if (report.projectSummary) {
      sections.push({
        title: 'Project Summary',
        content: report.projectSummary,
        level: 2,
      })
    }

    if (report.strategicObjectives) {
      sections.push({
        title: 'Strategic Objectives',
        content: report.strategicObjectives,
        level: 2,
      })
    }

    if (report.sectorContext) {
      sections.push({
        title: 'Sector Context',
        content: report.sectorContext,
        level: 2,
      })
    }

    if (report.financialStructure) {
      sections.push({
        title: 'Financial Structure',
        content: report.financialStructure,
        level: 2,
      })
    }

    if (report.riskProfile) {
      sections.push({
        title: 'Risk Profile',
        content: report.riskProfile,
        level: 2,
      })
    }

    if (report.investmentRationale) {
      sections.push({
        title: 'Investment Rationale',
        content: report.investmentRationale,
        level: 2,
      })
    }

    // Generate PDF
    const pdfBytes = await generateReportPDF(
      {
        title: 'Executive Investment Note',
        subtitle: report.project?.title || 'Untitled Project',
        tags: [
          `EIN-${report.einNumber}`,
          report.project?.country,
          report.project?.sector,
          report.status,
        ].filter(Boolean) as string[],
        date: new Date().toLocaleDateString(),
      },
      sections
    )

    // Return PDF
    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="EIN-${report.einNumber}.pdf"`,
      },
    })
  } catch (error) {
    console.error('[GET /api/ein/[id]/export] Error:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
