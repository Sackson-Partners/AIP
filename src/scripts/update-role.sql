-- Update specific user role
UPDATE profiles
SET
  role = 'super_admin',
  is_verified = true,
  is_active = true
WHERE email = 'info@africa-infra.com';

-- Verify
SELECT id, email, role, is_verified, is_active
FROM profiles
WHERE email = 'info@africa-infra.com';
