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
    const assessment = await prisma.pETFELAnalysis.findUnique({
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

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })
    }

    // Build PDF sections
    const sections = []

    // Overall Score
    sections.push({
      title: 'Overall Assessment',
      content: `Overall Score: ${assessment.overallScore?.toFixed(2) || 'N/A'}\nRating: ${assessment.rating || 'N/A'}`,
      level: 2,
    })

    // Pillar Scores
    const scores = [
      { name: 'Political', value: assessment.politicalScore },
      { name: 'Economic', value: assessment.economicScore },
      { name: 'Technical', value: assessment.technicalScore },
      { name: 'Financial', value: assessment.financialScore },
      { name: 'Environmental', value: assessment.environmentalScore },
      { name: 'Legal', value: assessment.legalScore },
    ]

    sections.push({
      title: 'Pillar Scores',
      content: scores
        .map((s) => `${s.name}: ${s.value?.toFixed(2) || 'N/A'}`)
        .join('\n'),
      level: 2,
    })

    if (assessment.riskFactors) {
      sections.push({
        title: 'Risk Factors',
        content: assessment.riskFactors,
        level: 2,
      })
    }

    if (assessment.mitigants) {
      sections.push({
        title: 'Mitigation Strategies',
        content: assessment.mitigants,
        level: 2,
      })
    }

    if (assessment.recommendations) {
      sections.push({
        title: 'Recommendations',
        content: assessment.recommendations,
        level: 2,
      })
    }

    // Generate PDF
    const pdfBytes = await generateReportPDF(
      {
        title: 'PETFEL Risk Assessment',
        subtitle: assessment.project?.title || 'Untitled Project',
        tags: [
          assessment.project?.country,
          assessment.project?.sector,
          assessment.rating,
        ].filter(Boolean) as string[],
        date: new Date().toLocaleDateString(),
      },
      sections
    )

    // Return PDF
    return new NextResponse(pdfBytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="PETFEL-${assessment.id}.pdf"`,
      },
    })
  } catch (error) {
    console.error('[GET /api/petfel/[id]/export] Error:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
