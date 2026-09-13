# Comprehensive Health Check Endpoint

**Date:** 2026-09-11  
**Feature:** Task #14 - Comprehensive Health Check Endpoint  
**Impact:** 🩺 Production monitoring, uptime tracking, incident detection

---

## Overview

The health check endpoint (`/api/health`) provides comprehensive system status monitoring for:
- **Uptime monitoring** (UptimeRobot, Pingdom, StatusPage)
- **Infrastructure monitoring** (DataDog, New Relic)
- **Incident detection** (PagerDuty, Opsgenie)
- **Deployment validation** (CI/CD pipelines)

---

## Endpoint

### GET /api/health

**Response Codes:**
- `200` - All systems healthy or degraded (non-critical services down)
- `503` - Critical services unhealthy (database, authentication)

**Response Format:**
```json
{
  "status": "healthy",
  "timestamp": "2026-09-11T10:30:00.000Z",
  "version": "1.0.0",
  "checks": [
    {
      "service": "database",
      "status": "healthy",
      "latency": 45,
      "details": {
        "connected": true,
        "latencyMs": 45,
        "userCount": 152,
        "provider": "PostgreSQL"
      }
    },
    {
      "service": "redis",
      "status": "healthy",
      "latency": 12,
      "details": {
        "available": true,
        "operational": "operational",
        "optional": true,
        "provider": "Upstash Redis"
      }
    }
  ],
  "summary": {
    "total": 7,
    "healthy": 6,
    "degraded": 1,
    "unhealthy": 0
  }
}
```

---

## Health Checks

### 1. Database (CRITICAL)

**What it checks:**
- PostgreSQL connection
- Query execution latency
- Ability to count users (table access)

**Status Thresholds:**
- `healthy`: < 1000ms latency
- `degraded`: 1000-2000ms latency
- `unhealthy`: Connection failed or > 2000ms

**Example Response:**
```json
{
  "service": "database",
  "status": "healthy",
  "latency": 45,
  "details": {
    "connected": true,
    "latencyMs": 45,
    "userCount": 152,
    "provider": "PostgreSQL"
  }
}
```

**Unhealthy Response:**
```json
{
  "service": "database",
  "status": "unhealthy",
  "error": "Connection timeout",
  "details": {
    "connected": false
  }
}
```

---

### 2. Redis Cache (OPTIONAL)

**What it checks:**
- Redis connection availability
- SET/GET operation functionality
- Read/write latency

**Status Thresholds:**
- `healthy`: Connected and operations successful
- `degraded`: Connection failed or operations failed (optional service)
- `unhealthy`: Never returns unhealthy (optional service)

**Example Response:**
```json
{
  "service": "redis",
  "status": "healthy",
  "latency": 12,
  "details": {
    "available": true,
    "operational": "operational",
    "optional": true,
    "provider": "Upstash Redis"
  }
}
```

**Test Operations:**
```typescript
// Health check performs actual Redis operation
await redis.set('health:test', 'ok', { ex: 10 })
const testValue = await redis.get('health:test')
// operational status: 'operational' | 'read_failed' | 'operation_failed'
```

---

### 3. Email Service

**What it checks:**
- Resend API key configured
- Email FROM address configured

**Status Thresholds:**
- `healthy`: Both API key and FROM address configured
- `degraded`: Missing configuration (email won't work)

**Example Response:**
```json
{
  "service": "email",
  "status": "healthy",
  "details": {
    "provider": "Resend",
    "apiKeyConfigured": true,
    "fromAddressConfigured": true,
    "optional": false
  }
}
```

**Configuration Required:**
```bash
RESEND_API_KEY=re_xxx
EMAIL_FROM=noreply@africa-infra.com
```

---

### 4. Authentication (CRITICAL)

**What it checks:**
- NextAuth secret and URL configured
- Azure AD OAuth credentials configured

**Status Thresholds:**
- `healthy`: NextAuth configured
- `unhealthy`: NextAuth not configured (auth won't work)

**Example Response:**
```json
{
  "service": "authentication",
  "status": "healthy",
  "details": {
    "nextAuthConfigured": true,
    "azureAdConfigured": true,
    "providers": ["credentials", "azure-ad"]
  }
}
```

**Configuration Required:**
```bash
# Core (required)
NEXTAUTH_SECRET=xxx
NEXTAUTH_URL=https://app.africa-infra.com

# Azure AD (optional)
AZURE_AD_CLIENT_ID=xxx
AZURE_AD_CLIENT_SECRET=xxx
AZURE_AD_TENANT_ID=xxx
```

---

### 5. AI Services (OPTIONAL)

**What it checks:**
- Anthropic API key configured
- OpenAI API key configured

**Status Thresholds:**
- `healthy`: At least one provider configured
- `degraded`: No providers configured

**Example Response:**
```json
{
  "service": "ai",
  "status": "healthy",
  "details": {
    "anthropic": "configured",
    "openai": "not_configured",
    "optional": true
  }
}
```

**Configuration:**
```bash
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-proj-xxx
```

---

### 6. Storage (OPTIONAL)

**What it checks:**
- Azure Blob Storage credentials configured

**Status Thresholds:**
- `healthy`: Credentials configured
- `degraded`: Not configured (file uploads won't work)

**Example Response:**
```json
{
  "service": "storage",
  "status": "healthy",
  "details": {
    "provider": "Azure Blob Storage",
    "configured": true,
    "optional": true
  }
}
```

**Configuration:**
```bash
# Option 1: Connection string
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;...

# Option 2: Account name + key
AZURE_STORAGE_ACCOUNT_NAME=aipstorageacct
AZURE_STORAGE_ACCOUNT_KEY=xxx
```

---

### 7. System Metrics

**What it reports:**
- Node.js version
- Process uptime
- Platform (linux, darwin, win32)
- Environment (production, development)
- Total health check latency

**Example Response:**
```json
{
  "service": "system",
  "status": "healthy",
  "latency": 156,
  "details": {
    "nodeVersion": "v20.11.0",
    "uptimeSeconds": 3600,
    "platform": "linux",
    "environment": "production",
    "totalCheckLatencyMs": 156
  }
}
```

---

## Overall Status Logic

### Status Hierarchy
```
unhealthy > degraded > healthy
```

### Rules
1. **Unhealthy**: Any critical service (database, authentication) is unhealthy → Overall: `unhealthy` (503)
2. **Degraded**: All critical services healthy, but optional services degraded → Overall: `degraded` (200)
3. **Healthy**: All services healthy → Overall: `healthy` (200)

---

## Use Cases

### 1. Uptime Monitoring (UptimeRobot, Pingdom)

**Configuration:**
```
URL: https://app.africa-infra.com/api/health
Method: GET
Expected Status: 200
Alert on: 503 status code
Check Interval: 60 seconds
```

**Alerting:**
- `503` response → Page on-call engineer
- `200` with `"status": "degraded"` → Warning notification

---

### 2. Load Balancer Health Check

**AWS Application Load Balancer:**
```yaml
HealthCheck:
  Path: /api/health
  Protocol: HTTPS
  Port: 443
  HealthyThreshold: 2
  UnhealthyThreshold: 3
  Timeout: 5
  Interval: 30
```

**Azure Load Balancer:**
```yaml
probes:
  - name: health-probe
    protocol: Https
    port: 443
    requestPath: /api/health
    intervalInSeconds: 15
    numberOfProbes: 2
```

---

### 3. CI/CD Deployment Validation

**GitHub Actions:**
```yaml
- name: Validate deployment
  run: |
    response=$(curl -s -o /dev/null -w "%{http_code}" https://app.africa-infra.com/api/health)
    if [ $response -eq 200 ]; then
      echo "Deployment healthy"
    else
      echo "Deployment failed health check: $response"
      exit 1
    fi
```

**Vercel Deployment Check:**
```bash
#!/bin/bash
# Wait for deployment to be healthy
for i in {1..30}; do
  status=$(curl -s https://app.africa-infra.com/api/health | jq -r '.status')
  if [ "$status" = "healthy" ]; then
    echo "✅ Deployment healthy"
    exit 0
  fi
  echo "⏳ Waiting for health check... ($i/30)"
  sleep 10
done
echo "❌ Deployment failed to become healthy"
exit 1
```

---

### 4. DataDog Monitoring

**Synthetic Monitor:**
```json
{
  "name": "AIP Platform Health Check",
  "type": "api",
  "subtype": "http",
  "config": {
    "request": {
      "method": "GET",
      "url": "https://app.africa-infra.com/api/health"
    },
    "assertions": [
      {
        "type": "statusCode",
        "operator": "is",
        "target": 200
      },
      {
        "type": "body",
        "operator": "validatesJSONPath",
        "target": {
          "jsonPath": "status",
          "operator": "is",
          "targetValue": "healthy"
        }
      },
      {
        "type": "responseTime",
        "operator": "lessThan",
        "target": 2000
      }
    ]
  },
  "locations": ["aws:us-east-1", "aws:eu-west-1"],
  "options": {
    "tick_every": 60
  }
}
```

---

### 5. PagerDuty Integration

**Alert Webhook:**
```bash
#!/bin/bash
# Check health and alert PagerDuty on failure

health=$(curl -s https://app.africa-infra.com/api/health)
status=$(echo $health | jq -r '.status')

if [ "$status" != "healthy" ]; then
  unhealthy=$(echo $health | jq -r '.summary.unhealthy')
  degraded=$(echo $health | jq -r '.summary.degraded')
  
  curl -X POST https://events.pagerduty.com/v2/enqueue \
    -H 'Content-Type: application/json' \
    -d "{
      \"routing_key\": \"$PAGERDUTY_KEY\",
      \"event_action\": \"trigger\",
      \"payload\": {
        \"summary\": \"AIP Platform health check failed\",
        \"severity\": \"critical\",
        \"source\": \"health-check\",
        \"custom_details\": {
          \"status\": \"$status\",
          \"unhealthy_services\": $unhealthy,
          \"degraded_services\": $degraded
        }
      }
    }"
fi
```

---

## Testing

### Test 1: All Services Healthy
```bash
curl -i https://app.africa-infra.com/api/health

# Expected:
# HTTP/2 200
# Content-Type: application/json
# {
#   "status": "healthy",
#   "checks": [...],
#   "summary": { "total": 7, "healthy": 7, "degraded": 0, "unhealthy": 0 }
# }
```

---

### Test 2: Database Unhealthy
```bash
# Simulate database failure by stopping PostgreSQL
docker stop postgres-container

curl -i https://app.africa-infra.com/api/health

# Expected:
# HTTP/2 503
# {
#   "status": "unhealthy",
#   "checks": [
#     {
#       "service": "database",
#       "status": "unhealthy",
#       "error": "Connection refused"
#     }
#   ],
#   "summary": { "unhealthy": 1 }
# }
```

---

### Test 3: Redis Degraded (Still Returns 200)
```bash
# Simulate Redis failure
# (Redis is optional, so overall status should be degraded, not unhealthy)

curl -i https://app.africa-infra.com/api/health

# Expected:
# HTTP/2 200
# {
#   "status": "degraded",
#   "checks": [
#     {
#       "service": "redis",
#       "status": "degraded",
#       "error": "Connection timeout",
#       "details": { "optional": true }
#     }
#   ],
#   "summary": { "healthy": 6, "degraded": 1, "unhealthy": 0 }
# }
```

---

### Test 4: Response Time Validation
```bash
# Measure health check latency
time curl -s https://app.africa-infra.com/api/health | jq '.checks[] | select(.service == "system") | .details.totalCheckLatencyMs'

# Expected: < 500ms for all checks combined
```

---

## Monitoring Best Practices

### 1. Cache-Control Headers
```typescript
// Health check returns no-cache headers
headers: {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
}
```

**Why:** Ensures monitoring tools always get fresh health status

---

### 2. Logging on Non-Healthy Status
```typescript
if (health.overall !== 'healthy') {
  logger.warn('Health check returned non-healthy status', {
    overall: health.overall,
    unhealthyServices: health.checks.filter(c => c.status === 'unhealthy').map(c => c.service),
    degradedServices: health.checks.filter(c => c.status === 'degraded').map(c => c.service),
  })
}
```

**Use Case:** Investigate incidents by searching logs for health check warnings

---

### 3. Check Interval Recommendations
```
Production:
- Uptime monitoring: 60 seconds
- Load balancer: 15-30 seconds
- Internal monitoring: 5 minutes

Staging:
- Uptime monitoring: 5 minutes
- Load balancer: 30 seconds
```

**Why:** Balance between quick failure detection and avoiding excessive load

---

### 4. Timeout Configuration
```
Recommended timeouts:
- Uptime monitor: 10 seconds
- Load balancer: 5 seconds
- CI/CD validation: 30 seconds
```

---

## Advanced Features

### Feature 1: Per-Service Latency Tracking
```json
{
  "checks": [
    {
      "service": "database",
      "latency": 45  // milliseconds
    },
    {
      "service": "redis",
      "latency": 12
    }
  ]
}
```

**Use Case:** Identify slow dependencies (e.g., database latency increasing)

---

### Feature 2: Detailed Error Messages
```json
{
  "service": "database",
  "status": "unhealthy",
  "error": "Connection timeout after 5000ms",
  "details": { "connected": false }
}
```

**Use Case:** Debug incidents without accessing logs

---

### Feature 3: Service Dependency Graph
```
Critical (unhealthy = 503):
- database
- authentication

Optional (unhealthy = 200 degraded):
- redis
- email
- ai
- storage
```

---

## Comparison with Alternatives

### Alternative 1: Simple Ping Endpoint
```typescript
// ❌ Too simple
export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
```

**Problems:**
- Doesn't check database
- Doesn't check Redis
- No detailed status
- Can't detect partial outages

---

### Alternative 2: Middleware Health Check
```typescript
// ❌ Blocks requests
export function middleware(req) {
  if (!isDatabaseConnected()) {
    return NextResponse.json({ error: 'Unhealthy' }, { status: 503 })
  }
}
```

**Problems:**
- Adds latency to every request
- No dedicated endpoint for monitoring

---

### Our Solution ✅
- **Comprehensive checks** (database, Redis, config, system)
- **Detailed status** per service
- **Proper status codes** (503 for critical failures)
- **Latency tracking** for performance monitoring
- **No caching** for fresh status
- **Optional services** don't cause 503

---

## Summary

Comprehensive health check endpoint provides **production-grade monitoring** for infrastructure and services.

**Key Features:**
- ✅ 7 health checks (database, Redis, email, auth, AI, storage, system)
- ✅ Critical vs. optional service classification
- ✅ Per-service latency tracking
- ✅ Detailed error messages
- ✅ Proper HTTP status codes (200 vs. 503)
- ✅ No-cache headers for fresh status
- ✅ Logging for non-healthy status

**Monitoring Integration:**
- ✅ Uptime monitoring (UptimeRobot, Pingdom)
- ✅ Load balancer health checks (AWS ALB, Azure LB)
- ✅ CI/CD deployment validation (GitHub Actions, Vercel)
- ✅ Observability platforms (DataDog, New Relic)
- ✅ Incident management (PagerDuty, Opsgenie)

**Production Impact:**
- 🩺 Detect incidents before users report them
- 🩺 Validate deployments automatically
- 🩺 Monitor service degradation
- 🩺 Track infrastructure performance

---

**Last Updated:** 2026-09-11  
**Status:** ✅ COMPLETED  
**Task:** #14 - Comprehensive Health Check Endpoint
