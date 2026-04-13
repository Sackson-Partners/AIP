"""add missing indexes for FK columns and common filter fields

Revision ID: 005_add_missing_indexes
Revises: 004_extend_project_events
Create Date: 2026-04-13
"""
from alembic import op

revision = '005_add_missing_indexes'
down_revision = '004_extend_project_events'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index('ix_introductions_investor_id', 'introductions', ['investor_id'])
    op.create_index('ix_introductions_user_id', 'introductions', ['user_id'])
    op.create_index('ix_investors_is_active', 'investors', ['is_active'])
    op.create_index('ix_investors_organisation_name', 'investors', ['organisation_name'])
    op.create_index('ix_infrastructure_projects_status', 'infrastructure_projects', ['status'])
    op.create_index('ix_deal_rooms_status', 'deal_rooms', ['status'])
    op.create_index('ix_ai_analyses_project_id', 'ai_analyses', ['project_id'])


def downgrade() -> None:
    op.drop_index('ix_ai_analyses_project_id', table_name='ai_analyses')
    op.drop_index('ix_deal_rooms_status', table_name='deal_rooms')
    op.drop_index('ix_infrastructure_projects_status', table_name='infrastructure_projects')
    op.drop_index('ix_investors_organisation_name', table_name='investors')
    op.drop_index('ix_investors_is_active', table_name='investors')
    op.drop_index('ix_introductions_user_id', table_name='introductions')
    op.drop_index('ix_introductions_investor_id', table_name='introductions')
