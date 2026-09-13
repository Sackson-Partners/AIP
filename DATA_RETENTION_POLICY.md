# Data Retention Policy - AIP Platform

**Effective Date:** 2026-09-13  
**Last Updated:** 2026-09-13  
**Policy Owner:** Data Protection Officer / Platform Team

---

## Purpose

This policy defines data retention periods for the AIP Platform to:
- Comply with GDPR and data protection regulations
- Meet audit and compliance requirements
- Optimize storage costs
- Respect user privacy rights

---

## Retention Periods

### 1. User Data

| Data Type | Retention Period | Auto-Delete | Justification |
|-----------|------------------|-------------|---------------|
| **Active User Accounts** | Until account deletion | No | Operational requirement |
| **Deleted User Accounts** | Anonymized immediately | Yes | GDPR Article 17 (Right to Erasure) |
| **User Profile Data** | Duration of account | No | Service provision |
| **Email Addresses** | Duration of account | No | Authentication & communication |
| **Password Hashes** | Duration of account | No | Authentication |
| **2FA Secrets** | Duration of account | No | Security |

**Anonymization on Deletion:**
- Email → `deleted_user_[timestamp]@anonymized.local`
- Name → `[Deleted User]`
- All PII fields → NULL or anonymized
- User ID preserved for referential integrity

### 2. Activity Logs

| Log Type | Retention Period | Auto-Delete | Storage Location |
|----------|------------------|-------------|------------------|
| **Activity Logs** | 90 days | ✅ Yes | Database (ActivityLog table) |
| **Audit Logs** | 7 years | ❌ No | Database (AuditLog table) |
| **Application Logs** | 90 days | ✅ Yes | Vercel / Cloud provider |
| **Security Logs** | 1 year | ✅ Yes | Sentry / Cloud provider |
| **Access Logs** | 90 days | ✅ Yes | Vercel / Cloud provider |

**Automated Cleanup:**
- Cron job: `/api/cron/cleanup-logs` (runs daily 2:00 AM UTC)
- Deletes ActivityLog records older than 90 days
- Audit logs retained for compliance (7 years minimum)

### 3. Business Data

| Data Type | Retention Period | Auto-Delete | Justification |
|-----------|------------------|-------------|---------------|
| **Projects** | Indefinite (until deleted) | No | Core business asset |
| **Deal Rooms** | Indefinite (until deleted) | No | Transaction records |
| **Documents** | Indefinite (until deleted) | No | Due diligence materials |
| **Investor Profiles** | Indefinite (until deleted) | No | Matchmaking database |
| **EOI (Expression of Interest)** | 2 years after deal close | ✅ Yes | Business records |
| **Chat Messages** | Duration of deal room | No | Communication history |
| **Notifications** | 90 days | ✅ Yes | Temporary alerts |

**Soft Delete Pattern:**
- Projects: `archived` flag + `archivedAt` timestamp
- Cascade archiving preserves relationships
- Archived data excluded from queries but retained

### 4. Financial Data

| Data Type | Retention Period | Auto-Delete | Justification |
|-----------|------------------|-------------|---------------|
| **Transaction Records** | 7 years | No | Tax & audit requirements |
| **Deal Values** | 7 years | No | Financial reporting |
| **Funding Amounts** | 7 years | No | Compliance |
| **Payment Information** | Not stored | N/A | PCI DSS compliance |

**Note:** No credit card data stored (handled by payment processors).

### 5. Technical Data

| Data Type | Retention Period | Auto-Delete | Storage |
|-----------|------------------|-------------|---------|
| **Database Backups** | 30 days | ✅ Yes | Azure |
| **Session Tokens** | 8 hours (JWT) | Yes | In-memory |
| **Redis Cache** | 1 hour max | Yes | Upstash Redis |
| **Idempotency Records** | 24 hours | ✅ Yes | Database |
| **TOTP Secrets** | Duration of account | No | Database |

### 6. Analytics & Metrics

| Data Type | Retention Period | Auto-Delete | Provider |
|-----------|------------------|-------------|----------|
| **Page Views** | 90 days | Managed by provider | Vercel Analytics |
| **Error Reports** | 90 days | Managed by provider | Sentry |
| **Performance Metrics** | 90 days | Managed by provider | Vercel |
| **API Usage Stats** | 1 year | No | Database aggregates |

---

## Legal Basis for Retention

### GDPR Requirements

**Article 5(1)(e) - Storage Limitation:**
> Personal data shall be kept in a form which permits identification of data subjects for no longer than is necessary for the purposes for which the personal data are processed.

**Compliance:**
- User data: Retained only while account active
- Logs: 90-day retention for security/troubleshooting
- Audit logs: 7-year retention for legal obligations

### Financial Regulations

**Tax Law Requirements:**
- Transaction records: 7 years (IRS/HMRC requirement)
- Financial statements: 7 years
- Audit trails: 7 years

**Justification:** Article 6(1)(c) GDPR - Legal obligation

---

## Automated Deletion Mechanisms

### 1. Cron Job: Log Cleanup

**File:** `src/app/api/cron/cleanup-logs/route.ts`  
**Schedule:** Daily at 2:00 AM UTC  
**Action:** Deletes ActivityLog records > 90 days old

```sql
DELETE FROM "ActivityLog"
WHERE "createdAt" < NOW() - INTERVAL '90 days';
```

**Monitoring:** Check cron execution logs daily

### 2. Redis TTL

**Mechanism:** Automatic expiration via TTL  
**Configuration:**
- Session cache: 5 minutes
- API responses: 1-60 minutes
- Health checks: 10 seconds

**No manual cleanup required**

### 3. JWT Expiration

**Mechanism:** Token validation rejects expired tokens  
**Expiration:** 8 hours from issue  
**Refresh:** 1 hour updateAge

**No manual cleanup required**

---

## Manual Deletion Procedures

### User Account Deletion

**Trigger:** User requests account deletion (GDPR Article 17)

**Endpoint:** `DELETE /api/users/[id]/delete`

**Actions:**
1. Anonymize user data (email, name, PII)
2. Set sessionVersion to 99999 (force logout)
3. Preserve user ID for referential integrity
4. Cascade updates to related records
5. Create audit log entry

**Retention:** User ID preserved, all PII anonymized

### Project Soft Delete

**Trigger:** User archives project

**Endpoint:** `POST /api/projects/[id]/archive`

**Actions:**
1. Set `archived = true`
2. Set `archivedAt = NOW()`
3. Exclude from default queries
4. Preserve all data for potential restoration

**Permanent Deletion:** Manual admin action only (not automatic)

---

## Data Subject Rights

### Right to Access (Article 15)

**Endpoint:** `GET /api/users/[id]/export`

**Returns:**
- User profile data
- All projects created
- All deal rooms participated in
- All documents uploaded
- Activity logs (last 90 days)

**Format:** JSON export

### Right to Erasure (Article 17)

**Endpoint:** `DELETE /api/users/[id]/delete`

**Exceptions:**
- Audit logs retained for legal compliance (7 years)
- Financial transaction records retained (7 years)
- Aggregated/anonymized analytics retained

**Implementation:** Anonymization strategy (not hard delete)

### Right to Portability (Article 20)

**Same as Right to Access** - JSON export includes all personal data

---

## Backup Retention

### Database Backups

**Provider:** Azure PostgreSQL  
**Frequency:** Daily automated backups  
**Retention:** 30 days  
**Location:** Azure region (geo-redundant)

**RPO (Recovery Point Objective):** 24 hours  
**RTO (Recovery Time Objective):** 1 hour

### Backup Deletion

**Automatic:** Azure purges backups > 30 days  
**Manual deletion:** Not recommended (violates RTO/RPO)

**Exceptions:**
- Incident investigation: May retain specific backup longer
- Legal hold: Backup preserved per legal requirement

---

## Exception Handling

### Legal Hold

If data must be preserved for legal proceedings:

1. **Document:** Record case number, jurisdiction, scope
2. **Flag:** Mark affected accounts/data with legal hold flag
3. **Suspend:** Stop automated deletion for flagged data
4. **Notify:** Inform legal team and DPO
5. **Remove hold:** Only after legal authorization

**Retention during hold:** Indefinite until hold lifted

### Regulatory Investigation

If regulators request data:

1. **Verify:** Confirm legitimate request from authority
2. **Scope:** Identify specific data requested
3. **Preserve:** Suspend deletion for requested data
4. **Provide:** Export data in requested format
5. **Document:** Log all access and disclosures

---

## Monitoring & Compliance

### Monthly Review

**Data Protection Officer checks:**
- [ ] Cron job logs (cleanup-logs executed successfully)
- [ ] Storage usage trends (increasing = retention issue)
- [ ] User deletion requests processed within 30 days
- [ ] No audit log gaps (7-year retention verified)

### Quarterly Audit

**Platform team reviews:**
- [ ] Retention policies still align with regulations
- [ ] Automated deletions functioning correctly
- [ ] Backup retention within 30-day limit
- [ ] No unnecessary data retained

### Annual Certification

**External audit verifies:**
- [ ] GDPR compliance for retention periods
- [ ] Financial record retention (7 years)
- [ ] Data subject rights functional
- [ ] Backup/restore tested successfully

---

## Policy Updates

**Revision Schedule:** Annual or when regulations change

**Update Process:**
1. Review regulatory changes
2. Assess impact on retention periods
3. Update this document
4. Update automated cleanup scripts
5. Notify users if material changes
6. Train team on new requirements

**Version History:**
- v1.0 (2026-09-13): Initial policy established

---

## Responsibilities

| Role | Responsibility |
|------|----------------|
| **Data Protection Officer** | Policy oversight, compliance monitoring |
| **Platform Team** | Implement automated deletions, maintain systems |
| **DevOps** | Monitor cron jobs, manage backups |
| **Legal Team** | Interpret regulations, handle legal holds |
| **Support Team** | Process user deletion requests |

---

## Contact

**Data Protection Officer:** dpo@africa-infra.com  
**Privacy Inquiries:** privacy@africa-infra.com  
**User Support:** support@africa-infra.com

---

## References

- GDPR: https://gdpr-info.eu/
- Data Protection Act 2018 (UK)
- IRS Publication 583 (Record Retention)
- ISO 27001 (Information Security)

---

**Document Version:** 1.0  
**Approved By:** [DPO Name / Platform Lead]  
**Next Review:** 2027-09-13
