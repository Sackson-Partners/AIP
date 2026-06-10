import { inngest } from '../client'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit-log'
import Anthropic from '@anthropic-ai/sdk'

export const augmentPETFEL = inngest.createFunction(
  {
    id: 'augment-pestel',
    name: 'Augment PETFEL with AI',
    retries: 2,
    triggers: [{ event: 'pestel/augment' }],
  },
  async ({ event, step }) => {
    const { assessmentId, projectId, userId } = event.data

    // Step 1: Load assessment and project data
    const { assessment, project } = await step.run('load-data', async () => {
      const assessment = await prisma.pETFELAnalysis.findUnique({
        where: { id: assessmentId },
      })

      if (!assessment) {
        throw new Error(`PETFEL assessment ${assessmentId} not found`)
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
      })

      if (!project) {
        throw new Error(`Project ${projectId} not found`)
      }

      return { assessment, project }
    })

    // Step 2: Generate AI augmentation
    const augmented = await step.run('generate-ai-augmentation', async () => {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY not configured')
      }

      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

      const prompt = `You are an infrastructure due diligence expert. Analyze this project and provide PETFEL assessment insights.

PROJECT:
- Name: ${project.title}
- Country: ${project.country}
- Sector: ${project.sector}
- Description: ${project.description || 'N/A'}

CURRENT SCORES:
- Political: ${assessment.politicalScore ?? 'N/A'}
- Economic: ${assessment.economicScore ?? 'N/A'}
- Technical: ${assessment.technicalScore ?? 'N/A'}
- Financial: ${assessment.financialScore ?? 'N/A'}
- Environmental: ${assessment.environmentalScore ?? 'N/A'}
- Legal: ${assessment.legalScore ?? 'N/A'}

Provide:
1. Key risk factors (3-5 bullet points)
2. Recommended mitigations (3-5 bullet points)
3. Strategic recommendations (2-3 paragraphs)

Return ONLY valid JSON:
{
  "riskFactors": "markdown formatted list",
  "mitigants": "markdown formatted list",
  "recommendations": "markdown formatted paragraphs"
}`

      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      let jsonText = text.trim()
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '')
      }

      return JSON.parse(jsonText) as {
        riskFactors?: string
        mitigants?: string
        recommendations?: string
      }
    })

    // Step 3: Save augmentation results
    const updated = await step.run('save-results', async () => {
      return await prisma.pETFELAnalysis.update({
        where: { id: assessmentId },
        data: {
          riskFactors: augmented.riskFactors || assessment.riskFactors,
          mitigants: augmented.mitigants || assessment.mitigants,
          recommendations: augmented.recommendations || assessment.recommendations,
          aiMemo: 'AI augmentation completed',
        },
      })
    })

    // Step 4: Log audit event
    await step.run('log-audit', async () => {
      await logAudit({
        userId,
        action: 'petfel.ai_augment',
        tableName: 'PETFELAnalysis',
        recordId: assessmentId,
        metadata: {
          projectId,
          augmentedAt: new Date(),
        },
      })
    })

    // Step 5: Send notification
    await step.run('send-notification', async () => {
      await inngest.send({
        name: 'notification/send',
        data: {
          userId,
          type: 'pestel_augmented',
          title: 'PETFEL Augmented',
          message: `AI analysis complete for ${project.title}`,
          link: `/dashboard/pestel?project=${projectId}`,
        },
      })
    })

    return {
      success: true,
      assessmentId,
      projectId,
    }
  }
)
