// src/app/auth/callback/route.ts
// MIGRATED: Supabase PKCE callback → NextAuth handles callbacks
// automatically at /api/auth/callback/azure-ad
// This route now redirects legacy bookmark users to new sign-in.

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const error = requestUrl.searchParams.get('error')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'

  // If there is an error param, redirect to error page
  if (error) {
    return NextResponse.redirect(
      new URL(
        `/auth/error?error=${encodeURIComponent(error)}`,
        requestUrl.origin
      )
    )
  }

  // NextAuth handles its own callbacks at /api/auth/callback/*
  // Any legacy /auth/callback requests redirect to sign-in
  if (code) {
    // Could be a legacy Supabase code — redirect to new signin
    return NextResponse.redirect(
      new URL('/auth/signin', requestUrl.origin)
    )
  }

  // Default: redirect to intended destination or dashboard
  return NextResponse.redirect(
    new URL(next, requestUrl.origin)
  )
}
