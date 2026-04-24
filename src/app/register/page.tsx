// src/app/register/page.tsx
// MIGRATED: Redirects to new auth/signin page.
// Registration happens via Microsoft sign-in
// followed by /auth/complete-profile wizard.
// URL /register preserved for backward compatibility.

import { redirect } from 'next/navigation'

export default function RegisterPage() {
  redirect('/auth/signin')
}
