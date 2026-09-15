# EMERGENCY MANUAL DEPLOYMENT

**Date:** September 15, 2026  
**Status:** 🚨 CRITICAL - CI/CD Pipeline Broken, Need Manual Deploy  
**Issue:** GitHub Actions failing, authentication fixes not deployed

---

## CRITICAL SITUATION

1. ✅ Fixes committed to GitHub (commits 2b20733, 643ef4e)
2. ❌ GitHub Actions pipeline FAILING (all recent runs failed)
3. ❌ Fixes NOT deployed to Azure Container Apps
4. ❌ Production still broken (old code running)

**Result:** Users still cannot authenticate because fixes aren't deployed!

---

## WHY DEPLOYMENTS FAILING

GitHub Actions requires secrets that aren't configured:
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `AZURE_AD_CLIENT_ID`
- `AZURE_AD_CLIENT_SECRET`
- `AZURE_AD_TENANT_ID`
- `DATABASE_URL`
- `NEXT_PUBLIC_API_URL`

**Location to check:** https://github.com/Sackson-Partners/AIP/settings/secrets/actions

---

## IMMEDIATE SOLUTION: MANUAL DEPLOYMENT

###Option 1: Manual GitHub Actions Trigger (FASTEST - 2 minutes)

**Step 1: Go to GitHub Actions**
```
https://github.com/Sackson-Partners/AIP/actions/workflows/deploy.yml
```

**Step 2: Click "Run workflow"**
- Branch: `main`
- Image tag: leave blank (fresh build)
- Click green "Run workflow" button

**Step 3: Monitor deployment**
- Watch the workflow run
- Wait ~5 minutes for build + deploy
- Check health endpoint after

---

### Option 2: Azure CLI Deploy (5 minutes)

**Prerequisites:**
- Azure CLI installed: `az --version`
- Logged in: `az login`

**Deploy Script:**
```bash
# Set variables
ACR_NAME=aipapiregistry
IMAGE_NAME=aip-api
CONTAINER_APP=aip-api
RESOURCE_GROUP=AIP-RG
TAG="hotfix-$(date +%m%d%H%M%S)"

# Build and push to Azure Container Registry
az acr build \
  --registry $ACR_NAME \
  --image $IMAGE_NAME:$TAG \
  --image $IMAGE_NAME:latest \
  --file Dockerfile \
  .

# Deploy to Container Apps
az containerapp update \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --image ${ACR_NAME}.azurecr.io/$IMAGE_NAME:$TAG

# Check health
sleep 60
FQDN=$(az containerapp show \
  --name $CONTAINER_APP \
  --resource-group $RESOURCE_GROUP \
  --query "properties.configuration.ingress.fqdn" -o tsv)

curl -sf "https://${FQDN}/api/health" && echo "✅ Deployment successful!"
```

---

### Option 3: Azure Portal Manual Deploy (10 minutes)

**Step 1: Build Docker Image Locally**
```bash
# From AIP-1 directory
docker build -t aip-api:hotfix .
```

**Step 2: Push to Azure Container Registry**
```bash
# Login to ACR
az acr login --name aipapiregistry

# Tag image
docker tag aip-api:hotfix aipapiregistry.azurecr.io/aip-api:hotfix

# Push
docker push aipapiregistry.azurecr.io/aip-api:hotfix
```

**Step 3: Update Container App via Portal**
1. Go to: https://portal.azure.com
2. Navigate to: Container Apps → aip-api
3. Click "Containers" in left menu
4. Click "Edit and deploy"
5. Click "Container image" tab
6. Change image to: `aipapiregistry.azurecr.io/aip-api:hotfix`
7. Click "Create" (creates new revision)
8. Wait 2-3 minutes for deployment

---

## VERIFY DEPLOYMENT

**Check which version is running:**
```bash
# Get current image
az containerapp show \
  --name aip-api \
  --resource-group AIP-RG \
  --query "properties.template.containers[0].image" -o tsv
```

**Check if authentication works:**
```bash
curl -s https://app.africa-infra.com/api/auth/providers | jq .
```

Should show both providers:
- `azure-ad`
- `internal-credentials`

---

## FIX GITHUB ACTIONS (Long-term)

**Add Required Secrets:**

Go to: https://github.com/Sackson-Partners/AIP/settings/secrets/actions

**Click "New repository secret" for each:**

```bash
# NextAuth Configuration
NEXTAUTH_URL=https://app.africa-infra.com
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>

# Azure AD OAuth
AZURE_AD_CLIENT_ID=<your-azure-client-id>
AZURE_AD_CLIENT_SECRET=<your-azure-client-secret>
AZURE_AD_TENANT_ID=<your-azure-tenant-id>

# Database
DATABASE_URL=<your-postgresql-connection-string>

# API Configuration
NEXT_PUBLIC_API_URL=https://app.africa-infra.com/api

# Optional - Sentry
NEXT_PUBLIC_SENTRY_DSN=<sentry-dsn>
SENTRY_ORG=<sentry-org>
SENTRY_PROJECT=<sentry-project>
SENTRY_AUTH_TOKEN=<sentry-token>

# Azure Deployment (already configured)
AZURE_CREDENTIALS=<azure-service-principal-json>
```

---

## DOCKERFILE CHECK

**Verify Dockerfile exists and is correct:**
```bash
ls -la Dockerfile
```

If missing, the CI/CD cannot build. Check if it's named differently:
```bash
find . -name "*Dockerfile*" -type f
```

---

## ENVIRONMENT VARIABLES IN AZURE

**Container App must have these environment variables set:**

```bash
# Check current env vars
az containerapp show \
  --name aip-api \
  --resource-group AIP-RG \
  --query "properties.template.containers[0].env" -o table
```

**Required environment variables in Azure Container App:**
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `DATABASE_URL`
- `AZURE_AD_CLIENT_ID`
- `AZURE_AD_CLIENT_SECRET`
- `AZURE_AD_TENANT_ID`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

**Set environment variables:**
```bash
az containerapp update \
  --name aip-api \
  --resource-group AIP-RG \
  --set-env-vars \
    "NEXTAUTH_URL=https://app.africa-infra.com" \
    "NEXTAUTH_SECRET=<your-secret>" \
    "DATABASE_URL=<your-db-url>"
```

---

## TROUBLESHOOTING

### Issue: "az: command not found"
**Solution:** Install Azure CLI
```bash
# macOS
brew install azure-cli

# Windows
choco install azure-cli

# Linux
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

### Issue: "docker: command not found"
**Solution:** Install Docker Desktop
- Download: https://www.docker.com/products/docker-desktop

### Issue: "Access denied to ACR"
**Solution:** Login to Azure Container Registry
```bash
az acr login --name aipapiregistry
```

### Issue: "Dockerfile not found"
**Solution:** Check if Dockerfile exists in project root
```bash
pwd  # Should be in AIP-1 directory
ls Dockerfile  # Should exist
```

---

## RECOMMENDED APPROACH

**For IMMEDIATE fix (RIGHT NOW):**
1. Use **Option 1: Manual GitHub Actions** (if you have access)
2. OR use **Option 2: Azure CLI Deploy** (if you have Azure CLI)

**For LONG-TERM fix (After emergency):**
1. Add all required secrets to GitHub
2. Test GitHub Actions workflow
3. Future deployments will be automatic

---

## EXPECTED TIMELINE

| Method | Time | Prerequisites |
|--------|------|---------------|
| Manual GitHub Actions | 2 min | GitHub access |
| Azure CLI Deploy | 5 min | Azure CLI installed + logged in |
| Azure Portal Deploy | 10 min | Docker installed + Azure portal access |

---

## VERIFICATION CHECKLIST

After deployment:

- [ ] Check image version in Azure Container App
- [ ] Test: `curl https://app.africa-infra.com/api/auth/providers`
- [ ] Test staff login
- [ ] Test partner login
- [ ] Test invitation form
- [ ] Confirm authentication working

---

**STATUS:** ⏳ AWAITING MANUAL DEPLOYMENT  
**PRIORITY:** P0 - CRITICAL  
**ACTION REQUIRED:** Choose one of 3 deployment options above
