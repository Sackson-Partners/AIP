-- Enhance IC Committee models for automation (Feature 2.6)

-- Add automation fields to IcCommittee
ALTER TABLE "IcCommittee" ADD COLUMN "votingDeadline" TIMESTAMP(3);
ALTER TABLE "IcCommittee" ADD COLUMN "votesSent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "IcCommittee" ADD COLUMN "autoCloseAt" TIMESTAMP(3);
ALTER TABLE "IcCommittee" ADD COLUMN "createdById" TEXT;

CREATE INDEX "IcCommittee_votingDeadline_idx" ON "IcCommittee"("votingDeadline");
CREATE INDEX "IcCommittee_autoCloseAt_idx" ON "IcCommittee"("autoCloseAt");

-- Add createdBy foreign key (allow NULL for existing records)
ALTER TABLE "IcCommittee" ADD CONSTRAINT "IcCommittee_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add automation fields to IcVote
ALTER TABLE "IcVote" ADD COLUMN "votedAt" TIMESTAMP(3);
ALTER TABLE "IcVote" ADD COLUMN "reminderSent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "IcVote" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "IcVote_userId_idx" ON "IcVote"("userId");
CREATE INDEX "IcVote_votedAt_idx" ON "IcVote"("votedAt");

-- Update existing votes to set votedAt = createdAt for records that have a vote
UPDATE "IcVote" SET "votedAt" = "createdAt" WHERE "vote" IS NOT NULL;
