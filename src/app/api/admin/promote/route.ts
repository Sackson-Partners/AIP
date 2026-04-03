import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const VALID_ROLES = [
  'super_admin', 'private_fund', 'dfi', 'epc_contractor',
  'government', 'academic', 'journalist_analyst', 'investor',
] as const;

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();

  // Build a server Supabase client with the caller's session
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  // Verify caller is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Service-role client for admin operations (uses createClient, not createServerClient)
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  // Verify caller is super_admin — check profiles table (DB source of truth),
  // NOT user_metadata which can be stale or modified client-side.
  const { data: callerProfile, error: callerProfileError } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (callerProfileError || callerProfile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden — super_admin only' }, { status: 403 });
  }

  // Parse and validate body
  let body: { email?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { email, role } = body;
  if (!email || !role) {
    return NextResponse.json({ error: 'email and role are required' }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
    return NextResponse.json(
      { error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` },
      { status: 400 }
    );
  }

  // Look up the target user's ID from the profiles table by email (service role bypasses RLS)
  const { data: profileData, error: profileError } = await adminSupabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();

  if (profileError || !profileData) {
    return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 });
  }

  const targetId = (profileData as { id: string }).id;

  // Update user_metadata via the admin API (affects JWT claims on next sign-in)
  const { error: metaError } = await adminSupabase.auth.admin.updateUserById(
    targetId,
    { user_metadata: { role } }
  );
  if (metaError) {
    return NextResponse.json({ error: metaError.message }, { status: 500 });
  }

  // Also update profiles table to keep both sources in sync
  // (useRBAC reads profiles.role as the primary source of truth)
  const { error: profileUpdateError } = await adminSupabase
    .from('profiles')
    .update({ role })
    .eq('id', targetId);

  if (profileUpdateError) {
    return NextResponse.json({ error: profileUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: `User ${email} promoted to ${role}`,
    userId: targetId,
  });
}
