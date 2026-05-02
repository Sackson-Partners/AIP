-- AlterTable: Add FP/LP fields to Verification
ALTER TABLE "Verification" ADD COLUMN IF NOT EXISTS "focalPointName"  TEXT;
ALTER TABLE "Verification" ADD COLUMN IF NOT EXISTS "focalPointEmail" TEXT;
ALTER TABLE "Verification" ADD COLUMN IF NOT EXISTS "focalPointOrg"   TEXT;
ALTER TABLE "Verification" ADD COLUMN IF NOT EXISTS "focalPointTitle" TEXT;
ALTER TABLE "Verification" ADD COLUMN IF NOT EXISTS "localPartnerName"  TEXT;
ALTER TABLE "Verification" ADD COLUMN IF NOT EXISTS "localPartnerOrg"   TEXT;
ALTER TABLE "Verification" ADD COLUMN IF NOT EXISTS "localPartnerRole"  TEXT;
ALTER TABLE "Verification" ADD COLUMN IF NOT EXISTS "localPartnerEmail" TEXT;

-- CreateTable: PISReport
CREATE TABLE IF NOT EXISTS "PISReport" (
  "id"                   TEXT NOT NULL,
  "projectId"            TEXT NOT NULL,
  "status"               TEXT NOT NULL DEFAULT 'DRAFT',
  "executiveSummary"     TEXT,
  "projectBackground"    TEXT,
  "financialStructure"   TEXT,
  "marketAnalysis"       TEXT,
  "riskFactors"          TEXT,
  "investmentHighlights" TEXT,
  "useOfProceeds"        TEXT,
  "exitStrategy"         TEXT,
  "teamBackground"       TEXT,
  "legalStructure"       TEXT,
  "aiGenerated"          BOOLEAN NOT NULL DEFAULT false,
  "generatedAt"          TIMESTAMP(3),
  "createdBy"            TEXT NOT NULL,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PISReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PISReport_projectId_key" ON "PISReport"("projectId");
CREATE INDEX IF NOT EXISTS "PISReport_projectId_idx" ON "PISReport"("projectId");
CREATE INDEX IF NOT EXISTS "PISReport_status_idx" ON "PISReport"("status");

ALTER TABLE "PISReport" ADD CONSTRAINT "PISReport_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
