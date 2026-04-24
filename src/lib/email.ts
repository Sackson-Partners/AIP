import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const FROM = process.env.SMTP_FROM ?? "AIP Platform <noreply@aip.com>"

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

const btn = (url: string, label: string) =>
  `<a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:20px 0">${label}</a>`

const h2 = (text: string) =>
  `<h2 style="margin:0 0 16px;color:#f1f5f9;font-size:20px">${text}</h2>`

const p = (text: string) =>
  `<p style="margin:0 0 12px;color:#94a3b8;font-size:14px;line-height:1.6">${text}</p>`

const field = (label: string, value: string) =>
  `<tr>
    <td style="padding:8px 12px;background:#0f172a;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.5px;width:140px">${label}</td>
    <td style="padding:8px 12px;background:#0f172a;color:#f1f5f9;font-size:14px;font-weight:600">${value}</td>
  </tr>`

// ─── Public API ───────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(params: {
  email: string
  name: string
  role: string
  temporaryPassword: string
  employeeId: string
}): Promise<void> {
  const { email, name, role, temporaryPassword, employeeId } = params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.africa-infra.com"

  const html = base(`
    ${h2(`Welcome to AIP Platform, ${name}`)}
    ${p("Your internal account has been created. Use the credentials below to sign in for the first time.")}

    <div style="background:#0f172a;border-radius:8px;border:1px solid #334155;overflow:hidden;margin:20px 0">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${field("Employee ID", employeeId)}
        ${field("Email", email)}
        ${field("Temp Password", `<code style="background:#1e293b;padding:2px 8px;border-radius:4px;font-family:monospace;color:#f59e0b">${temporaryPassword}</code>`)}
        ${field("Role", role)}
      </table>
    </div>

    <div style="background:#451a03;border:1px solid #92400e;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0;color:#fbbf24;font-size:13px;font-weight:600">
        ⚠ You must change your password on first login. This temporary password expires in 24 hours.
      </p>
    </div>

    <p style="margin:4px 0;color:#64748b;font-size:13px">
      Sign in using the <strong style="color:#94a3b8">Internal Access</strong> tab on the sign-in page.
    </p>

    ${btn(`${appUrl}/auth/signin`, "Sign In to AIP Platform")}

    ${p("If you did not request this account, contact your administrator immediately.")}
  `)

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: `Welcome to AIP Platform — Your Account is Ready`,
    html,
  })
}

export async function sendActivationEmail(params: {
  email: string
  name: string
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.africa-infra.com"
  const html = base(`
    ${h2(`Your account has been approved, ${params.name}`)}
    ${p("An administrator has approved your AIP Platform account. You can now sign in and access all features available to your account type.")}
    ${btn(`${appUrl}/auth/signin`, "Sign In Now")}
  `)
  await transporter.sendMail({
    from: FROM,
    to: params.email,
    subject: "AIP Platform — Account Approved",
    html,
  })
}

export async function sendSuspensionEmail(params: {
  email: string
  name: string
  reason?: string
}): Promise<void> {
  const html = base(`
    ${h2(`Account Suspended`)}
    ${p(`Hello ${params.name},`)}
    ${p("Your AIP Platform account has been suspended.")}
    ${params.reason ? `<div style="background:#1e1010;border:1px solid #7f1d1d;border-radius:8px;padding:16px;margin:12px 0"><p style="margin:0;color:#fca5a5;font-size:13px">Reason: ${params.reason}</p></div>` : ""}
    ${p("To appeal this decision, contact your administrator.")}
  `)
  await transporter.sendMail({
    from: FROM,
    to: params.email,
    subject: "AIP Platform — Account Suspended",
    html,
  })
}

export async function sendPasswordResetEmail(params: {
  email: string
  name: string
  temporaryPassword: string
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.africa-infra.com"
  const html = base(`
    ${h2(`Password Reset`)}
    ${p(`Hello ${params.name}, your password has been reset by an administrator.`)}
    <div style="background:#0f172a;border-radius:8px;border:1px solid #334155;overflow:hidden;margin:20px 0">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${field("Temp Password", `<code style="background:#1e293b;padding:2px 8px;border-radius:4px;font-family:monospace;color:#f59e0b">${params.temporaryPassword}</code>`)}
      </table>
    </div>
    <div style="background:#451a03;border:1px solid #92400e;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0;color:#fbbf24;font-size:13px;font-weight:600">
        ⚠ You must change this password on next login. It expires in 24 hours.
      </p>
    </div>
    ${btn(`${appUrl}/auth/signin`, "Sign In Now")}
  `)
  await transporter.sendMail({
    from: FROM,
    to: params.email,
    subject: "AIP Platform — Password Reset",
    html,
  })
}

export async function sendAdminNotificationEmail(params: {
  adminEmail: string
  subject: string
  message: string
}): Promise<void> {
  const html = base(`
    ${h2(params.subject)}
    ${p(params.message)}
  `)
  await transporter.sendMail({
    from: FROM,
    to: params.adminEmail,
    subject: `[AIP Admin] ${params.subject}`,
    html,
  })
}
