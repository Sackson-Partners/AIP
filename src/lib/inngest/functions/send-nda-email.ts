import { inngest } from '../client'
import { Resend } from 'resend'

const FROM = process.env.RESEND_FROM_EMAIL ?? 'AIP Platform <noreply@africa-infra.com>'

const base = (content: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px">
      <table width="600" cellpadding="0" cellspacing="0"
        style="background:#1e293b;border-radius:12px;border:1px solid #334155;overflow:hidden">
        <tr>
          <td style="background:linear-gradient(135deg,#1e40af,#1d4ed8);padding:32px;text-align:center">
            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.5px">
              AIP Platform
            </h1>
            <p style="margin:4px 0 0;color:#93c5fd;font-size:13px">Africa Infrastructure Pipeline</p>
          </td>
        </tr>
        <tr><td style="padding:32px">${content}</td></tr>
        <tr>
          <td style="background:#0f172a;padding:20px 32px;border-top:1px solid #334155;text-align:center">
            <p style="margin:0;color:#64748b;font-size:12px">
              This message is confidential and for internal use only.<br>
              © ${new Date().getFullYear()} AIP Platform. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

export const sendNDAEmail = inngest.createFunction(
  {
    id: 'send-nda-email',
    name: 'Send NDA Request Email',
    retries: 2,
  },
  { event: 'email/send-nda' },
  async ({ event, step }) => {
    const { email, projectId, projectTitle } = event.data

    // Check if Resend is configured
    if (!process.env.RESEND_API_KEY) {
      console.warn('[Email] Resend not configured. Skipping email send.')
      return { success: false, reason: 'not_configured' }
    }

    const resend = new Resend(process.env.RESEND_API_KEY)

    // Send email
    await step.run('send-email', async () => {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://aip-plum.vercel.app'

      const html = base(`
        <h2 style="margin:0 0 16px;color:#f1f5f9;font-size:20px">NDA Signature Required</h2>
        <p style="margin:0 0 12px;color:#94a3b8;font-size:14px;line-height:1.6">
          To access the data room for the following project, you must first sign a Non-Disclosure Agreement (NDA):
        </p>
        <p style="margin:0 0 20px;color:#f1f5f9;font-size:16px;font-weight:600">
          ${projectTitle}
        </p>

        <div style="background:#0f172a;border-radius:8px;border:1px solid #334155;padding:20px;margin:24px 0">
          <p style="margin:0 0 12px;color:#94a3b8;font-size:14px;line-height:1.6">
            The NDA ensures confidentiality of sensitive project information and protects all parties involved.
          </p>
          <ul style="margin:0;padding-left:20px;color:#94a3b8;font-size:14px;line-height:1.8">
            <li>Review the NDA carefully</li>
            <li>Sign electronically using the secure link below</li>
            <li>Access will be granted immediately upon signature</li>
          </ul>
        </div>

        <a href="${appUrl}/data-room/${projectId}/nda"
           style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:20px 0">
          Review and Sign NDA
        </a>

        <div style="background:#451a03;border:1px solid #92400e;border-radius:8px;padding:16px;margin:20px 0">
          <p style="margin:0;color:#fbbf24;font-size:13px;font-weight:600">
            ⚠ Your access code will remain active for 24 hours. Please sign the NDA before it expires.
          </p>
        </div>

        <p style="margin:20px 0 0;color:#64748b;font-size:13px">
          If you have questions about this NDA, please contact the project administrator.
        </p>
      `)

      await resend.emails.send({
        from: FROM,
        to: email,
        subject: `NDA Required for ${projectTitle}`,
        html,
      })

      console.log(`[Email] NDA request sent to ${email} for project ${projectId}`)
    })

    return { success: true, email, projectId }
  }
)
