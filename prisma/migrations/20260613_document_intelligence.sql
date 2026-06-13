-- Add Document Intelligence features (Feature 2.4)

-- Enhance Document model with AI summarization fields
ALTER TABLE "Document" ADD COLUMN "summary" TEXT;
ALTER TABLE "Document" ADD COLUMN "keyInsights" JSONB;
ALTER TABLE "Document" ADD COLUMN "summarizedAt" TIMESTAMP(3);
ALTER TABLE "Document" ADD COLUMN "summarizationStatus" TEXT;

CREATE INDEX "Document_summarizationStatus_idx" ON "Document"("summarizationStatus");

-- Create DocumentVersion table for version history
CREATE TABLE "DocumentVersion" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "documentId" TEXT NOT NULL,
  "versionNum" INTEGER NOT NULL,
  "blobUrl"    TEXT NOT NULL,
  "blobKey"    TEXT NOT NULL,
  "size"       INTEGER,
  "uploadedBy" TEXT NOT NULL,
  "changeNote" TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "DocumentVersion_documentId_versionNum_key" ON "DocumentVersion"("documentId", "versionNum");
CREATE INDEX "DocumentVersion_documentId_idx" ON "DocumentVersion"("documentId");

ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create DocumentEvent table for analytics
CREATE TABLE "DocumentEvent" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "documentId" TEXT NOT NULL,
  "userId"     TEXT,
  "userEmail"  TEXT,
  "eventType"  TEXT NOT NULL,
  "metadata"   JSONB,
  "ipAddress"  TEXT,
  "userAgent"  TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "DocumentEvent_documentId_idx" ON "DocumentEvent"("documentId");
CREATE INDEX "DocumentEvent_userId_idx" ON "DocumentEvent"("userId");
CREATE INDEX "DocumentEvent_eventType_idx" ON "DocumentEvent"("eventType");
CREATE INDEX "DocumentEvent_createdAt_idx" ON "DocumentEvent"("createdAt");

ALTER TABLE "DocumentEvent" ADD CONSTRAINT "DocumentEvent_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
