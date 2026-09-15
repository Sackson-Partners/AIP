-- Add sessionVersion column to User table
-- This column is used for session versioning to force logout on security events

-- Add column with default value
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 1;

-- Add index for performance (session validation queries)
CREATE INDEX IF NOT EXISTS "User_sessionVersion_idx"
ON "User"("sessionVersion");

-- Verify column was added
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'User'
        AND column_name = 'sessionVersion'
    ) THEN
        RAISE NOTICE 'SUCCESS: sessionVersion column added to User table';
    ELSE
        RAISE EXCEPTION 'FAILED: sessionVersion column was not added';
    END IF;
END $$;
