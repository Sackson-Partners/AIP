import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
  // Check column constraints on profiles table
  // Query information_schema directly
  const { data: cols, error: colErr } = await sb
    .from('information_schema.columns' as never)
    .select('column_name, data_type, is_nullable, column_default')
    .eq('table_schema', 'public')
    .eq('table_name', 'profiles')

  if (colErr) {
    console.log('columns query error:', colErr.message)
  } else {
    console.log('profiles columns:')
    console.table(cols)
  }

  // Also check if there are any existing profiles to understand the shape
  const { data: sample } = await sb.from('profiles').select('*').limit(1)
  console.log('\nSample profile row:', JSON.stringify(sample, null, 2))
}
main().catch(e => { console.error(e.message); process.exit(1) })
