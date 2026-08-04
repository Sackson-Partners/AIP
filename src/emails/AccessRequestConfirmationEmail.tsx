import { Text, Link } from '@react-email/components'
import * as React from 'react'
import { BaseEmailTemplate } from './BaseEmailTemplate'

interface AccessRequestConfirmationEmailProps {
  name: string
  role: string
}

export const AccessRequestConfirmationEmail = ({
  name,
  role,
}: AccessRequestConfirmationEmailProps) => (
  <BaseEmailTemplate
    preview="Your access request has been received"
    heading="Access Request Received"
  >
    <Text style={paragraph}>Hi {name},</Text>
    <Text style={paragraph}>
      Thank you for requesting access to the AIP Platform as a <strong>{role}</strong>.
    </Text>
    <Text style={paragraph}>
      Your request has been received and is currently under review by our team. We typically review requests within 2-3 business days.
    </Text>
    <Text style={paragraph}>
      You will receive an email notification once your request has been reviewed. If approved, you will receive login credentials to access the platform.
    </Text>
    <Text style={paragraph}>
      If you have any questions in the meantime, please don't hesitate to reach out to us.
    </Text>
    <Text style={paragraph}>
      Best regards,
      <br />
      The AIP Team
    </Text>
  </BaseEmailTemplate>
)

const paragraph = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '24px',
  textAlign: 'left' as const,
  marginBottom: '16px',
}
