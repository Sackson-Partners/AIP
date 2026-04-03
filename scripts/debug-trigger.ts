import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
  // Try creating user - if it fails, attempt a direct profile insert workaround
  console.log('Attempting user creation...')
  const { data: created, error: createError } = await sb.auth.admin.createUser({
    email: 'superadmin@africa-infra.com',
    password: 'AIP@SuperAdmin2024!',
    email_confirm: true,
    user_metadata: {
      full_name: 'Super Admin',
      role: 'super_admin',
    },
    app_metadata: { role: 'super_admin' },
  })

  if (createError) {
    console.error('createUser error:', createError.message, createError)

    // Check if the trigger failing is the issue — try without email_confirm
    console.log('\nTrying without email_confirm...')
    const { data: c2, error: e2 } = await sb.auth.admin.createUser({
      email: 'superadmin@africa-infra.com',
      password: 'AIP@SuperAdmin2024!',
      user_metadata: { full_name: 'Super Admin', role: 'super_admin' },
    })
    if (e2) {
      console.error('Still failing:', e2.message)
    } else {
      console.log('Created without email_confirm:', c2.user?.id)
    }
    return
  }

  console.log('Created user:', created.user?.id)
}
main().catch(e => { console.error(e.message); process.exit(1) })
