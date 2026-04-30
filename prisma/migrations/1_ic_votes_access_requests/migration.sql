-- AlterTable: IcCommittee — add project link, quorum, outcome fields
ALTER TABLE "IcCommittee"
  ADD COLUMN IF NOT EXISTS "projectId"      TEXT,
  ADD COLUMN IF NOT EXISTS "quorumRequired" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "outcome"        TEXT,
  ADD COLUMN IF NOT EXISTS "outcomeNotes"   TEXT;

-- CreateIndex on IcCommittee.projectId
CREATE INDEX IF NOT EXISTS "IcCommittee_projectId_idx" 
  ON "IcCommittee"("projectId");

-- AddForeignKey: IcCommittee.projectId → Project.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'IcCommittee_projectId_fkey'
  ) THEN
    ALTER TABLE "IcCommittee"
      ADD CONSTRAINT "IcCommittee_projectId_fkey"
      FOREIGN KEY ("projectId") 
      REFERENCES "Project"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- CreateTable: IcVote
CREATE TABLE IF NOT EXISTS "IcVote" (
  "id"          TEXT NOT NULL,
  "committeeId" TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "vote"        TEXT NOT NULL,
  "rationale"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IcVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IcVote_committeeId_userId_key" 
  ON "IcVote"("committeeId", "userId");

CREATE INDEX IF NOT EXISTS "IcVote_committeeId_idx" 
  ON "IcVote"("committeeId");

-- AddForeignKey: IcVote constraints (using DO block — safe for reruns)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'IcVote_committeeId_fkey'
  ) THEN
    ALTER TABLE "IcVote"
      ADD CONSTRAINT "IcVote_committeeId_fkey"
      FOREIGN KEY ("committeeId") 
      REFERENCES "IcCommittee"("id") 
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'IcVote_userId_fkey'
  ) THEN
    ALTER TABLE "IcVote"
      ADD CONSTRAINT "IcVote_userId_fkey"
      FOREIGN KEY ("userId") 
      REFERENCES "User"("id") 
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- CreateTable: AccessRequest
CREATE TABLE IF NOT EXISTS "AccessRequest" (
  "id"            TEXT NOT NULL,
  "email"         TEXT NOT NULL,
  "fullName"      TEXT NOT NULL,
  "organization"  TEXT,
  "roleRequested" TEXT NOT NULL,
  "message"       TEXT,
  "status"        TEXT NOT NULL DEFAULT 'PENDING',
  "reviewedBy"    TEXT,
  "reviewedAt"    TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AccessRequest_email_key" 
  ON "AccessRequest"("email");

CREATE INDEX IF NOT EXISTS "AccessRequest_status_idx" 
  ON "AccessRequest"("status");
