import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Validate at runtime in the browser where Supabase is actually used.
// During Next.js SSG/SSR prerendering the env vars aren't available,
// but the client is never called server-side, so we defer the throw.
if (typeof window !== 'undefined' && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error(
    'Missing required environment variables: ' +
    [!supabaseUrl && 'NEXT_PUBLIC_SUPABASE_URL', !supabaseAnonKey && 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
      .filter(Boolean)
      .join(', ')
  )
}

// Safe to cast: during SSR build these are placeholders (never called);
// in the browser the guard above throws before we reach here if they're missing.
const _url = (supabaseUrl ?? '') as string
const _key = (supabaseAnonKey ?? '') as string

// Singleton — prevents multiple GoTrue client instances which cause auth state bugs
let _client: SupabaseClient | null = null

function getClient(): SupabaseClient | null {
  // Never run in SSR/SSG — pages using Supabase are all 'use client' components
  // and their module-level exports must not call createClient on the server.
  if (typeof window === 'undefined') return null
  if (!_url || !_key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  if (!_client) {
    _client = createClient(_url, _key, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'aip-auth-token',
      },
    })
  }
  return _client
}

// In the browser: real client. During SSR prerendering: null — safe because
// all pages that access supabase.auth are 'use client' components that don't
// execute server-side.
export const supabase = getClient() as SupabaseClient
