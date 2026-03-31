#!/bin/bash

OUT="audit_output.txt"
> $OUT

log() { echo "$1" | tee -a $OUT; }

log "=========================================="
log "1. PROJECT STRUCTURE"
log "=========================================="
find src -type f $ -name "*.ts" -o -name "*.tsx" $ | sort | tee -a $OUT

log ""
log "=========================================="
log "2. PACKAGE.JSON"
log "=========================================="
cat package.json | tee -a $OUT

log ""
log "=========================================="
log "3. ENV VARIABLES"
log "=========================================="
cat .env.local 2>/dev/null | sed 's/=.*/=***/' >> $OUT || log "NO .env.local FOUND"
cat .env 2>/dev/null | sed 's/=.*/=***/' >> $OUT || log "NO .env FOUND"

log ""
log "=========================================="
log "4. SUPABASE LIB"
log "=========================================="
cat src/lib/supabase.ts 2>/dev/null | tee -a $OUT || log "NOT FOUND"

log ""
log "=========================================="
log "5. API LIB"
log "=========================================="
cat src/lib/api.ts 2>/dev/null | tee -a $OUT || log "NOT FOUND"

log ""
log "=========================================="
log "6. AIRTABLE LIB"
log "=========================================="
cat src/lib/api/airtable.ts 2>/dev/null | tee -a $OUT || log "NOT FOUND"

log ""
log "=========================================="
log "7. AUTH CONTEXT"
log "=========================================="
cat src/context/AuthContext.tsx 2>/dev/null | tee -a $OUT || log "NOT FOUND"

log ""
log "=========================================="
log "8. RBAC HOOK"
log "=========================================="
cat src/hooks/useRBAC.ts 2>/dev/null | tee -a $OUT || log "NOT FOUND"

log ""
log "=========================================="
log "9. MIDDLEWARE"
log "=========================================="
cat src/middleware.ts 2>/dev/null | tee -a $OUT || log "NO MIDDLEWARE FOUND"

log ""
log "=========================================="
log "10. APP LAYOUT"
log "=========================================="
cat src/app/layout.tsx 2>/dev/null | tee -a $OUT || log "NOT FOUND"

log ""
log "=========================================="
log "11. HOME PAGE"
log "=========================================="
cat src/app/page.tsx 2>/dev/null | tee -a $OUT || log "NOT FOUND"

log ""
log "=========================================="
log "12. LOGIN PAGE"
log "=========================================="
cat src/app/login/page.tsx 2>/dev/null | tee -a $OUT || log "NOT FOUND"

log ""
log "=========================================="
log "13. REGISTER PAGE"
log "=========================================="
cat src/app/register/page.tsx 2>/dev/null | tee -a $OUT || log "NOT FOUND"

log ""
log "=========================================="
log "14. DASHBOARD LAYOUT"
log "=========================================="
cat src/app/dashboard/layout.tsx 2>/dev/null | tee -a $OUT || log "NOT FOUND"

log ""
log "=========================================="
log "15. DASHBOARD HOME"
log "=========================================="
cat src/app/dashboard/page.tsx 2>/dev/null | tee -a $OUT || log "NOT FOUND"

log ""
log "=========================================="
log "16. ANALYTICS PAGE"
log "=========================================="
cat src/app/dashboard/analytics/page.tsx 2>/dev/null | tee -a $OUT || log "NOT FOUND"

log ""
log "=========================================="
log "17. DATA ROOMS PAGE"
log "=========================================="
cat src/app/dashboard/data-rooms/page.tsx 2>/dev/null | tee -a $OUT || log "NOT FOUND"

log ""
log "=========================================="
log "18. DEAL ROOMS PAGE"
log "=========================================="
cat src/app/dashboard/deal-rooms/page.tsx 2>/dev/null | tee -a $OUT || log "NOT FOUND"

log ""
log "=========================================="
log "19. DEAL ROOM [ID] PAGE"
log "=========================================="
cat "src/app/dashboard/deal-rooms/[id]/page.tsx" 2>/dev/null | tee -a $OUT || log "NOT FOUND"

log ""
log "=========================================="
log "20. EIN PAGE"
log "=========================================="
cat src/app/dashboard/ein/page.tsx 2>/dev/null | tee -a $OUT || log "NOT FOUND"

log ""
log "=========================================="
log "21. EVENTS PAGE"
log "=========================================="
cat src/app/dashboard/events/page.tsx 2>/dev/null | tee -a $OUT || log "NOT FOUND"

log ""
log "=========================================="
log "22. IC PAGE"
log "=========================================="
cat src/app/dashboard/ic/page.tsx 2>/dev/null | tee -a $OUT || log "NOT FOUND"

log ""
log "=========================================="
log "23. INTEGRATIONS PAGE"
log "=========================================="
cat src/app/dashboard/integrations/page.tsx 2>/dev/null | tee -a $OUT || log "NOT FOUND"

log ""
log "=========================================="
log "24. INVESTORS PAGE"
log "=========================================="
cat src/app/dashboard/investors/page.tsx 2>/dev/null | tee -a $OUT || log "NOT FOUND"

log ""
log "=========================================="
log "25. PETFEL PAGE"
log "=========================================="
cat src/app/dashboard/petfel/page.tsx 2>/dev/null | tee -a $OUT || log "NOT FOUND"

log ""
log "=========================================="
log "26. PIPELINE PAGE"
log "=========================================="
cat src/app/dashboard/pipeline/page.tsx 2>/dev/null | tee -a $OUT || log "NOT FOUND"

log ""
log "=========================================="
log "27. PIS PAGE"
log "=========================================="
cat src/app/dashboard/pis/page.tsx 2>/dev/null | tee -a $OUT || log "NOT FOUND"

log ""
log "=========================================="
log "28. PROJECTS PAGE"
log "=========================================="
cat src/app/dashboard/projects/page.tsx 2>/dev/null | tee -a $OUT || log "NOT FOUND"

log ""
log "=========================================="
log "29. USERS PAGE"
log "=========================================="
cat src/app/dashboard/users/page.tsx 2>/dev/null | tee -a $OUT || log "NOT FOUND"

log ""
log "=========================================="
log "30. VERIFICATIONS PAGE"
log "=========================================="
cat src/app/dashboard/verifications/page.tsx 2>/dev/null | tee -a $OUT || log "NOT FOUND"

log ""
log "=========================================="
log "31. SIDEBAR COMPONENT"
log "=========================================="
cat src/components/Sidebar.tsx 2>/dev/null | tee -a $OUT || log "NOT FOUND"

log ""
log "=========================================="
log "32. NEXT CONFIG"
log "=========================================="
cat next.config.ts 2>/dev/null | tee -a $OUT || cat next.config.js 2>/dev/null | tee -a $OUT || log "NO NEXT CONFIG"

log ""
log "=========================================="
log "33. TSCONFIG"
log "=========================================="
cat tsconfig.json 2>/dev/null | tee -a $OUT || log "NOT FOUND"

log ""
log "=========================================="
log "34. AZURE REFS CHECK"
log "=========================================="
AZURE=$(grep -r "AzureAuth\|azure-auth\|msal" src/ --include="*.ts" --include="*.tsx" 2>/dev/null)
if [ -z "$AZURE" ]; then
  log "NO AZURE REFS - CLEAN"
else
  log "AZURE REFS FOUND:"
  echo "$AZURE" | tee -a $OUT
fi

log ""
log "=========================================="
log "35. BROKEN IMPORT CHECK"
log "=========================================="
grep -rn "from.*\/api" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | tee -a $OUT

log ""
log "=========================================="
log "36. OLD API NAMING CHECK"
log "=========================================="
grep -rn "projectsApi\|investorsApi\|verificationsApi\|eventsApi" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | tee -a $OUT

log ""
log "=========================================="
log "37. API ENDPOINT TESTS"
log "=========================================="
BASE="https://aip-api.politesea-b4c1d412.southafricanorth.azurecontainerapps.io"

for endpoint in "/health" "/docs" "/api/projects" "/api/investors" "/api/events" "/api/pipeline/stages" "/api/analytics" "/api/users" "/api/verifications" "/api/data-rooms" "/api/deal-rooms" "/api/petfel" "/api/ein" "/api/ic" "/api/matching" "/api/radar"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE$endpoint" 2>/dev/null)
  log "  $endpoint → HTTP $STATUS"
done

log ""
log "=========================================="
log "38. TYPE CHECK"
log "=========================================="
npx tsc --noEmit 2>&1 | tee -a $OUT

log ""
log "=========================================="
log "39. BUILD TEST"
log "=========================================="
npm run build 2>&1 | tee -a $OUT

log ""
log "=========================================="
log "AUDIT COMPLETE"
log "Full output saved to: audit_output.txt"
log "=========================================="
