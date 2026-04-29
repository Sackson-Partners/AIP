-- CreateTable: Verification
CREATE TABLE IF NOT EXISTS "Verification" (
  "id"                  TEXT NOT NULL,
  "projectId"           TEXT NOT NULL,
  "level"               TEXT NOT NULL DEFAULT 'V0',
  "status"              TEXT NOT NULL DEFAULT 'PENDING',
  "technicalReadiness"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "financialRobustness" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "legalClarity"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "esgCompliance"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "overallScore"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes"               TEXT,
  "verifiedBy"          TEXT,
  "verifiedAt"          TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Verification_projectId_idx" ON "Verification"("projectId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Verification_projectId_fkey') THEN
    ALTER TABLE "Verification" ADD CONSTRAINT "Verification_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- CreateTable: Event
CREATE TABLE IF NOT EXISTS "Event" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "eventDate"   TIMESTAMP(3) NOT NULL,
  "location"    TEXT,
  "type"        TEXT NOT NULL DEFAULT 'general',
  "projectId"   TEXT,
  "createdBy"   TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Event_projectId_idx" ON "Event"("projectId");
CREATE INDEX IF NOT EXISTS "Event_eventDate_idx"  ON "Event"("eventDate");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Event_projectId_fkey') THEN
    ALTER TABLE "Event" ADD CONSTRAINT "Event_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Event_createdBy_fkey') THEN
    ALTER TABLE "Event" ADD CONSTRAINT "Event_createdBy_fkey"
      FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
