import { Button, Text } from '@react-email/components'
import * as React from 'react'
import { BaseEmailTemplate } from './BaseEmailTemplate'

interface ProjectPublishedEmailProps {
  investorName: string
  projectName: string
  projectCode: string
  projectSector: string
  projectCountry: string
  projectUrl: string
}

export const ProjectPublishedEmail = ({
  investorName,
  projectName,
  projectCode,
  projectSector,
  projectCountry,
  projectUrl,
}: ProjectPublishedEmailProps) => (
  <BaseEmailTemplate
    preview={`New project: ${projectName}`}
    heading="New Investment Opportunity"
  >
    <Text style={text}>Hi {investorName},</Text>
    <Text style={text}>
      A new project matching your investment criteria has been published on the AIP Platform:
    </Text>
    <Text style={projectInfo}>
      <strong>Project:</strong> {projectName}
      <br />
      <strong>Code:</strong> {projectCode}
      <br />
      <strong>Sector:</strong> {projectSector}
      <br />
      <strong>Country:</strong> {projectCountry}
    </Text>
    <Text style={text}>
      Review the project details and express your interest directly through the platform.
    </Text>
    <Button href={projectUrl} style={button}>
      View Project
    </Button>
    <Text style={text}>
      You can manage your notification preferences in your account settings.
    </Text>
  </BaseEmailTemplate>
)

const text = {
  color: '#525f7f',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '0 0 16px',
}

const projectInfo = {
  ...text,
  backgroundColor: '#f6f9fc',
  padding: '16px',
  borderRadius: '4px',
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
