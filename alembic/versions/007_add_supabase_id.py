"""add supabase_id to users

Revision ID: 007_add_supabase_id
Revises: 006_add_notifications
Create Date: 2026-04-15
"""
import sqlalchemy as sa
from alembic import op

revision = '007_add_supabase_id'
down_revision = '006_add_notifications'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('supabase_id', sa.String(), nullable=True),
    )
    op.create_index('ix_users_supabase_id', 'users', ['supabase_id'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_users_supabase_id', table_name='users')
    op.drop_column('users', 'supabase_id')
