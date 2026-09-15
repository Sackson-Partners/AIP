# QUICK FIX: Update Database Credentials

**Status:** 🚨 CRITICAL - DO THIS NOW  
**Time Required:** 5-10 minutes  
**Impact:** Fixes all authentication

---

## THE PROBLEM

```
❌ Database error: Authentication failed against database server,
   the provided database credentials for `sackson` are not valid.
```

**Result:** Nobody can login - all authentication methods broken.

---

## THE FIX (3 STEPS)

### Step 1: Get Correct Database Credentials

You need the PostgreSQL connection string:
```
postgresql://[USERNAME]:[PASSWORD]@[HOST]:5432/[DATABASE]?schema=public&sslmode=require
```

**Where to find it:**
- Azure Portal → PostgreSQL server → Connection strings
- Password manager
- Team documentation
- .env file (local development)

**Example:**
```
postgresql://aip_admin:MySecurePassword123@aip-production.postgres.database.azure.com:5432/aip_db?schema=public&sslmode=require
```

---

### Step 2: Update in Vercel (Choose One Method)

#### METHOD A: Vercel Dashboard (Easiest - 2 minutes)

1. Go to: https://vercel.com/sacksons-projects/aip/settings/environment-variables

2. Find `DATABASE_URL` in the list

3. Click "Edit" (pencil icon)

4. Paste the new connection string

5. **IMPORTANT:** Select "Production" environment only

6. Click "Save"

#### METHOD B: Vercel CLI (3 minutes)

```bash
# Remove old variable
vercel env rm DATABASE_URL production

# Add new variable
vercel env add DATABASE_URL production

# When prompted, paste your connection string:
# postgresql://USER:PASS@HOST:5432/DB?schema=public&sslmode=require
```

---

### Step 3: Deploy

```bash
# Deploy to production
vercel --prod --yes

# Wait 1-2 minutes for build
# Test: https://app.africa-infra.com/auth/signin
```

---

## TEST IT WORKS

After deployment:

1. **Test login page:**
   ```
   https://app.africa-infra.com/auth/signin
   ```

2. **Try staff login:**
   - Enter email + password
   - Should login successfully ✅

3. **Try request invitation:**
   - Click "Request an Invitation" button
   - Should show form (not redirect) ✅

4. **Check logs:**
   ```bash
   vercel logs --prod --since 1m
   ```
   Should NOT see database authentication errors ✅

---

## COMMON MISTAKES

### ❌ Wrong Format:
```
# Missing sslmode
postgresql://user:pass@host:5432/db

# Should be:
postgresql://user:pass@host:5432/db?schema=public&sslmode=require
```

### ❌ Special Characters Not Encoded:
```
# Password has @ symbol
PASSWORD: Pass@word123

# Must encode the @:
postgresql://user:Pass%40word123@host:5432/db?schema=public&sslmode=require
```

### ❌ Wrong Environment:
- Make sure you update **Production** environment
- NOT Preview or Development

---

## URL ENCODING TABLE

If password has special characters, encode them:

| Character | Encoded |
|-----------|---------|
| @         | %40     |
| :         | %3A     |
| /         | %2F     |
| ?         | %3F     |
| #         | %23     |
| [         | %5B     |
| ]         | %5D     |
| !         | %21     |
| $         | %24     |
| &         | %26     |
| '         | %27     |
| (         | %28     |
| )         | %29     |
| *         | %2A     |
| +         | %2B     |
| ,         | %2C     |
| ;         | %3B     |
| =         | %3D     |

**Example:**
- Password: `My$ecure@Pass!`
- Encoded: `My%24ecure%40Pass%21`

---

## VERIFY DATABASE URL LOCALLY (Optional)

```bash
# Test connection
export DATABASE_URL="postgresql://..."
npx prisma db execute --stdin <<< "SELECT 1"

# If success:
✓ Query executed successfully

# If fail:
Error: P1001: Can't reach database server
Error: P1011: Authentication failed
```

---

## WHAT HAPPENS AFTER FIX

1. Database connection restored ✅
2. Users can query database ✅
3. Authentication works ✅
4. Staff login works ✅
5. Partner login works ✅
6. Microsoft login works ✅
7. Request invitation works ✅

---

## IF STILL NOT WORKING

### Check Azure PostgreSQL:

1. Go to: https://portal.azure.com
2. Find your PostgreSQL server
3. Check:
   - Server is running
   - Firewall allows Vercel IPs
   - SSL enforcement is enabled
   - User exists with correct permissions

### Allow Vercel IPs:

In Azure PostgreSQL Firewall rules, add:
```
Name: Vercel
Start IP: 0.0.0.0
End IP: 255.255.255.255
```

(Temporary - tighten after testing)

---

## TIMELINE

| Step | Time | Description |
|------|------|-------------|
| 1 | 1 min | Get database connection string |
| 2 | 2 min | Update in Vercel dashboard |
| 3 | 2-3 min | Deploy to production |
| 4 | 1 min | Test authentication |
| **Total** | **6-7 min** | **Back online** |

---

## NEED HELP?

**Can't find credentials?**
- Check Azure Portal → PostgreSQL → Connection strings
- Check password manager (1Password, LastPass, etc.)
- Check local `.env` file
- Ask team member with Azure access

**Can't access Vercel?**
- Need owner/admin access to Vercel team
- Alternative: Give credentials to someone with access

**Don't have Azure access?**
- Need Azure portal access to PostgreSQL service
- Alternative: Ask DevOps/infrastructure team

---

## PREVENTION

**To avoid this in future:**

1. **Document credentials** in secure password manager
2. **Set rotation reminder** (e.g., every 90 days)
3. **Keep staging + production in sync**
4. **Add database health monitoring**
5. **Test after any credential changes**

---

**DO THIS NOW - 5 MINUTE FIX - RESTORES ALL AUTHENTICATION**

Once DATABASE_URL is updated in Vercel and deployed, everything will work.
