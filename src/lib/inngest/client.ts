import { Inngest, EventSchemas } from 'inngest'

// Define event types for type safety
type Events = {
  'pis/generate': {
    data: {
      pisId: string
      projectId: string
      userId: string
    }
  }
  'pestel/augment': {
    data: {
      assessmentId: string
      projectId: string
      userId: string
    }
  }
  'email/send-access-code': {
    data: {
      email: string
      accessCode: string
      projectId: string
      projectTitle: string
    }
  }
  'email/send-nda': {
    data: {
      email: string
      projectId: string
      projectTitle: string
    }
  }
  'notification/send': {
    data: {
      userId: string
      type: string
      title: string
      message: string
      link?: string
    }
  }
}

// Create Inngest client
export const inngest = new Inngest({
  id: 'aip-platform',
  name: 'AIP Platform',
  schemas: new EventSchemas().fromRecord<Events>(),
  // In development, events are sent to dev server
  // In production, set INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY
  eventKey: process.env.INNGEST_EVENT_KEY,
})
