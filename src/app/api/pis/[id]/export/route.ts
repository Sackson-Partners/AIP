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

    // Build PDF sections
    const sections = []

    if (report.projectDescription) {
      sections.push({
        title: 'Project Description',
        content: report.projectDescription,
        level: 2,
      })
    }

    if (report.technicalDetails) {
      sections.push({
        title: 'Technical Details',
        content: report.technicalDetails,
        level: 2,
      })
    }

    if (report.financialModel) {
      sections.push({
        title: 'Financial Model',
        content: report.financialModel,
        level: 2,
      })
    }

    if (report.riskAssessment) {
      sections.push({
        title: 'Risk Assessment',
        content: report.riskAssessment,
        level: 2,
      })
    }

    if (report.recommendations) {
      sections.push({
        title: 'Recommendations',
        content: report.recommendations,
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
