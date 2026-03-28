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

  // Verify caller is super_admin
  const callerRole = user.user_metadata?.role as string | undefined;
  if (callerRole !== 'super_admin') {
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

  // Service-role client for admin operations (uses createClient, not createServerClient)
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  // Find user by email
  const { data: { users }, error: listError } = await adminSupabase.auth.admin.listUsers();
  if (listError) {
    return NextResponse.json({ error: 'Failed to list users' }, { status: 500 });
  }

  const target = users.find((u) => u.email === email);
  if (!target) {
    return NextResponse.json({ error: `No user found with email: ${email}` }, { status: 404 });
  }

  // Update role in user metadata
  const { error: updateError } = await adminSupabase.auth.admin.updateUserById(target.id, {
    user_metadata: { ...target.user_metadata, role },
  });

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: `User ${email} promoted to ${role}`,
    userId: target.id,
  });
}
