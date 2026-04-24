// src/app/login/page.tsx
// MIGRATED: Redirects to new auth/signin page.
// URL /login preserved for backward compatibility.

import { redirect } from 'next/navigation'

export default function LoginPage() {
  redirect('/auth/signin')
}
