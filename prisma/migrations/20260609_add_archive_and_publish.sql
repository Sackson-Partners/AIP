-- Add archive fields to Project, Verification, PISReport, AnalyticReport, Event
-- Add publish fields to Document

-- Project
ALTER TABLE "Project" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "archivedBy" TEXT;

-- Verification
ALTER TABLE "Verification" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Verification" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- PISReport
ALTER TABLE "PISReport" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PISReport" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- AnalyticReport
ALTER TABLE "AnalyticReport" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AnalyticReport" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- Event
ALTER TABLE "Event" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- Document (Data Room publish control)
ALTER TABLE "Document" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Document" ADD COLUMN "publishedAt" TIMESTAMP(3);
