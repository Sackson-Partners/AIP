import { Resend } from 'resend'
import { render } from '@react-email/render'
import { ICVoteRequestEmail } from '@/emails/ICVoteRequestEmail'
import { ContactRequestEmail } from '@/emails/ContactRequestEmail'
import { ContactApprovedEmail } from '@/emails/ContactApprovedEmail'
import { ProjectPublishedEmail } from '@/emails/ProjectPublishedEmail'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'AIP Platform <noreply@africa-infra.com>'

export interface EmailOptions {
  to: string | string[]
  subject: string
  react: React.ReactElement
}

/**
 * Send email via Resend
 */
export async function sendEmail(options: EmailOptions) {
  if (!resend) {
    console.warn('[sendEmail] Resend not configured, skipping email send')
    return { success: false, error: 'Email service not configured' }
  }

  try {
    const html = await render(options.react)
    const text = await render(options.react, { plainText: true })

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html,
      text,
    })

    console.log('[sendEmail] Email sent successfully:', result)
    return { success: true, data: result }
  } catch (error) {
    console.error('[sendEmail] Error sending email:', error)
    return { success: false, error }
  }
}

/**
 * Send IC vote request email
 */
export async function sendICVoteRequest(params: {
  to: string
  committeeUserName: string
  projectName: string
  projectCode: string
  voteUrl: string
  dueDate: string
}) {
  return sendEmail({
    to: params.to,
    subject: `IC Vote Requested: ${params.projectName}`,
    react: ICVoteRequestEmail({
      committeeUserName: params.committeeUserName,
      projectName: params.projectName,
      projectCode: params.projectCode,
      voteUrl: params.voteUrl,
      dueDate: params.dueDate,
    }),
  })
}

/**
 * Send contact request notification email
 */
export async function sendContactRequestNotification(params: {
  to: string | string[]
  requesterName: string
  targetType: 'PROJECT' | 'INVESTOR' | 'PARTNER'
  targetName: string
  message?: string
  reviewUrl: string
}) {
  return sendEmail({
    to: params.to,
    subject: `Contact Request: ${params.targetName}`,
    react: ContactRequestEmail({
      requesterName: params.requesterName,
      targetType: params.targetType,
      targetName: params.targetName,
      message: params.message,
      reviewUrl: params.reviewUrl,
    }),
  })
}

/**
 * Send contact request approved email
 */
export async function sendContactApproved(params: {
  to: string
  requesterName: string
  targetType: 'PROJECT' | 'INVESTOR' | 'PARTNER'
  targetName: string
  contactInfo: {
    name?: string
    email?: string
    phone?: string
    organization?: string
  }
}) {
  return sendEmail({
    to: params.to,
    subject: 'Contact Request Approved',
    react: ContactApprovedEmail({
      requesterName: params.requesterName,
      targetType: params.targetType,
      targetName: params.targetName,
      contactInfo: params.contactInfo,
    }),
  })
}

/**
 * Send project published notification to matching investors
 */
export async function sendProjectPublished(params: {
  to: string
  investorName: string
  projectName: string
  projectCode: string
  projectSector: string
  projectCountry: string
  projectUrl: string
}) {
  return sendEmail({
    to: params.to,
    subject: `New Project: ${params.projectName}`,
    react: ProjectPublishedEmail({
      investorName: params.investorName,
      projectName: params.projectName,
      projectCode: params.projectCode,
      projectSector: params.projectSector,
      projectCountry: params.projectCountry,
      projectUrl: params.projectUrl,
    }),
  })
}

/**
 * Send welcome email (placeholder for existing code compatibility)
 */
export async function sendWelcomeEmail(params: {
  email: string
  name: string
  role?: string
  temporaryPassword?: string
  employeeId?: string
  loginUrl?: string
}) {
  console.log('[sendWelcomeEmail] Placeholder - not yet implemented')
  return { success: true }
}

/**
 * Send password reset email (placeholder for existing code compatibility)
 */
export async function sendPasswordResetEmail(params: {
  email: string
  name?: string
  temporaryPassword?: string
  resetUrl?: string
}) {
  console.log('[sendPasswordResetEmail] Placeholder - not yet implemented')
  return { success: true }
}

/**
 * Send suspension email (placeholder for existing code compatibility)
 */
export async function sendSuspensionEmail(params: {
  email: string
  name: string
  reason?: string
}) {
  console.log('[sendSuspensionEmail] Placeholder - not yet implemented')
  return { success: true }
}

/**
 * Send access approved email (placeholder for existing code compatibility)
 */
export async function sendAccessApprovedEmail(params: {
  to: string
  name: string
  loginUrl: string
}) {
  console.log('[sendAccessApprovedEmail] Placeholder - not yet implemented')
  return { success: true }
}

/**
 * Send access rejected email (placeholder for existing code compatibility)
 */
export async function sendAccessRejectedEmail(params: {
  to: string
  name: string
  reason?: string
}) {
  console.log('[sendAccessRejectedEmail] Placeholder - not yet implemented')
  return { success: true }
}

/**
 * Send activation email (placeholder for existing code compatibility)
 */
export async function sendActivationEmail(params: {
  email: string
  name: string
}) {
  console.log('[sendActivationEmail] Placeholder - not yet implemented')
  return { success: true }
}

/**
 * Send access request approval email (placeholder for existing code compatibility)
 */
export async function sendAccessRequestApproval(params: {
  email: string
  name: string
  role?: string
  temporaryPassword?: string
  loginUrl?: string
}) {
  console.log('[sendAccessRequestApproval] Placeholder - not yet implemented')
  return { success: true }
}

/**
 * Send admin notification email (placeholder for existing code compatibility)
 */
export async function sendAdminNotificationEmail(params: {
  to?: string | string[]
  adminEmail?: string
  subject: string
  message: string
}) {
  console.log('[sendAdminNotificationEmail] Placeholder - not yet implemented')
  return { success: true }
}

/**
 * Send access request rejection email (placeholder for existing code compatibility)
 */
export async function sendAccessRequestRejection(params: {
  email: string
  name: string
  reason?: string
}) {
  console.log('[sendAccessRequestRejection] Placeholder - not yet implemented')
  return { success: true }
}

/**
 * Send access request confirmation email (placeholder for existing code compatibility)
 */
export async function sendAccessRequestConfirmation(params: {
  email: string
  name: string
  role?: string
}) {
  console.log('[sendAccessRequestConfirmation] Placeholder - not yet implemented')
  return { success: true }
}

/**
 * Notify admins of access request (placeholder for existing code compatibility)
 */
export async function notifyAdminsOfAccessRequest(params: {
  applicantEmail: string
  applicantName: string
  role: string
  requestId?: string
  adminEmails?: string[]
  organization?: string
  message?: string
}) {
  console.log('[notifyAdminsOfAccessRequest] Placeholder - not yet implemented')
  return { success: true }
}
