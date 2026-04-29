import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { prisma } from '@/lib/prisma'

// One-time endpoint to apply pending schema migrations.
// Safe to call multiple times — all statements are idempotent (IF NOT EXISTS).
// Protected: SUPER_ADMIN only.

const STEPS = [
  {
    name: 'IcCommittee — add projectId, quorumRequired, outcome, outcomeNotes',
    sql: `
      ALTER TABLE "IcCommittee"
        ADD COLUMN IF NOT EXISTS "projectId"      TEXT,
        ADD COLUMN IF NOT EXISTS "quorumRequired" INTEGER NOT NULL DEFAULT 3,
        ADD COLUMN IF NOT EXISTS "outcome"        TEXT,
        ADD COLUMN IF NOT EXISTS "outcomeNotes"   TEXT;
    `,
  },
  {
    name: 'IcCommittee — index on projectId',
    sql: `CREATE INDEX IF NOT EXISTS "IcCommittee_projectId_idx" ON "IcCommittee"("projectId");`,
  },
  {
    name: 'IcCommittee — FK to Project',
    sql: `
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IcCommittee_projectId_fkey') THEN
          ALTER TABLE "IcCommittee"
            ADD CONSTRAINT "IcCommittee_projectId_fkey"
            FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `,
  },
  {
    name: 'IcVote — create table',
    sql: `
      CREATE TABLE IF NOT EXISTS "IcVote" (
        "id"          TEXT NOT NULL,
        "committeeId" TEXT NOT NULL,
        "userId"      TEXT NOT NULL,
        "vote"        TEXT NOT NULL,
        "rationale"   TEXT,
        "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "IcVote_pkey" PRIMARY KEY ("id")
      );
    `,
  },
  {
    name: 'IcVote — unique index + FK',
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS "IcVote_committeeId_userId_key" ON "IcVote"("committeeId", "userId");
      CREATE INDEX        IF NOT EXISTS "IcVote_committeeId_idx"        ON "IcVote"("committeeId");
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IcVote_committeeId_fkey') THEN
          ALTER TABLE "IcVote" ADD CONSTRAINT "IcVote_committeeId_fkey"
            FOREIGN KEY ("committeeId") REFERENCES "IcCommittee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'IcVote_userId_fkey') THEN
          ALTER TABLE "IcVote" ADD CONSTRAINT "IcVote_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;
    `,
  },
  {
    name: 'AccessRequest — create table',
    sql: `
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
      CREATE UNIQUE INDEX IF NOT EXISTS "AccessRequest_email_key"   ON "AccessRequest"("email");
      CREATE INDEX        IF NOT EXISTS "AccessRequest_status_idx"  ON "AccessRequest"("status");
    `,
  },
  {
    name: 'Verification — create table',
    sql: `
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
    `,
  },
  {
    name: 'Verification — FK to Project',
    sql: `
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Verification_projectId_fkey') THEN
          ALTER TABLE "Verification" ADD CONSTRAINT "Verification_projectId_fkey"
            FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;
    `,
  },
  {
    name: 'Event — create table',
    sql: `
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
      CREATE INDEX IF NOT EXISTS "Event_eventDate_idx" ON "Event"("eventDate");
    `,
  },
  {
    name: 'Event — FKs to Project + User',
    sql: `
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Event_projectId_fkey') THEN
          ALTER TABLE "Event" ADD CONSTRAINT "Event_projectId_fkey"
            FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Event_createdBy_fkey') THEN
          ALTER TABLE "Event" ADD CONSTRAINT "Event_createdBy_fkey"
            FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;
    `,
  },
]

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden — SUPER_ADMIN only' }, { status: 403 })
  }

  const results: { name: string; status: 'ok' | 'error'; error?: string }[] = []

  for (const step of STEPS) {
    try {
      await prisma.$executeRawUnsafe(step.sql)
      results.push({ name: step.name, status: 'ok' })
    } catch (err: unknown) {
      results.push({ name: step.name, status: 'error', error: err instanceof Error ? err.message : String(err) })
    }
  }

  const errors = results.filter(r => r.status === 'error')
  return NextResponse.json(
    { results, summary: `${results.length - errors.length}/${results.length} steps succeeded` },
    { status: errors.length === 0 ? 200 : 207 },
  )
}

// GET — show status of tables (quick check without making changes)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden — SUPER_ADMIN only' }, { status: 403 })
  }

  const checks = await Promise.all([
    prisma.$queryRawUnsafe<{exists: boolean}[]>(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'IcVote') as exists`),
    prisma.$queryRawUnsafe<{exists: boolean}[]>(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'AccessRequest') as exists`),
    prisma.$queryRawUnsafe<{exists: boolean}[]>(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Verification') as exists`),
    prisma.$queryRawUnsafe<{exists: boolean}[]>(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'Event') as exists`),
  ])

  return NextResponse.json({
    tables: {
      IcVote:        checks[0][0]?.exists ?? false,
      AccessRequest: checks[1][0]?.exists ?? false,
      Verification:  checks[2][0]?.exists ?? false,
      Event:         checks[3][0]?.exists ?? false,
    },
    message: 'POST to this endpoint to apply all pending migrations.',
  })
}
