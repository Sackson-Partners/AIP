-- Upgrade PartnerMatch model for smart matching v2

ALTER TABLE "PartnerMatch" ADD COLUMN "matchTier" TEXT;
ALTER TABLE "PartnerMatch" ADD COLUMN "matchExplanation" TEXT;
ALTER TABLE "PartnerMatch" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "PartnerMatch" ADD COLUMN "cachedUntil" TIMESTAMP(3);

CREATE INDEX "PartnerMatch_cachedUntil_idx" ON "PartnerMatch"("cachedUntil");
