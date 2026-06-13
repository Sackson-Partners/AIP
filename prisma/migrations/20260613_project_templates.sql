-- Add ProjectTemplate model for reusable project configurations

CREATE TABLE "ProjectTemplate" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "name"          TEXT NOT NULL,
  "description"   TEXT,
  "sector"        TEXT,
  "stage"         TEXT,
  "defaultFields" JSONB,
  "createdById"   TEXT NOT NULL,
  "isPublic"      BOOLEAN NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL
);

CREATE INDEX "ProjectTemplate_createdById_idx" ON "ProjectTemplate"("createdById");
CREATE INDEX "ProjectTemplate_isPublic_idx" ON "ProjectTemplate"("isPublic");
CREATE INDEX "ProjectTemplate_sector_idx" ON "ProjectTemplate"("sector");
