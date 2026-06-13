import { Button, Text } from '@react-email/components'
import * as React from 'react'
import { BaseEmailTemplate } from './BaseEmailTemplate'

interface ContactRequestEmailProps {
  requesterName: string
  targetType: 'PROJECT' | 'INVESTOR' | 'PARTNER'
  targetName: string
  message?: string
  reviewUrl: string
}

export const ContactRequestEmail = ({
  requesterName,
  targetType,
  targetName,
  message,
  reviewUrl,
}: ContactRequestEmailProps) => (
  <BaseEmailTemplate
    preview={`New contact request from ${requesterName}`}
    heading="New Contact Information Request"
  >
    <Text style={text}>
      <strong>{requesterName}</strong> has requested contact information for:
    </Text>
    <Text style={targetInfo}>
      <strong>Type:</strong> {targetType}
      <br />
      <strong>Name:</strong> {targetName}
    </Text>
    {message && (
      <>
        <Text style={text}>
          <strong>Message:</strong>
        </Text>
        <Text style={messageBox}>{message}</Text>
      </>
    )}
    <Text style={text}>
      Please review this request and approve or reject it from the admin dashboard.
    </Text>
    <Button href={reviewUrl} style={button}>
      Review Request
    </Button>
  </BaseEmailTemplate>
)

const text = {
  color: '#525f7f',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '0 0 16px',
}

const targetInfo = {
  ...text,
  backgroundColor: '#f6f9fc',
  padding: '16px',
  borderRadius: '4px',
}

const messageBox = {
  ...text,
  backgroundColor: '#f6f9fc',
  padding: '16px',
  borderRadius: '4px',
  fontStyle: 'italic' as const,
}

const button = {
  backgroundColor: '#0070f3',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '14px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
  margin: '16px 0',
}
