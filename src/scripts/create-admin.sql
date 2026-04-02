-- ============================================================
-- AIP Platform — Promote user to super_admin
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- Step 1: Find the user's ID by email
SELECT id, email, raw_user_meta_data
FROM auth.users
WHERE email = 'YOUR_EMAIL_HERE';

-- Step 2: Promote to super_admin
-- Replace YOUR_EMAIL_HERE with the target email address
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data ||
  '{"role": "super_admin"}'::jsonb
WHERE email = 'YOUR_EMAIL_HERE';

-- Step 3: Also update the profiles table if it exists
-- (Run only if you have a separate profiles table)
-- UPDATE public.profiles
-- SET role = 'super_admin',
--     is_verified = true,
--     is_active = true
-- WHERE email = 'YOUR_EMAIL_HERE';

-- Step 4: Verify the change
SELECT id, email, raw_user_meta_data->>'role' AS role
FROM auth.users
WHERE email = 'YOUR_EMAIL_HERE';

-- ============================================================
-- To demote a user, set role back to their original role:
-- UPDATE auth.users
-- SET raw_user_meta_data = raw_user_meta_data ||
--   '{"role": "private_fund"}'::jsonb
-- WHERE email = 'OTHER_EMAIL_HERE';
-- ============================================================
