-- Add AI generation fields to EINReport

ALTER TABLE "EINReport" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "EINReport" ADD COLUMN "strategicObjectives" TEXT;
ALTER TABLE "EINReport" ADD COLUMN "sectorContext" TEXT;
ALTER TABLE "EINReport" ADD COLUMN "financialStructure" TEXT;
ALTER TABLE "EINReport" ADD COLUMN "riskProfile" TEXT;
ALTER TABLE "EINReport" ADD COLUMN "investmentRationale" TEXT;
ALTER TABLE "EINReport" ADD COLUMN "lastGeneratedAt" TIMESTAMP(3);
