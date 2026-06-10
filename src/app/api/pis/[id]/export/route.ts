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
    const report = await prisma.pISReport.findUnique({
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

    // Build PDF sections from actual PISReport schema fields
    const sections = []

    if (report.executiveSummary) {
      sections.push({
        title: 'Executive Summary',
        content: report.executiveSummary,
        level: 2,
      })
    }

    if (report.projectBackground) {
      sections.push({
        title: 'Project Background',
        content: report.projectBackground,
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

    if (report.marketAnalysis) {
      sections.push({
        title: 'Market Analysis',
        content: report.marketAnalysis,
        level: 2,
      })
    }

    if (report.riskFactors) {
      sections.push({
        title: 'Risk Factors',
        content: report.riskFactors,
        level: 2,
      })
    }

    if (report.investmentHighlights) {
      sections.push({
        title: 'Investment Highlights',
        content: report.investmentHighlights,
        level: 2,
      })
    }

    if (report.useOfProceeds) {
      sections.push({
        title: 'Use of Proceeds',
        content: report.useOfProceeds,
        level: 2,
      })
    }

    if (report.exitStrategy) {
      sections.push({
        title: 'Exit Strategy',
        content: report.exitStrategy,
        level: 2,
      })
    }

    if (report.teamBackground) {
      sections.push({
        title: 'Team Background',
        content: report.teamBackground,
        level: 2,
      })
    }

    if (report.legalStructure) {
      sections.push({
        title: 'Legal Structure',
        content: report.legalStructure,
        level: 2,
      })
    }

    // Generate PDF
    const pdfBytes = await generateReportPDF(
      {
        title: 'Project Information Sheet',
        subtitle: report.project?.title || 'Untitled Project',
        tags: [
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
        'Content-Disposition': `attachment; filename="PIS-${report.id}.pdf"`,
      },
    })
  } catch (error) {
    console.error('[GET /api/pis/[id]/export] Error:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
