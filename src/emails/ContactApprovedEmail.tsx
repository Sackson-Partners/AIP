import { Text } from '@react-email/components'
import * as React from 'react'
import { BaseEmailTemplate } from './BaseEmailTemplate'

interface ContactApprovedEmailProps {
  requesterName: string
  targetType: 'PROJECT' | 'INVESTOR' | 'PARTNER'
  targetName: string
  contactInfo: {
    name?: string
    email?: string
    phone?: string
    organization?: string
  }
}

export const ContactApprovedEmail = ({
  requesterName,
  targetType,
  targetName,
  contactInfo,
}: ContactApprovedEmailProps) => (
  <BaseEmailTemplate
    preview="Contact request approved"
    heading="Contact Request Approved"
  >
    <Text style={text}>Hi {requesterName},</Text>
    <Text style={text}>
      Your contact information request has been approved. Below are the details:
    </Text>
    <Text style={targetInfo}>
      <strong>Type:</strong> {targetType}
      <br />
      <strong>Name:</strong> {targetName}
    </Text>
    <Text style={contactBox}>
      {contactInfo.name && (
        <>
          <strong>Contact Name:</strong> {contactInfo.name}
          <br />
        </>
      )}
      {contactInfo.email && (
        <>
          <strong>Email:</strong> {contactInfo.email}
          <br />
        </>
      )}
      {contactInfo.phone && (
        <>
          <strong>Phone:</strong> {contactInfo.phone}
          <br />
        </>
      )}
      {contactInfo.organization && (
        <>
          <strong>Organization:</strong> {contactInfo.organization}
          <br />
        </>
      )}
    </Text>
    <Text style={text}>
      Please handle this information with care and in accordance with AIP's confidentiality policies.
    </Text>
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

const contactBox = {
  ...text,
  backgroundColor: '#e6f7ff',
  padding: '16px',
  borderRadius: '4px',
  border: '1px solid #91d5ff',
}
