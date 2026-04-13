"""add notifications table

Revision ID: 006_add_notifications
Revises: 005_add_missing_indexes
Create Date: 2026-04-13
"""
import sqlalchemy as sa
from alembic import op

revision = '006_add_notifications'
down_revision = '005_add_missing_indexes'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'notifications',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_notifications_user_id', 'notifications', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_notifications_user_id', table_name='notifications')
    op.drop_table('notifications')
