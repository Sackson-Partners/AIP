"""
STEP-5: Database Index Tests
Verify that performance indexes on high-query columns exist in PostgreSQL.
Skips automatically when running on SQLite (local/CI environment).
"""
import os
import pytest

# Detect if we're on SQLite (local/CI) — indexes are only enforced on PostgreSQL
_db_url = os.getenv("DATABASE_URL", "sqlite:///./aip_test.db")
_is_sqlite = _db_url.startswith("sqlite")


@pytest.mark.skipif(_is_sqlite, reason="Index checks require PostgreSQL, skipping SQLite")
class TestDatabaseIndexes:
    """Check that migration-added indexes exist in the PostgreSQL database."""

    def _index_exists(self, db_session, table_name: str, column_name: str) -> bool:
        """Query pg_indexes to check if a column index exists."""
        result = db_session.execute(
            """
            SELECT COUNT(*) FROM pg_indexes
            WHERE tablename = :table
              AND indexdef LIKE :col_pattern
            """,
            {"table": table_name, "col_pattern": f"%({column_name})%"},
        ).scalar()
        return result > 0

    def test_pipeline_logs_project_id_indexed(self, db_session):
        assert self._index_exists(db_session, "pipeline_logs", "project_id"), (
            "Missing index: pipeline_logs.project_id"
        )

    def test_investment_committees_project_id_indexed(self, db_session):
        assert self._index_exists(db_session, "investment_committees", "project_id"), (
            "Missing index: investment_committees.project_id"
        )

    def test_investment_committees_ein_id_indexed(self, db_session):
        assert self._index_exists(db_session, "investment_committees", "ein_id"), (
            "Missing index: investment_committees.ein_id"
        )

    def test_investor_interests_investor_id_indexed(self, db_session):
        assert self._index_exists(db_session, "investor_interests", "investor_id"), (
            "Missing index: investor_interests.investor_id"
        )

    def test_investor_interests_project_id_indexed(self, db_session):
        assert self._index_exists(db_session, "investor_interests", "project_id"), (
            "Missing index: investor_interests.project_id"
        )


class TestIndexesPresenceInModel:
    """Verify the ORM model declarations include index=True for the critical columns."""

    def test_model_index_declarations(self):
        """
        Confirm the SQLAlchemy models declare index=True on high-query FK columns.
        This test works on both SQLite and PostgreSQL.
        """
        from backend.models_aip_v2 import (
            PipelineLog,
            InvestmentCommittee,
            InvestorInterest,
        )
        from sqlalchemy import inspect

        # Check PipelineLog.project_id
        mapper = inspect(PipelineLog)
        project_id_col = mapper.columns["project_id"]
        assert project_id_col.index, "PipelineLog.project_id should have index=True"

        # Check InvestmentCommittee.project_id
        ic_mapper = inspect(InvestmentCommittee)
        ic_project_col = ic_mapper.columns["project_id"]
        assert ic_project_col.index, "InvestmentCommittee.project_id should have index=True"

        # Check InvestorInterest.investor_id
        ii_mapper = inspect(InvestorInterest)
        ii_investor_col = ii_mapper.columns["investor_id"]
        assert ii_investor_col.index, "InvestorInterest.investor_id should have index=True"

        # Check InvestorInterest.project_id
        ii_project_col = ii_mapper.columns["project_id"]
        assert ii_project_col.index, "InvestorInterest.project_id should have index=True"
