-- Add check constraints for financial field validation
-- Migration: 20260911_add_financial_check_constraints
-- Date: 2026-09-11
-- Purpose: Ensure data integrity for project financial fields

-- ─── Financial Structure Validation ──────────────────────────────────────────
-- Constraint: Total financing (equity + debt + grant) cannot exceed total cost
ALTER TABLE "Project"
ADD CONSTRAINT "check_financial_structure"
CHECK (
  "totalCost" IS NULL
  OR (
    COALESCE("equityRequired", 0) +
    COALESCE("debtRequired", 0) +
    COALESCE("grantRequired", 0)
  ) <= "totalCost"
);

-- ─── Non-Negative Financial Fields ───────────────────────────────────────────
-- Ensure equity, debt, and grant cannot be negative
ALTER TABLE "Project"
ADD CONSTRAINT "check_equity_nonnegative"
CHECK ("equityRequired" IS NULL OR "equityRequired" >= 0);

ALTER TABLE "Project"
ADD CONSTRAINT "check_debt_nonnegative"
CHECK ("debtRequired" IS NULL OR "debtRequired" >= 0);

ALTER TABLE "Project"
ADD CONSTRAINT "check_grant_nonnegative"
CHECK ("grantRequired" IS NULL OR "grantRequired" >= 0);

-- ─── Total Cost Validation ────────────────────────────────────────────────────
-- Total cost must be positive
ALTER TABLE "Project"
ADD CONSTRAINT "check_total_cost_positive"
CHECK ("totalCost" IS NULL OR "totalCost" > 0);

-- ─── Concession Period Validation ──────────────────────────────────────────────
-- Concession period must be positive (in years)
ALTER TABLE "Project"
ADD CONSTRAINT "check_concession_period_positive"
CHECK ("concessionPeriod" IS NULL OR "concessionPeriod" > 0);

-- ─── Score Validation ───────────────────────────────────────────────────────────
-- PETFEL and EIN scores should be between 0 and 100
ALTER TABLE "Project"
ADD CONSTRAINT "check_petfel_score_range"
CHECK ("petfelScore" IS NULL OR ("petfelScore" >= 0 AND "petfelScore" <= 100));

ALTER TABLE "Project"
ADD CONSTRAINT "check_ein_score_range"
CHECK ("einScore" IS NULL OR ("einScore" >= 0 AND "einScore" <= 100));

-- ─── View Count Validation ──────────────────────────────────────────────────────
-- View count cannot be negative
ALTER TABLE "Project"
ADD CONSTRAINT "check_view_count_nonnegative"
CHECK ("viewCount" >= 0);

-- ─── Comments for Documentation ────────────────────────────────────────────────
COMMENT ON CONSTRAINT "check_financial_structure" ON "Project"
IS 'Ensures total financing (equity + debt + grant) does not exceed total cost';

COMMENT ON CONSTRAINT "check_equity_nonnegative" ON "Project"
IS 'Ensures equity required is non-negative';

COMMENT ON CONSTRAINT "check_debt_nonnegative" ON "Project"
IS 'Ensures debt required is non-negative';

COMMENT ON CONSTRAINT "check_grant_nonnegative" ON "Project"
IS 'Ensures grant required is non-negative';

COMMENT ON CONSTRAINT "check_total_cost_positive" ON "Project"
IS 'Ensures total cost is positive when provided';

COMMENT ON CONSTRAINT "check_concession_period_positive" ON "Project"
IS 'Ensures concession period is positive (in years)';

COMMENT ON CONSTRAINT "check_petfel_score_range" ON "Project"
IS 'Ensures PETFEL score is between 0 and 100';

COMMENT ON CONSTRAINT "check_ein_score_range" ON "Project"
IS 'Ensures EIN score is between 0 and 100';

COMMENT ON CONSTRAINT "check_view_count_nonnegative" ON "Project"
IS 'Ensures view count is non-negative';
