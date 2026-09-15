# Azure AD Redirect URI Configuration Guide

**Date:** September 14, 2026  
**Issue:** AADSTS50011 - Redirect URI mismatch  
**Status:** 🔧 CONFIGURATION REQUIRED

---

## PROBLEM

**Error Message:**
```
AADSTS50011: The redirect URI 'https://aip-hbt3jyowx-sacksons-projects.vercel.app/api/auth/callback/azure-ad' 
specified in the request does not match the redirect URIs configured for the application.
```

**What This Means:**
- Vercel created a preview deployment with a new URL
- This URL is not registered in Azure AD
- Azure AD refuses to redirect after authentication
- This is a **security feature**, not a bug

---

## QUICK FIX (5 Minutes) - For Current Preview

### Step 1: Access Azure Portal
1. Go to: https://portal.azure.com
2. Sign in with admin credentials

### Step 2: Find Your App
1. Search for **"App registrations"** (top search bar)
2. Click **"App registrations"**
3. Click **"All applications"** tab
4. Find app with ID: `bc17ac23-d8a8-439e-81ca-9685ddb7e77b`
5. Click on the application name

### Step 3: Add Redirect URI
1. In left sidebar, click **"Authentication"**
2. Under **"Platform configurations"** → **"Web"** section
3. Click **"Add URI"** button
4. Paste this exact URL:
   ```
   https://aip-hbt3jyowx-sacksons-projects.vercel.app/api/auth/callback/azure-ad
   ```
5. Scroll down and click **"Save"**

### Step 4: Wait & Test
1. Wait 1-2 minutes for Azure AD to propagate changes
2. Go to your preview URL: https://aip-hbt3jyowx-sacksons-projects.vercel.app/auth/signin
3. Click "Continue with Microsoft"
4. Should work now ✅

---

## PERMANENT SOLUTION (Recommended)

### Problem with Preview URLs
- Vercel generates a **NEW preview URL for EVERY deployment**
- Format: `https://aip-<random>-sacksons-projects.vercel.app`
- You'd need to add each one to Azure AD (unsustainable)

### Solution: Use Production Domain Only

**Step 1: Configure Azure AD for Production**

Add these redirect URIs to Azure AD:
```
https://app.africa-infra.com/api/auth/callback/azure-ad
https://www.africa-infra.com/api/auth/callback/azure-ad
http://localhost:3000/api/auth/callback/azure-ad (for local dev)
```

**Step 2: Remove Preview URLs**

In Azure AD App Registration → Authentication:
- Remove any Vercel preview URLs (aip-*.vercel.app)
- Keep only production and localhost

**Step 3: Test Authentication Only in Production**

- Disable Microsoft sign-in testing in preview deployments
- Test credentials/staff login in preview (these don't need Azure AD)
- Test Microsoft sign-in only in production after merging to main

---

## ALTERNATIVE SOLUTIONS

### Option A: Wildcard Redirect URI (If Supported)

**Check if your Azure AD plan supports wildcards:**
```
https://*.vercel.app/api/auth/callback/azure-ad
```

**How to Check:**
1. Azure Portal → App registrations → Your app → Authentication
2. Try adding the wildcard URI above
3. If it saves without error → you have wildcard support ✅
4. If it shows an error → wildcards not supported ❌

**Note:** Most Azure AD free/basic plans do NOT support wildcards.

---

### Option B: Separate Azure AD Apps (Advanced)

Create two separate Azure AD applications:

**1. Production App**
- Name: `AIP Platform - Production`
- Redirect URI: `https://app.africa-infra.com/api/auth/callback/azure-ad`
- Use in: Production environment

**2. Preview/Dev App**
- Name: `AIP Platform - Preview`
- Redirect URIs: All preview URLs (add as needed) + localhost
- Use in: Preview deployments

**Vercel Environment Variables:**
```bash
# Production Environment
AZURE_AD_CLIENT_ID=<production-app-id>
AZURE_AD_CLIENT_SECRET=<production-secret>
AZURE_AD_TENANT_ID=<tenant-id>

# Preview Environment (different values)
AZURE_AD_CLIENT_ID=<preview-app-id>
AZURE_AD_CLIENT_SECRET=<preview-secret>
AZURE_AD_TENANT_ID=<tenant-id>
```

**Benefits:**
- Separate security boundaries
- Easy to add preview URLs without affecting production
- Can disable preview app without affecting users

**Drawbacks:**
- More maintenance (2 apps to manage)
- Need to configure both in Azure AD

---

### Option C: Disable Azure AD in Preview (Simplest)

**In your code** (`src/lib/auth/auth.config.ts`):

```typescript
providers: [
  // Only enable Azure AD in production
  ...(process.env.NODE_ENV === 'production' && 
      process.env.AZURE_AD_CLIENT_ID && 
      process.env.AZURE_AD_CLIENT_SECRET
    ? [
        AzureADProvider({
          clientId: process.env.AZURE_AD_CLIENT_ID,
          clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
          tenantId: process.env.AZURE_AD_TENANT_ID,
          // ... rest of config
        }),
      ]
    : []),
  
  // Credentials provider always available
  CredentialsProvider({
    // ... config
  }),
],
```

**Then:**
- Preview deployments won't show "Continue with Microsoft" button
- Staff/partner credentials login still works
- Test Microsoft login only in production

---

## CURRENT CONFIGURATION

### Your Azure AD App
- **Application (client) ID:** `bc17ac23-d8a8-439e-81ca-9685ddb7e77b`
- **Tenant:** Common (multi-tenant)

### Current Redirect URIs (Need to Verify)
Check in Azure Portal → Authentication → Web platform:
```
✅ Should have:
- https://app.africa-infra.com/api/auth/callback/azure-ad
- http://localhost:3000/api/auth/callback/azure-ad

❌ Should NOT have (unless using Option B):
- https://*.vercel.app/api/auth/callback/azure-ad (preview URLs)
```

### Vercel Deployments
- **Production:** https://app.africa-infra.com
- **Preview:** https://aip-<random>-sacksons-projects.vercel.app (changes every deploy)

---

## VERIFICATION CHECKLIST

After configuring Azure AD:

### 1. Check Azure AD Redirect URIs
- [ ] Production URL added
- [ ] Localhost added (for development)
- [ ] Preview URLs removed (or separate app created)

### 2. Test Production Sign-In
- [ ] Visit: https://app.africa-infra.com/auth/signin
- [ ] Click "Continue with Microsoft"
- [ ] Sign in with Microsoft account
- [ ] Successfully redirected to dashboard

### 3. Test Local Development
- [ ] Run: `npm run dev`
- [ ] Visit: http://localhost:3000/auth/signin
- [ ] Click "Continue with Microsoft"
- [ ] Sign in works locally

### 4. Test Preview (If Enabled)
- [ ] Visit preview URL
- [ ] If Azure AD configured: Microsoft sign-in works
- [ ] If Azure AD disabled: Only credentials login available

---

## TROUBLESHOOTING

### Error: "redirect_uri_mismatch" persists
**Solution:** Wait 2-5 minutes after saving in Azure AD. Changes take time to propagate.

### Error: "unauthorized_client"
**Solution:** Check that AZURE_AD_CLIENT_ID and AZURE_AD_CLIENT_SECRET are correct in Vercel environment variables.

### Error: "invalid_client"
**Solution:** Azure AD client secret may have expired. Generate new secret in Azure Portal.

### Preview deployments show no Microsoft option
**Solution:** This is expected if Azure AD is disabled in preview. Use credentials login for testing.

---

## SECURITY BEST PRACTICES

### 1. Principle of Least Redirect URIs
- Only add redirect URIs you actually use
- Remove old/unused preview URLs
- Regularly audit registered URIs

### 2. Production vs Preview Separation
- Use separate Azure AD apps for production and preview
- Different client IDs/secrets
- Easier to revoke access if needed

### 3. Client Secret Rotation
- Rotate Azure AD client secrets every 6 months
- Create new secret before old one expires
- Update Vercel environment variables
- Delete old secret after confirming new one works

### 4. Monitor Authentication Events
- Azure AD → Monitoring → Sign-in logs
- Check for failed authentications
- Review unusual activity

---

## RECOMMENDED APPROACH

**For your use case (AIP Platform):**

✅ **Use Option A: Production Only**

**Why:**
- Simplest to maintain
- Most secure (fewest redirect URIs)
- Preview deployments can test with credentials login
- Microsoft sign-in tested in production after merge

**Steps:**
1. Configure Azure AD with production URL only
2. Remove all preview URLs from Azure AD
3. Test Microsoft sign-in only in production
4. Use credentials login for preview testing

**Benefits:**
- No maintenance overhead
- Clear security boundary
- Simple authentication testing workflow

---

## NEXT STEPS

1. **Immediate:**
   - Add current preview URL to Azure AD (5 min quick fix)
   - Test that authentication works

2. **Short-term (This Week):**
   - Clean up Azure AD redirect URIs
   - Remove old preview URLs
   - Document which URLs should be registered

3. **Long-term (This Month):**
   - Consider separate Azure AD app for preview
   - Implement client secret rotation schedule
   - Set up authentication monitoring

---

## DOCUMENTATION REFERENCES

- **Azure AD App Registrations:** https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/RegisteredApps
- **Redirect URI Docs:** https://aka.ms/redirectUriMismatchError
- **NextAuth Azure AD Provider:** https://next-auth.js.org/providers/azure-ad

---

**Status:** 🔧 AWAITING AZURE AD CONFIGURATION  
**Priority:** HIGH (blocks Microsoft sign-in)  
**Owner:** Azure AD Administrator  
**ETA:** 5 minutes (manual Azure portal configuration)
