"""extend project_events with location, is_public, created_by, image_url, max_attendees

Revision ID: 004_extend_project_events
Revises: 003_add_deal_room_subtables
Create Date: 2026-04-03
"""
from alembic import op
import sqlalchemy as sa

revision = '004_extend_project_events'
down_revision = '003_add_deal_room_subtables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('project_events', sa.Column('location',     sa.Text(),    nullable=True))
    op.add_column('project_events', sa.Column('is_public',    sa.Boolean(), nullable=True, server_default=sa.text('true')))
    op.add_column('project_events', sa.Column('created_by',   sa.String(),  nullable=True))
    op.add_column('project_events', sa.Column('image_url',    sa.Text(),    nullable=True))
    op.add_column('project_events', sa.Column('max_attendees',sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_project_events_created_by', 'project_events', 'users',
        ['created_by'], ['id'], ondelete='SET NULL'
    )


def downgrade() -> None:
    op.drop_constraint('fk_project_events_created_by', 'project_events', type_='foreignkey')
    for col in ['location', 'is_public', 'created_by', 'image_url', 'max_attendees']:
        op.drop_column('project_events', col)
