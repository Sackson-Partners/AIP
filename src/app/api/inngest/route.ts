import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { generatePIS } from '@/lib/inngest/functions/generate-pis'
import { augmentPETFEL } from '@/lib/inngest/functions/augment-pestel'
import { sendAccessCodeEmail } from '@/lib/inngest/functions/send-access-code-email'
import { sendNDAEmail } from '@/lib/inngest/functions/send-nda-email'

// Create the Inngest serve handler with all functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    generatePIS,
    augmentPETFEL,
    sendAccessCodeEmail,
    sendNDAEmail,
  ],
  servePath: '/api/inngest',
})
