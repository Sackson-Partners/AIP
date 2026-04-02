# Domain Setup — africa-infra.com

## Current State

The domain `africa-infra.com` / `www.africa-infra.com` is **not yet configured** on Vercel or Azure. This document covers the full setup.

---

## 1. Vercel — Frontend (www.africa-infra.com)

### Add domain
1. Go to **Vercel Dashboard → Your Project → Settings → Domains**
2. Add `africa-infra.com` and `www.africa-infra.com`
3. Vercel will show the required DNS records

### DNS records to add (at your registrar)
| Type  | Name | Value                        |
|-------|------|------------------------------|
| A     | @    | `76.76.21.21`                |
| CNAME | www  | `cname.vercel-dns.com`       |

> Vercel auto-provisions SSL via Let's Encrypt once DNS propagates (~5 min to 48h).

### Supabase — update redirect URLs
After adding the domain, update Supabase Auth settings:

1. **Auth → URL Configuration → Site URL**: `https://www.africa-infra.com`
2. **Auth → URL Configuration → Redirect URLs** — add:
   - `https://www.africa-infra.com/auth/callback`
   - `https://africa-infra.com/auth/callback`
3. **Auth → Email Templates → Confirm signup** — ensure confirm URL uses:
   ```
   {{ .SiteURL }}/auth/callback?code={{ .Code }}
   ```

### Vercel environment variables
In **Vercel Dashboard → Settings → Environment Variables**, confirm `NEXT_PUBLIC_API_URL` points to the API domain (e.g. `https://api.africa-infra.com`).

---

## 2. Azure — API (api.africa-infra.com)

### Add custom domain to Container App
```bash
# Get the Container App's default ingress domain
az containerapp show \
  --name aip-api \
  --resource-group AIP-RG \
  --query "properties.configuration.ingress.fqdn" \
  -o tsv

# Add custom domain (replace with actual values)
az containerapp hostname add \
  --name aip-api \
  --resource-group AIP-RG \
  --hostname api.africa-infra.com
```

### DNS record for API
| Type  | Name | Value                                          |
|-------|------|------------------------------------------------|
| CNAME | api  | `<your-containerapp>.azurecontainerapps.io`    |

### Bind managed certificate (free SSL)
```bash
az containerapp hostname bind \
  --name aip-api \
  --resource-group AIP-RG \
  --hostname api.africa-infra.com \
  --environment aip-env \
  --validation-method CNAME
```

> Azure issues a free managed certificate once the CNAME is verified.

---

## 3. CORS Update

After adding the custom domain, update the FastAPI backend CORS settings to allow the new origin:

In your FastAPI `main.py` (or wherever CORS is configured), ensure `https://www.africa-infra.com` and `https://africa-infra.com` are in `allow_origins`.

This can also be set as an environment variable in Azure Container Apps:
```bash
az containerapp update \
  --name aip-api \
  --resource-group AIP-RG \
  --set-env-vars CORS_ORIGINS="https://www.app.africa-infra.com,https://www.africa-infra.com,https://africa-infra.com,https://www.africa-infra.com"
```

---

## 4. Verification Checklist

- [ ] `https://www.africa-infra.com` loads the frontend
- [ ] `https://africa-infra.com` redirects to `www.africa-infra.com`
- [ ] `https://api.africa-infra.com/health` returns `{"status":"ok"}`
- [ ] Email confirmation links use `www.africa-infra.com/auth/callback`
- [ ] SSL certificates are valid (green padlock) on both domains
- [ ] Login and registration work end-to-end on the custom domain
