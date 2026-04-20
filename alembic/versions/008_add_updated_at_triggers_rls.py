"""add updated_at auto-update triggers and RLS on user-owned tables

Revision ID: 008_add_updated_at_triggers_rls
Revises: 007_add_supabase_id
Create Date: 2026-04-20
"""
from alembic import op

revision = '008_add_updated_at_triggers_rls'
down_revision = '007_add_supabase_id'
branch_labels = None
depends_on = None

# Tables that have an updated_at column and should auto-update on row change
_TABLES_WITH_UPDATED_AT = [
    'countries',
    'infrastructure_projects',
    'users',
    'deal_rooms',
    'deal_room_members',
    'ai_analyses',
]

# User-owned tables that need Row Level Security so users can only see their own rows.
# Supabase sets auth.uid() at session level; supabase_id / user_id FKs enforce ownership.
_USER_OWNED_TABLES = [
    'deal_rooms',
    'deal_room_members',
]


def upgrade() -> None:
    # ── updated_at trigger function (idempotent) ────────────────────────────
    op.execute("""
        CREATE OR REPLACE FUNCTION set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # ── Attach trigger to each table (skip if already exists) ──────────────
    for table in _TABLES_WITH_UPDATED_AT:
        op.execute(f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_trigger
                    WHERE tgname = 'trg_{table}_updated_at'
                      AND tgrelid = '{table}'::regclass
                ) THEN
                    CREATE TRIGGER trg_{table}_updated_at
                    BEFORE UPDATE ON {table}
                    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
                END IF;
            END;
            $$;
        """)

    # ── Missing indexes not covered by 005 ─────────────────────────────────
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_email ON users (email)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_created_at ON users (created_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_infrastructure_projects_created_at ON infrastructure_projects (created_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_deal_rooms_created_at ON deal_rooms (created_at)")

    # ── Row Level Security on user-owned tables ─────────────────────────────
    for table in _USER_OWNED_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")

    # deal_rooms and deal_room_members: RLS policies use auth.uid() which
    # only exists on Supabase-hosted PostgreSQL. Skip on plain PostgreSQL.
    op.execute("""
        DO $$
        BEGIN
            -- Only create Supabase auth-based policies if the auth schema exists
            IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies
                    WHERE tablename = 'deal_rooms' AND policyname = 'deal_rooms_owner_access'
                ) THEN
                    EXECUTE 'CREATE POLICY deal_rooms_owner_access ON deal_rooms
                        USING (created_by_id IN (
                            SELECT id FROM users WHERE supabase_id = auth.uid()::text
                        ))';
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies
                    WHERE tablename = 'deal_room_members' AND policyname = 'deal_room_members_self_access'
                ) THEN
                    EXECUTE 'CREATE POLICY deal_room_members_self_access ON deal_room_members
                        USING (user_id IN (
                            SELECT id FROM users WHERE supabase_id = auth.uid()::text
                        ))';
                END IF;
            END IF;
        END;
        $$;
    """)


def downgrade() -> None:
    # Remove RLS policies and disable RLS
    op.execute("DROP POLICY IF EXISTS deal_room_members_self_access ON deal_room_members")
    op.execute("DROP POLICY IF EXISTS deal_rooms_owner_access ON deal_rooms")
    for table in reversed(_USER_OWNED_TABLES):
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    # Drop indexes added in this migration
    op.execute("DROP INDEX IF EXISTS ix_deal_rooms_created_at")
    op.execute("DROP INDEX IF EXISTS ix_infrastructure_projects_created_at")
    op.execute("DROP INDEX IF EXISTS ix_users_created_at")
    op.execute("DROP INDEX IF EXISTS ix_users_email")

    # Drop triggers
    for table in _TABLES_WITH_UPDATED_AT:
        op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_updated_at ON {table}")

    op.execute("DROP FUNCTION IF EXISTS set_updated_at()")
