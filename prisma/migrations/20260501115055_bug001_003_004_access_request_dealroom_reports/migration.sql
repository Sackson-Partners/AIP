/*
  Warnings:

  - Added the required column `updatedAt` to the `DealRoom` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AccessRequest" ADD COLUMN     "country" TEXT,
ADD COLUMN     "ministry" TEXT,
ADD COLUMN     "phone" TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DealRoom" ADD COLUMN     "dealCurrency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "dealValue" DOUBLE PRECISION,
ADD COLUMN     "isChatEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isVideoEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "requireNda" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "targetCloseDate" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- Backfill existing rows before enforcing NOT NULL
UPDATE "DealRoom" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;

ALTER TABLE "DealRoom" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "Event" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "IcCommittee" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';

-- AlterTable
ALTER TABLE "Verification" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "AnalyticReport" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sector" TEXT,
    "country" TEXT,
    "content" TEXT,
    "data" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticReport_createdBy_idx" ON "AnalyticReport"("createdBy");

-- CreateIndex
CREATE INDEX "AnalyticReport_type_idx" ON "AnalyticReport"("type");
