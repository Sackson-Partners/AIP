import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
  const { data, error } = await sb.auth.admin.listUsers()
  if (error) { console.error('listUsers error:', error.message); process.exit(1) }

  const found = data.users.find((u: { email?: string }) => u.email === 'superadmin@africa-infra.com')
  if (found) {
    console.log('EXISTS in auth.users:', JSON.stringify({ id: found.id, email: found.email, metadata: found.user_metadata }, null, 2))
  } else {
    console.log('NOT found in auth.users')
  }

  const { data: p, error: pe } = await sb.from('profiles').select('id,email,role,is_active,is_verified').eq('email','superadmin@africa-infra.com').maybeSingle()
  console.log('profiles row:', JSON.stringify(p, null, 2))
  if (pe) console.log('profiles error:', pe.message)
}
main().catch(e => { console.error(e.message); process.exit(1) })
