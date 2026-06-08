import { inngest } from '../client'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit-log'
import Anthropic from '@anthropic-ai/sdk'

export const generatePIS = inngest.createFunction(
  {
    id: 'generate-pis',
    name: 'Generate PIS with AI',
    retries: 2, // Retry twice on failure
    triggers: [{ event: 'pis/generate' }],
  },
  async ({ event, step }) => {
    const { pisId, projectId, userId } = event.data

    // Step 1: Load PIS report and project data
    const { pisReport, project, petfel, ein } = await step.run('load-data', async () => {
      const pisReport = await prisma.pISReport.findUnique({
        where: { id: pisId },
        include: { project: true },
      })

      if (!pisReport) {
        throw new Error(`PIS report ${pisId} not found`)
      }

      const [petfelResult, einResult] = await Promise.allSettled([
        prisma.pETFELAnalysis.findUnique({ where: { projectId } }),
        prisma.eINReport.findUnique({ where: { projectId } }),
      ])

      return {
        pisReport,
        project: pisReport.project,
        petfel: petfelResult.status === 'fulfilled' ? petfelResult.value : null,
        ein: einResult.status === 'fulfilled' ? einResult.value : null,
      }
    })

    // Step 2: Generate content with AI
    const generated = await step.run('generate-ai-content', async () => {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY not configured')
      }

      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

      const prompt = `You are an expert infrastructure investment analyst. Generate a professional Project Information Sheet (PIS) for the following project. Return ONLY valid JSON with no markdown, no code blocks, no additional text.

PROJECT DATA:
- Name: ${project.title ?? 'N/A'}
- Country: ${project.country ?? 'N/A'}
- Region: ${project.region ?? 'N/A'}
- Sector: ${project.sector ?? 'N/A'}
- Project Type: ${project.projectType ?? 'N/A'}
- Deal Stage: ${project.dealStage ?? 'N/A'}
- Total Cost: ${project.totalCost ? `USD ${project.totalCost.toLocaleString()}` : 'N/A'}
- Risk Rating: ${project.riskRating ?? 'N/A'}
- Description: ${project.description ?? 'N/A'}
${petfel ? `- PESTEL Score: ${petfel.overallScore ?? 'N/A'}` : ''}
${ein ? `- EIN Summary: ${ein.projectSummary ?? 'N/A'}` : ''}

Generate detailed, professional content for each section. Each section should be 2-4 paragraphs of substantive analysis appropriate for institutional investors.

Return JSON with exactly these keys:
{
  "executiveSummary": "...",
  "projectBackground": "...",
  "financialStructure": "...",
  "marketAnalysis": "...",
  "riskFactors": "...",
  "investmentHighlights": "..."
}`

      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''

      // Handle potential markdown code blocks
      let jsonText = text.trim()
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '')
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '')
      }

      return JSON.parse(jsonText) as {
        executiveSummary?: string
        projectBackground?: string
        financialStructure?: string
        marketAnalysis?: string
        riskFactors?: string
        investmentHighlights?: string
      }
    })

    // Step 3: Save results to database
    const updated = await step.run('save-results', async () => {
      return await prisma.pISReport.update({
        where: { id: pisId },
        data: {
          executiveSummary: generated.executiveSummary ?? pisReport.executiveSummary,
          projectBackground: generated.projectBackground ?? pisReport.projectBackground,
          financialStructure: generated.financialStructure ?? pisReport.financialStructure,
          marketAnalysis: generated.marketAnalysis ?? pisReport.marketAnalysis,
          riskFactors: generated.riskFactors ?? pisReport.riskFactors,
          investmentHighlights: generated.investmentHighlights ?? pisReport.investmentHighlights,
          aiGenerated: true,
          generatedAt: new Date(),
        },
      })
    })

    // Step 4: Log audit event
    await step.run('log-audit', async () => {
      await logAudit({
        userId,
        action: 'pis.ai_generate',
        tableName: 'PISReport',
        recordId: pisId,
        metadata: {
          projectId,
          fieldsGenerated: Object.keys(generated).length,
          generatedAt: updated.generatedAt,
        },
      })
    })

    // Step 5: Send notification (optional)
    await step.run('send-notification', async () => {
      await inngest.send({
        name: 'notification/send',
        data: {
          userId,
          type: 'pis_generated',
          title: 'PIS Generated',
          message: `AI has completed generating the PIS for ${project.title}`,
          link: `/dashboard/pis/${pisId}`,
        },
      })
    })

    return {
      success: true,
      pisId,
      projectId,
      generatedFields: Object.keys(generated).length,
    }
  }
)
