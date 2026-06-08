import { inngest } from '../client'
import { prisma } from '@/lib/prisma'
import { NotificationType } from '@prisma/client'

export const sendNotification = inngest.createFunction(
  {
    id: 'send-notification',
    name: 'Send Notification',
    retries: 2,
    triggers: [{ event: 'notification/send' }],
  },
  async ({ event, step }) => {
    const { userId, type, title, message, link } = event.data

    // Step 1: Create notification in database
    const notification = await step.run('create-notification', async () => {
      // Map string type to NotificationType enum
      const notificationType = (() => {
        switch (type) {
          case 'pis_generated':
          case 'pestel_augmented':
          case 'project_updated':
            return NotificationType.PROJECT_UPDATE
          case 'investor_match':
            return NotificationType.INVESTOR_MATCH
          case 'document_uploaded':
          case 'document_request':
            return NotificationType.DOCUMENT_REQUEST
          case 'access_granted':
          case 'access_request_submitted':
          case 'nda_signed':
            return NotificationType.COMPLIANCE_REMINDER
          case 'deal_alert':
            return NotificationType.DEAL_ALERT
          default:
            return NotificationType.SYSTEM_ALERT
        }
      })()

      return await prisma.notification.create({
        data: {
          userId,
          type: notificationType,
          title,
          message,
          link,
          read: false,
        },
      })
    })

    console.log(`[Notification] Created notification ${notification.id} for user ${userId}`)

    // Step 2: Future - Send push notification / email / SMS
    await step.run('send-push-notification', async () => {
      // TODO: Integrate with push notification service (Firebase, OneSignal, etc.)
      // For now, just log
      console.log(`[Notification] Would send push to user ${userId}: ${title}`)
    })

    return {
      success: true,
      notificationId: notification.id,
      userId,
    }
  }
)
