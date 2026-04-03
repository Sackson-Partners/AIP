"""add deal_room_members, deal_room_documents, deal_room_meetings

Revision ID: 003_add_deal_room_subtables
Revises: 002_extend_deal_rooms
Create Date: 2026-04-03
"""
from alembic import op
import sqlalchemy as sa

revision = '003_add_deal_room_subtables'
down_revision = '002_extend_deal_rooms'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── deal_room_members ───────────────────────────────────────
    op.create_table(
        'deal_room_members',
        sa.Column('id',          sa.String(), primary_key=True),
        sa.Column('deal_room_id',sa.String(), sa.ForeignKey('deal_rooms.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id',     sa.String(), sa.ForeignKey('users.id',      ondelete='CASCADE'), nullable=False),
        sa.Column('role',        sa.String(50),  nullable=True,  server_default='viewer'),
        sa.Column('joined_at',   sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('invited_by',  sa.String(), sa.ForeignKey('users.id'), nullable=True),
    )
    op.create_index('ix_drm_deal_room_id', 'deal_room_members', ['deal_room_id'])
    op.create_index('ix_drm_user_id',      'deal_room_members', ['user_id'])

    # ── deal_room_documents ─────────────────────────────────────
    op.create_table(
        'deal_room_documents',
        sa.Column('id',          sa.String(), primary_key=True),
        sa.Column('deal_room_id',sa.String(), sa.ForeignKey('deal_rooms.id', ondelete='CASCADE'), nullable=False),
        sa.Column('uploaded_by', sa.String(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('file_name',   sa.String(255), nullable=False),
        sa.Column('file_url',    sa.Text(),      nullable=False),
        sa.Column('file_size',   sa.Integer(),   nullable=True),
        sa.Column('file_type',   sa.String(100), nullable=True),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('requires_nda',sa.Boolean(),   nullable=True, server_default=sa.text('false')),
    )
    op.create_index('ix_drd_deal_room_id', 'deal_room_documents', ['deal_room_id'])

    # ── deal_room_meetings ──────────────────────────────────────
    op.create_table(
        'deal_room_meetings',
        sa.Column('id',           sa.String(), primary_key=True),
        sa.Column('deal_room_id', sa.String(), sa.ForeignKey('deal_rooms.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_by',   sa.String(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('title',        sa.String(255), nullable=False),
        sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('duration_mins',sa.Integer(),   nullable=True, server_default='60'),
        sa.Column('meeting_url',  sa.Text(),      nullable=True),
        sa.Column('status',       sa.String(50),  nullable=True, server_default='scheduled'),
        sa.Column('notes',        sa.Text(),      nullable=True),
        sa.Column('created_at',   sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_index('ix_drmtg_deal_room_id', 'deal_room_meetings', ['deal_room_id'])


def downgrade() -> None:
    op.drop_index('ix_drmtg_deal_room_id', table_name='deal_room_meetings')
    op.drop_table('deal_room_meetings')
    op.drop_index('ix_drd_deal_room_id', table_name='deal_room_documents')
    op.drop_table('deal_room_documents')
    op.drop_index('ix_drm_user_id',      table_name='deal_room_members')
    op.drop_index('ix_drm_deal_room_id', table_name='deal_room_members')
    op.drop_table('deal_room_members')
