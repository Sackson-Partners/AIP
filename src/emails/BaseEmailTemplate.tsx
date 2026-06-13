import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'

interface BaseEmailTemplateProps {
  preview: string
  heading: string
  children: React.ReactNode
}

export const BaseEmailTemplate = ({
  preview,
  heading,
  children,
}: BaseEmailTemplateProps) => (
  <Html>
    <Head />
    <Preview>{preview}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={h1}>Africa Infrastructure Partners</Heading>
        </Section>
        <Section style={content}>
          <Heading as="h2" style={h2}>
            {heading}
          </Heading>
          {children}
        </Section>
        <Section style={footer}>
          <Text style={footerText}>
            © {new Date().getFullYear()} Africa Infrastructure Partners. All rights reserved.
          </Text>
          <Text style={footerText}>
            This email was sent from the AIP Platform.{' '}
            <Link href="https://africa-infra.com" style={link}>
              Visit our website
            </Link>
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
}

const header = {
  padding: '32px 40px',
  borderBottom: '1px solid #e6ebf1',
}

const content = {
  padding: '32px 40px',
}

const footer = {
  padding: '32px 40px',
  borderTop: '1px solid #e6ebf1',
}

const h1 = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: '700',
  margin: '0',
  padding: '0',
}

const h2 = {
  color: '#1a1a1a',
  fontSize: '20px',
  fontWeight: '600',
  margin: '0 0 16px',
}

const footerText = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '4px 0',
}

const link = {
  color: '#0070f3',
  textDecoration: 'underline',
}
