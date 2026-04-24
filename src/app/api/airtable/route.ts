import { NextResponse } from 'next/server'

// TODO: Implement Airtable integration when AIRTABLE_API_KEY is configured.
// Previously proxied to Python backend. Port the logic from backend/routers/airtable.py.
export async function GET() {
  return NextResponse.json(
    { error: 'Airtable integration not yet implemented in Next.js API routes.' },
    { status: 501 }
  )
}
