# Supabase Configuration — AIP Platform

## Required settings for www.app.africa-infra.com

---

## 1. Auth → URL Configuration

| Setting | Value |
|---------|-------|
| **Site URL** | `https://www.app.africa-infra.com` |
| **Redirect URLs** | `https://www.app.africa-infra.com/auth/callback` |
| | `https://www.africa-infra.com/auth/callback` |
| | `https://www.africa-infra.com/auth/callback` |
| | `http://localhost:3000/auth/callback` (dev) |

---

## 2. Auth → Email Templates

### Confirm signup
Set the **Confirm signup** email template's confirmation URL to:
```
{{ .SiteURL }}/auth/callback?code={{ .Code }}
```

### Password reset
```
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery
```

### Magic link
```
{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink
```

---

## 3. Auth flow (how it works)

```
User registers
  → Supabase sends email with link:
    https://www.app.africa-infra.com/auth/callback?code=XXXX
  → /auth/callback route handler:
    1. Calls exchangeCodeForSession(code)
    2. Sets session cookies on the redirect response (NOT via next/headers)
    3. Redirects to /dashboard
  → Middleware reads cookies → user authenticated → /dashboard renders
  → AuthContext (createBrowserClient) reads cookies → isAuthenticated = true
```

**Why cookies, not localStorage?**
The middleware runs on the server and can only read cookies. The `createBrowserClient`
from `@supabase/ssr` stores the session in cookies so that both client and server
see the same session state. Using `createClient` from `@supabase/supabase-js` stores
in localStorage, which the server cannot read — causing auth failures.

---

## 4. RLS Policies

Enable Row Level Security on all tables. Minimum required policies:

```sql
-- Allow users to read their own profile
CREATE POLICY "Users can read own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);
```

For the projects, investors, and other tables, add appropriate policies based on the
role stored in `auth.users.raw_user_meta_data->>'role'`.

---

## 5. Promote a user to super_admin

Run in **Supabase Dashboard → SQL Editor**:
```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "super_admin"}'::jsonb
WHERE email = 'your-email@example.com';
```

Or use the API endpoint (requires existing super_admin session):
```bash
curl -X POST https://www.app.africa-infra.com/api/admin/promote \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{"email": "target@example.com", "role": "super_admin"}'
```

The `/api/admin/promote` endpoint uses `SUPABASE_SERVICE_KEY` — ensure this is set
in Vercel environment variables (not `NEXT_PUBLIC_*`, as it must stay server-side only).

---

## 6. Environment variables

### Vercel (frontend)
| Variable | Where to get it |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_KEY` | Supabase Dashboard → Settings → API → service_role key |
| `NEXT_PUBLIC_API_URL` | Your Azure Container App FQDN |

### Azure Container Apps (backend)
| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | Same as `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | Same as `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `SUPABASE_SERVICE_KEY` | Same as `SUPABASE_SERVICE_KEY` |
| `ALLOWED_ORIGINS` | `https://www.app.africa-infra.com,https://www.africa-infra.com,https://www.africa-infra.com` |

---

## 7. Auth callback complete trace

1. User clicks confirmation link → `GET /auth/callback?code=XXXX`
2. Route handler creates `NextResponse.redirect('/dashboard')`
3. Supabase `exchangeCodeForSession(code)` runs and calls `setAll(cookies)`
4. Cookies are set directly on the redirect response object
5. Browser receives `302 → /dashboard` with `Set-Cookie` headers
6. Middleware reads cookie → `getUser()` returns user → allows `/dashboard`
7. `AuthContext` mounts, `createBrowserClient` reads the same cookies
8. `getSession()` returns session → `isAuthenticated = true`
9. Dashboard renders with correct role from `user.user_metadata.role`
