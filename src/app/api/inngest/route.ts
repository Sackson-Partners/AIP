import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { generatePIS } from '@/lib/inngest/functions/generate-pis'
import { augmentPETFEL } from '@/lib/inngest/functions/augment-pestel'

// Create the Inngest serve handler with all functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    generatePIS,
    augmentPETFEL,
    // Add more functions here as you create them
  ],
  servePath: '/api/inngest',
})
