import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// createBrowserClient (from @supabase/ssr) stores the session in cookies,
// making it compatible with the server-side SSR client used in middleware
// and route handlers. Using createClient (@supabase/supabase-js) stores
// in localStorage, causing a session mismatch after email confirmation.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
