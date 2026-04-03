/**
 * One-shot script to create the platform superAdmin account.
 *
 * Usage:
 *   npx tsx scripts/create-super-admin.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local');
  process.exit(1);
}

const SUPER_ADMIN_EMAIL    = 'superadmin@africa-infra.com';
const SUPER_ADMIN_PASSWORD = 'AIP@SuperAdmin2024!';
const SUPER_ADMIN_ROLE     = 'super_admin';
const SUPER_ADMIN_NAME     = 'Super Admin';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  console.log(`Creating superAdmin: ${SUPER_ADMIN_EMAIL}`);

  // Check if user already exists
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('email', SUPER_ADMIN_EMAIL)
    .maybeSingle();

  if (existing) {
    console.log(`User already exists (id: ${existing.id}, role: ${existing.role})`);

    if (existing.role !== SUPER_ADMIN_ROLE) {
      console.log('Updating role to super_admin...');

      // Update user_metadata
      const { error: metaError } = await supabase.auth.admin.updateUserById(existing.id, {
        user_metadata: { role: SUPER_ADMIN_ROLE },
      });
      if (metaError) throw new Error(`user_metadata update failed: ${metaError.message}`);

      // Update profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: SUPER_ADMIN_ROLE, is_active: true, is_verified: true })
        .eq('id', existing.id);
      if (profileError) throw new Error(`profiles update failed: ${profileError.message}`);

      console.log('Role updated to super_admin.');
    } else {
      console.log('Already super_admin. Nothing to do.');
    }
    return;
  }

  // Create the auth user
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email:          SUPER_ADMIN_EMAIL,
    password:       SUPER_ADMIN_PASSWORD,
    email_confirm:  true,             // skip email confirmation flow
    user_metadata:  {
      full_name:      SUPER_ADMIN_NAME,
      role:           SUPER_ADMIN_ROLE,
      user_type_slug: 'private_company',
    },
  });

  if (createError || !created.user) {
    throw new Error(`Auth user creation failed: ${createError?.message}`);
  }

  const userId = created.user.id;
  console.log(`Auth user created (id: ${userId})`);

  // Upsert the profiles row (the DB trigger may already insert one, this ensures role is set)
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id:                userId,
      email:             SUPER_ADMIN_EMAIL,
      full_name:         SUPER_ADMIN_NAME,
      role:              SUPER_ADMIN_ROLE,
      user_type_slug:    'private_company',
      is_active:         true,
      is_verified:       true,
      subscription_tier: 'enterprise',
    }, { onConflict: 'id' });

  if (profileError) {
    // Non-fatal: the DB trigger may have already created the profile
    console.warn(`profiles upsert warning: ${profileError.message}`);
  }

  console.log('');
  console.log('superAdmin created successfully.');
  console.log(`  Email:    ${SUPER_ADMIN_EMAIL}`);
  console.log(`  Password: ${SUPER_ADMIN_PASSWORD}`);
  console.log(`  Role:     ${SUPER_ADMIN_ROLE}`);
  console.log('');
  console.log('Login at https://app.africa-infra.com/login');
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
