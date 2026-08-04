import { Text, Link, Button, Section, Hr } from '@react-email/components'
import * as React from 'react'
import { BaseEmailTemplate } from './BaseEmailTemplate'

interface AdminAccessRequestEmailProps {
  applicantName: string
  applicantEmail: string
  role: string
  organization?: string
  message?: string
  reviewUrl: string
}

export const AdminAccessRequestEmail = ({
  applicantName,
  applicantEmail,
  role,
  organization,
  message,
  reviewUrl,
}: AdminAccessRequestEmailProps) => (
  <BaseEmailTemplate
    preview={`New access request from ${applicantName}`}
    heading="New Access Request"
  >
    <Text style={paragraph}>
      A new access request has been submitted and requires your review.
    </Text>

    <Section style={detailsBox}>
      <Text style={detailLabel}>Applicant Name:</Text>
      <Text style={detailValue}>{applicantName}</Text>

      <Text style={detailLabel}>Email:</Text>
      <Text style={detailValue}>{applicantEmail}</Text>

      <Text style={detailLabel}>Requested Role:</Text>
      <Text style={detailValue}>{role}</Text>

      {organization && (
        <>
          <Text style={detailLabel}>Organization:</Text>
          <Text style={detailValue}>{organization}</Text>
        </>
      )}

      {message && (
        <>
          <Hr style={hr} />
          <Text style={detailLabel}>Message:</Text>
          <Text style={messageText}>{message}</Text>
        </>
      )}
    </Section>

    <Section style={buttonContainer}>
      <Button style={button} href={reviewUrl}>
        Review Request
      </Button>
    </Section>

    <Text style={paragraph}>
      Please review this request in the admin dashboard and approve or reject accordingly.
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

const detailsBox = {
  backgroundColor: '#f6f9fc',
  borderRadius: '8px',
  padding: '24px',
  marginBottom: '24px',
}

const detailLabel = {
  color: '#8898aa',
  fontSize: '13px',
  fontWeight: '600',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  marginBottom: '4px',
  marginTop: '16px',
}

const detailValue = {
  color: '#1a1a1a',
  fontSize: '16px',
  fontWeight: '500',
  marginTop: '0',
  marginBottom: '0',
}

const messageText = {
  color: '#525f7f',
  fontSize: '15px',
  lineHeight: '22px',
  marginTop: '8px',
  fontStyle: 'italic' as const,
}

const hr = {
  borderColor: '#e6ebf1',
  margin: '20px 0',
}

const buttonContainer = {
  textAlign: 'center' as const,
  marginTop: '24px',
  marginBottom: '24px',
}

const button = {
  backgroundColor: '#D4AF37',
  borderRadius: '8px',
  color: '#1a1a1a',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 32px',
}
