-- AlterTable
ALTER TABLE "DealRoom" ADD COLUMN     "dealType" TEXT,
ADD COLUMN     "eoiCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "eoiDeadline" TIMESTAMP(3),
ADD COLUMN     "featuredUntil" TIMESTAMP(3),
ADD COLUMN     "minTicket" DOUBLE PRECISION,
ADD COLUMN     "targetRaise" DOUBLE PRECISION,
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Investor" ADD COLUMN     "aum" DOUBLE PRECISION,
ADD COLUMN     "countryFocus" TEXT,
ADD COLUMN     "countryOfOrigin" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "esgConstraints" TEXT,
ADD COLUMN     "instruments" TEXT,
ADD COLUMN     "languages" TEXT,
ADD COLUMN     "maxTicket" DOUBLE PRECISION,
ADD COLUMN     "minTicket" DOUBLE PRECISION,
ADD COLUMN     "organizationType" TEXT,
ADD COLUMN     "profileComplete" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "sectorFocus" TEXT,
ADD COLUMN     "stageFocus" TEXT,
ADD COLUMN     "targetIRR" DOUBLE PRECISION,
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "PartnerMatch" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "matchScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpressionOfInterest" (
    "id" TEXT NOT NULL,
    "dealRoomId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "organization" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpressionOfInterest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedDeal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dealRoomId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedDeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerMatch_investorId_idx" ON "PartnerMatch"("investorId");

-- CreateIndex
CREATE INDEX "PartnerMatch_projectId_idx" ON "PartnerMatch"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerMatch_investorId_projectId_key" ON "PartnerMatch"("investorId", "projectId");

-- CreateIndex
CREATE INDEX "ExpressionOfInterest_dealRoomId_idx" ON "ExpressionOfInterest"("dealRoomId");

-- CreateIndex
CREATE INDEX "ExpressionOfInterest_status_idx" ON "ExpressionOfInterest"("status");

-- CreateIndex
CREATE INDEX "SavedDeal_userId_idx" ON "SavedDeal"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedDeal_userId_dealRoomId_key" ON "SavedDeal"("userId", "dealRoomId");

-- CreateIndex
CREATE INDEX "Investor_organizationType_idx" ON "Investor"("organizationType");

-- AddForeignKey
ALTER TABLE "PartnerMatch" ADD CONSTRAINT "PartnerMatch_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpressionOfInterest" ADD CONSTRAINT "ExpressionOfInterest_dealRoomId_fkey" FOREIGN KEY ("dealRoomId") REFERENCES "DealRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
