import { Button, Text } from '@react-email/components'
import * as React from 'react'
import { BaseEmailTemplate } from './BaseEmailTemplate'

interface ICVoteRequestEmailProps {
  committeeUserName: string
  projectName: string
  projectCode: string
  voteUrl: string
  dueDate: string
}

export const ICVoteRequestEmail = ({
  committeeUserName,
  projectName,
  projectCode,
  voteUrl,
  dueDate,
}: ICVoteRequestEmailProps) => (
  <BaseEmailTemplate
    preview={`Vote requested for ${projectName}`}
    heading="Investment Committee Vote Requested"
  >
    <Text style={text}>Hi {committeeUserName},</Text>
    <Text style={text}>
      You have been requested to vote on the following project as part of the Investment Committee:
    </Text>
    <Text style={projectInfo}>
      <strong>Project:</strong> {projectName}
      <br />
      <strong>Code:</strong> {projectCode}
      <br />
      <strong>Due Date:</strong> {dueDate}
    </Text>
    <Text style={text}>
      Please review the project materials and submit your vote (Approve, Reject, or Abstain) along
      with your comments.
    </Text>
    <Button href={voteUrl} style={button}>
      Review & Vote Now
    </Button>
    <Text style={text}>
      If you have any questions, please contact the deal team.
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
