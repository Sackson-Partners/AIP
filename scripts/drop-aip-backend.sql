-- Drop aip_backend database
-- Decision: Option C — empty/test data only, no migration needed
-- Audited on 2026-04-25: only 5 projects, 4 investors, 4 users (all from 2026-03-26 seeding session)
--
-- Run this as the postgres admin user:
--   psql "host=aip-db.postgres.database.azure.com port=5432 dbname=postgres user=sackson sslmode=require" -f scripts/drop-aip-backend.sql

-- Terminate all active connections to aip_backend before dropping
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'aip_backend'
  AND pid <> pg_backend_pid();

-- Drop the database
DROP DATABASE IF EXISTS aip_backend;
