# GitHub Secrets & CI/CD Setup

Add all secrets at:
**https://github.com/Sackson-Partners/AIP/settings/secrets/actions**

---

## Required Secrets

### Docker Hub
| Secret | Description |
|--------|-------------|
| `DOCKERHUB_USERNAME` | `sacksons` |
| `DOCKERHUB_TOKEN` | Access token (not password) → hub.docker.com → Account Settings → Security → New Access Token |

### Azure
| Secret | Description |
|--------|-------------|
| `AZURE_CREDENTIALS` | Service principal JSON — see creation steps below |

### Supabase
| Secret | Description |
|--------|-------------|
| `SUPABASE_URL` | `https://evpbetmgmhwhhhgwvnfb.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase project → Settings → API → anon public key |

### Emergency ACR deploy (`deploy.yml` manual workflow)
| Secret | Description |
|--------|-------------|
| `AIPBACKENDCONTAINER_AZURE_CLIENT_ID` | App registration client ID |
| `AIPBACKENDCONTAINER_AZURE_TENANT_ID` | Azure tenant ID |
| `AIPBACKENDCONTAINER_AZURE_SUBSCRIPTION_ID` | `e919967a-c8ff-4896-977b-360167fa1a84` |
| `AIPBACKENDCONTAINER_REGISTRY_USERNAME` | Docker Hub username |
| `AIPBACKENDCONTAINER_REGISTRY_PASSWORD` | Docker Hub access token |

---

## Creating AZURE_CREDENTIALS

Run once in Azure CLI (requires Contributor on the resource group):

```bash
az ad sp create-for-rbac \
  --name "AIP-GitHub-Actions" \
  --role "Contributor" \
  --scopes "/subscriptions/e919967a-c8ff-4896-977b-360167fa1a84/resourceGroups/AIP-RG" \
  --sdk-auth
```

Copy the **entire JSON output** and paste it as the `AZURE_CREDENTIALS` secret value.

---

## GitHub Environment (production gate)

The deploy job uses the `production` environment.
Create it at: **https://github.com/Sackson-Partners/AIP/settings/environments**

Recommended protection rules:
- Required reviewers: 1 (optional, for extra safety)
- Deployment branches: `main` only

---

## Workflow Summary

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `ci-cd.yml` | Push to `main`, PRs | TypeScript check → backend test → Docker Hub push → Azure deploy → health check → rollback on failure |
| `deploy.yml` | Manual only | Emergency ACR build + deploy (bypasses Docker Hub) |
| `aip-backend-container-AutoDeployTrigger-*.yml` | Push to `main` (backend paths) | Azure-generated: builds and deploys to `aip-backend-container` |

---

## Vercel (frontend — no secrets needed here)

Vercel auto-deploys on push to `main`. Set these env vars in the Vercel dashboard:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://aip-api.politesea-b4c1d412.southafricanorth.azurecontainerapps.io` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://evpbetmgmhwhhhgwvnfb.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

Dashboard: **https://vercel.com/dashboard** → aip project → Settings → Environment Variables
