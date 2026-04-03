"""extend deal_rooms with full schema columns

Revision ID: 002_extend_deal_rooms
Revises: be9b3e8a2c28
Create Date: 2026-04-03
"""
from alembic import op
import sqlalchemy as sa

revision = '002_extend_deal_rooms'
down_revision = 'be9b3e8a2c28'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('deal_rooms', sa.Column('deal_value',        sa.Numeric(15, 2),          nullable=True))
    op.add_column('deal_rooms', sa.Column('deal_currency',     sa.String(10),              nullable=True,  server_default='USD'))
    op.add_column('deal_rooms', sa.Column('target_close_date', sa.DateTime(timezone=True), nullable=True))
    op.add_column('deal_rooms', sa.Column('is_video_enabled',  sa.Boolean(),               nullable=True,  server_default=sa.text('true')))
    op.add_column('deal_rooms', sa.Column('is_chat_enabled',   sa.Boolean(),               nullable=True,  server_default=sa.text('true')))
    op.add_column('deal_rooms', sa.Column('require_nda',       sa.Boolean(),               nullable=True,  server_default=sa.text('false')))
    op.add_column('deal_rooms', sa.Column('nda_document_url',  sa.Text(),                  nullable=True))
    op.add_column('deal_rooms', sa.Column('room_type',         sa.String(50),              nullable=True,  server_default='standard'))
    op.add_column('deal_rooms', sa.Column('max_participants',  sa.Integer(),               nullable=True,  server_default='50'))
    op.add_column('deal_rooms', sa.Column('created_by',        sa.String(),                nullable=True))
    op.create_foreign_key(
        'fk_deal_rooms_created_by', 'deal_rooms', 'users',
        ['created_by'], ['id'], ondelete='SET NULL'
    )


def downgrade() -> None:
    op.drop_constraint('fk_deal_rooms_created_by', 'deal_rooms', type_='foreignkey')
    for col in [
        'deal_value', 'deal_currency', 'target_close_date', 'is_video_enabled',
        'is_chat_enabled', 'require_nda', 'nda_document_url', 'room_type',
        'max_participants', 'created_by',
    ]:
        op.drop_column('deal_rooms', col)
