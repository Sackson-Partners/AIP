import { NextResponse } from 'next/server'

/**
 * Sentry Test Endpoint
 *
 * Purpose: Verify Sentry error tracking is working
 * Usage: Visit /api/sentry-test to trigger a test error
 *
 * IMPORTANT: Only enable in non-production or for testing
 */

export async function GET() {
  // Check if in production - require confirmation
  if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_SENTRY_TEST) {
    return NextResponse.json(
      {
        error: 'Sentry test endpoint disabled in production',
        hint: 'Set ENABLE_SENTRY_TEST=true to enable'
      },
      { status: 403 }
    )
  }

  try {
    // Intentionally throw an error to test Sentry
    throw new Error('Sentry Test Error: If you see this in Sentry, error tracking is working! 🎉')
  } catch (error) {
    // Sentry will automatically capture this via logger
    console.error('[Sentry Test] Intentional error thrown:', error)

    return NextResponse.json(
      {
        message: 'Test error thrown successfully',
        check: 'Go to Sentry dashboard to verify error was captured',
        url: 'https://sentry.io',
        tip: 'Should appear within 30 seconds'
      },
      { status: 200 }
    )
  }
}
