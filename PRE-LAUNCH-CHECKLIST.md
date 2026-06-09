# Pre-Launch Checklist for Client Demo

**Date:** 2026-06-09  
**Platform:** https://aip-plum.vercel.app  
**Status:** Preparing for first client presentation

---

## ✅ Environment Configuration (CRITICAL)

- [x] `DATABASE_URL` added to Vercel (Production)
- [ ] `DATABASE_URL` added to Preview & Development (optional, for consistency)
- [x] `NEXTAUTH_SECRET` configured
- [x] `NEXTAUTH_URL` set to production URL
- [x] `ANTHROPIC_API_KEY` configured (AI features)
- [ ] `UPSTASH_REDIS_REST_URL` configured (optional - 10x performance boost)
- [ ] `UPSTASH_REDIS_REST_TOKEN` configured (optional)
- [ ] `INNGEST_EVENT_KEY` configured (optional - background jobs)
- [ ] `INNGEST_SIGNING_KEY` configured (optional)
- [ ] `RESEND_API_KEY` configured (optional - email notifications)

---

## ✅ Pre-Launch Testing (DO THIS NOW)

### 1. Authentication
- [ ] Sign in at: https://aip-plum.vercel.app/auth/signin
- [ ] Create test user account (internal credentials)
- [ ] Verify session persists after page refresh
- [ ] Test sign out

### 2. Core Features
- [ ] Projects page loads: `/dashboard/projects`
- [ ] Can create new project
- [ ] Can view project details
- [ ] Can edit project
- [ ] Projects are visible (check visibility status: ACTIVE/FUNDED/CLOSED = published)

### 3. Critical Pages
- [ ] `/dashboard` - Dashboard loads without errors
- [ ] `/dashboard/pestel` - PESTEL analysis page loads
- [ ] `/dashboard/ein` - EIN reports page loads
- [ ] `/dashboard/investors` - Investors page loads
- [ ] `/dashboard/pipeline` - Pipeline view loads
- [ ] `/dashboard/ic` - IC Committee page loads

### 4. Data Verification
- [ ] At least 3-5 sample projects exist in database
- [ ] Projects have realistic data (cost, country, sector, description)
- [ ] Sample projects are set to ACTIVE status (published to partners)
- [ ] No test/dummy data with obvious placeholder text

### 5. Health Check
- [ ] API health check returns 200: https://aip-plum.vercel.app/api/health
- [ ] Database status: `healthy`
- [ ] No critical errors in browser console (F12)

---

## ✅ Client Presentation Setup

### Demo User Account
**Create a demo admin account for the client:**
- Email: `demo@africa-infra.com` (or client's preferred email)
- Role: `ADMIN` or `ANALYST` (full access, not SUPER_ADMIN)
- Status: `ACTIVE`
- Password: Strong temporary password (client must change on first login)

### Demo Data Requirements
**Minimum data for professional demo:**
- 5-10 real projects with complete information
- Projects should represent different:
  - Countries (Nigeria, Kenya, South Africa, etc.)
  - Sectors (Energy, Transport, Water, etc.)
  - Stages (Feasibility, Procurement, Construction, etc.)
  - Costs ($10M - $500M range)
- 2-3 sample investors
- Sample PESTEL analyses (at least for 2 projects)

### What to Show
1. **Dashboard Overview** - Key metrics, recent activity
2. **Project Management** - Create, edit, view projects
3. **PESTEL Analysis** - Risk assessment capabilities
4. **Investor Matching** - Demonstrate matching algorithm (if ready)
5. **Pipeline View** - Kanban board with deal stages
6. **Export Features** - PDF reports (if working)

### What NOT to Show (Known Issues)
- AI generation features (if Anthropic API quota issues)
- Email features (if Resend not configured)
- Background jobs (if Inngest not configured)
- Redis caching metrics (if Redis not configured)

---

## ✅ Known Limitations (Be Transparent)

**Optional Features Not Yet Configured:**
- Redis caching (performance optimization)
- Inngest background jobs (async AI operations)
- Resend email service (automated notifications)
- Azure AD SSO (single sign-on for enterprise)

**These can be enabled post-demo if client approves.**

---

## ✅ Troubleshooting Quick Reference

### If pages show "Failed to load data"
1. Check DATABASE_URL is in Vercel environment variables
2. Redeploy from Vercel dashboard
3. Wait 3-4 minutes for deployment to complete
4. Clear browser cache + hard refresh (Cmd+Shift+R)

### If health check fails
```bash
curl https://aip-plum.vercel.app/api/health
```
Should return:
```json
{
  "status": "healthy",
  "timestamp": "2026-06-09T...",
  "checks": [
    {"service": "database", "status": "healthy", "latency": 50}
  ]
}
```

### If authentication loops/fails
1. Check NEXTAUTH_SECRET and NEXTAUTH_URL in Vercel
2. Clear browser cookies for aip-plum.vercel.app
3. Try incognito/private browsing mode

---

## ✅ Post-Demo Action Items

**If client approves:**
1. Set up custom domain (e.g., app.africa-infra.com)
2. Configure Azure AD SSO for enterprise access
3. Enable Redis caching for production performance
4. Configure Inngest for AI background jobs
5. Set up Resend for email notifications
6. Create client admin accounts
7. Import real project data
8. Schedule training session

**If client requests changes:**
1. Document feature requests
2. Prioritize by impact and effort
3. Provide timeline estimates
4. Schedule follow-up demo

---

## 🚀 Launch Readiness

**Current Status:** 
- ✅ Core platform deployed
- ✅ Database connected
- ✅ Authentication working
- ⏳ Waiting for deployment to complete
- ⏳ Pending pre-launch testing

**Before sharing with client:**
1. Complete all items in "Pre-Launch Testing" section
2. Create demo user account
3. Verify sample data looks professional
4. Test on both desktop and mobile (responsive design)
5. Prepare talking points for known limitations

---

## 📞 Emergency Contacts

**If critical issues arise during demo:**
- Fallback: Show local development environment
- Backup: Screen recording of working features
- Support: Have this checklist and DEPLOYMENT.md ready

---

**Remember:** This is a first demo, not a final product. Be confident in what works, transparent about what's in progress, and enthusiastic about the roadmap.

Good luck with your client presentation! 🎉
