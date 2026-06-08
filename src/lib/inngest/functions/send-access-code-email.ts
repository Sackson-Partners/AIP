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

export const sendAccessCodeEmail = inngest.createFunction(
  {
    id: 'send-access-code-email',
    name: 'Send Access Code Email',
    retries: 2,
  },
  { event: 'email/send-access-code' },
  async ({ event, step }) => {
    const { email, accessCode, projectId, projectTitle } = event.data

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
        <h2 style="margin:0 0 16px;color:#f1f5f9;font-size:20px">Your Access Code</h2>
        <p style="margin:0 0 12px;color:#94a3b8;font-size:14px;line-height:1.6">
          You have been granted access to view the data room for:
        </p>
        <p style="margin:0 0 20px;color:#f1f5f9;font-size:16px;font-weight:600">
          ${projectTitle}
        </p>

        <div style="background:#0f172a;border-radius:8px;border:1px solid #334155;padding:24px;margin:24px 0;text-align:center">
          <p style="margin:0 0 8px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:1px">
            Your 6-Digit Access Code
          </p>
          <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#3b82f6;font-family:monospace">
            ${accessCode}
          </div>
        </div>

        <div style="background:#451a03;border:1px solid #92400e;border-radius:8px;padding:16px;margin:16px 0">
          <p style="margin:0;color:#fbbf24;font-size:13px;font-weight:600">
            ⚠ This code expires in 24 hours and can only be used once.
          </p>
        </div>

        <p style="margin:0 0 12px;color:#94a3b8;font-size:14px;line-height:1.6">
          Click below to access the data room:
        </p>

        <a href="${appUrl}/data-room/${projectId}"
           style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:20px 0">
          Access Data Room
        </a>

        <p style="margin:20px 0 0;color:#64748b;font-size:13px">
          If you did not request this access, please disregard this email.
        </p>
      `)

      await resend.emails.send({
        from: FROM,
        to: email,
        subject: `Access Code for ${projectTitle}`,
        html,
      })

      console.log(`[Email] Access code sent to ${email} for project ${projectId}`)
    })

    return { success: true, email, projectId }
  }
)
